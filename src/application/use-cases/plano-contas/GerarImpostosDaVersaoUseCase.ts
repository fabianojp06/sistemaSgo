import { Prisma, type PrismaClient } from '@prisma/client';
import {
  SemBaseParaGerarImpostosError,
  VersaoOficializadaCongeladaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { ValorRealizadoService } from '@/domain/plano-contas/ValorRealizadoService';

type GerarImpostosDaVersaoInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
};

export type LinhaImpostoGerado = {
  aliquotaParametroId: string;
  aliquotaNome: string;
  contaId: string;
  base: string;
  aliquotaPct: string;
  imposto: string;
};

export type GerarImpostosDaVersaoResult = {
  linhasGeradas: number;
  valorTotalImposto: string;
  contasAfetadas: string[];
  porLinha: LinhaImpostoGerado[];
  /** Pares pulados por já existirem como linha manual (DECLARADO) na competência de início. */
  paresPuladosPorDeclarado: number;
  /** Pares pulados por base bruta zero (Cenário 7). */
  paresPuladosPorBaseZero: number;
};

const ROUND = Prisma.Decimal.ROUND_HALF_EVEN;

/**
 * US-144 / ADR-050 — Motor de cálculo automático de imposto sobre conta analítica.
 *
 * Escopo = os pares `(alíquota × conta)` já vinculados à Versão via
 * `RateioImpostoGrade` (US-101). Para cada par elegível gera **1 linha**
 * `modoValor = CALCULADO` com `competencia = Proposta.dataInicio`,
 * `imposto = base bruta da conta × alíquota% ÷ 100` (Half-Even, RN0252).
 *
 * Regras (RN_TAX_10/11/12/03, RN_PRO_010):
 * - só alíquotas `categoria = TRIBUTO` geram imposto (índices de reajuste, jamais);
 * - Termo de Parceria pula tributos `tipoIncidencia = CONTRATO` (imunidade — RN_PRO_010);
 * - base bruta = Empregado + Viagem + ItemPatrimonial, SEM nenhum `RateioImpostoGrade`
 *   (sem cascata, sem referência circular);
 * - base zero → nenhuma linha;
 * - substitui só as linhas `CALCULADO` do par; NUNCA toca linhas `DECLARADO`
 *   (manuais da US-101 ou ajustes de reajuste US-128/129);
 * - só roda em Versão `RASCUNHO`/`EM_ELABORACAO` (congelamento pós-oficialização).
 */
export class GerarImpostosDaVersaoUseCase {
  private readonly valorRealizadoService: ValorRealizadoService;

  constructor(private readonly prisma: PrismaClient) {
    this.valorRealizadoService = new ValorRealizadoService(prisma);
  }

  async execute(input: GerarImpostosDaVersaoInput): Promise<GerarImpostosDaVersaoResult> {
    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
      include: { proposta: { select: { tipo: true, dataInicio: true } } },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    // RN_TAX_03 [TRAVA O ERRO] — congelamento pós-oficialização.
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoOficializadaCongeladaError();
    }

    const competencia = versao.proposta.dataInicio;
    const ehTermoDeParceria = versao.proposta.tipo === 'TERMO_DE_PARCERIA';

    // Escopo — pares (alíquota × conta) já vinculados à Versão.
    const rateiosAtivos = await this.prisma.rateioImpostoGrade.findMany({
      where: { tenantId: input.tenantId, versaoId: input.versaoId, ativo: true },
      select: { aliquotaParametroId: true, contaId: true },
    });
    const paresUnicos = new Map<string, { aliquotaParametroId: string; contaId: string }>();
    for (const r of rateiosAtivos) {
      paresUnicos.set(`${r.aliquotaParametroId}::${r.contaId}`, r);
    }
    if (paresUnicos.size === 0) {
      throw new SemBaseParaGerarImpostosError();
    }

    const parametros = await this.prisma.aliquotaImpostoParametro.findMany({
      where: { tenantId: input.tenantId, id: { in: [...new Set(rateiosAtivos.map((r) => r.aliquotaParametroId))] } },
      select: { id: true, nome: true, aliquotaPct: true, categoria: true, tipoIncidencia: true },
    });
    const parametroPorId = new Map(parametros.map((p) => [p.id, p]));

    const brutoPorConta = await this.valorRealizadoService.somarCustoBrutoPorConta(input.tenantId, input.versaoId);

    const porLinha: LinhaImpostoGerado[] = [];
    const contasAfetadas = new Set<string>();
    let valorTotalImposto = new Prisma.Decimal(0);
    let paresPuladosPorDeclarado = 0;
    let paresPuladosPorBaseZero = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const { aliquotaParametroId, contaId } of paresUnicos.values()) {
        const parametro = parametroPorId.get(aliquotaParametroId);
        if (!parametro) continue;

        // RN_TAX_10/Cenário 5 — só TRIBUTO. RN_PRO_010/Cenário 4 — imunidade TP.
        if (parametro.categoria !== 'TRIBUTO') continue;
        if (ehTermoDeParceria && parametro.tipoIncidencia === 'CONTRATO') continue;

        // RN_TAX_12 — substitui só as linhas CALCULADO deste par (todas as competências).
        await tx.rateioImpostoGrade.updateMany({
          where: {
            tenantId: input.tenantId,
            versaoId: input.versaoId,
            aliquotaParametroId,
            contaId,
            modoValor: 'CALCULADO',
            ativo: true,
          },
          data: { ativo: false },
        });

        const base = brutoPorConta.get(contaId) ?? new Prisma.Decimal(0);
        if (base.lessThanOrEqualTo(0)) {
          paresPuladosPorBaseZero++;
          continue;
        }

        const aliquotaPct = parametro.aliquotaPct;
        const imposto = base.times(aliquotaPct).dividedBy(100).toDecimalPlaces(2, ROUND);

        const existente = await tx.rateioImpostoGrade.findUnique({
          where: {
            tenantId_versaoId_aliquotaParametroId_contaId_competencia: {
              tenantId: input.tenantId,
              versaoId: input.versaoId,
              aliquotaParametroId,
              contaId,
              competencia,
            },
          },
          select: { id: true, modoValor: true, ativo: true },
        });

        if (existente && existente.modoValor === 'DECLARADO' && existente.ativo) {
          // NUNCA toca uma linha DECLARADO ativa — o par fica só com a manual.
          paresPuladosPorDeclarado++;
          continue;
        }

        if (existente) {
          // Reaproveita o slot (era um CALCULADO recém-desativado, ou um DECLARADO inativo).
          await tx.rateioImpostoGrade.update({
            where: { id: existente.id },
            data: {
              modoValor: 'CALCULADO',
              valorBaseSnapshot: base,
              valorDeclarado: imposto,
              aliquotaAplicadaSnapshot: aliquotaPct,
              ativo: true,
            },
          });
        } else {
          await tx.rateioImpostoGrade.create({
            data: {
              tenantId: input.tenantId,
              versaoId: input.versaoId,
              aliquotaParametroId,
              contaId,
              competencia,
              modoValor: 'CALCULADO',
              valorBaseSnapshot: base,
              valorDeclarado: imposto,
              aliquotaAplicadaSnapshot: aliquotaPct,
              ativo: true,
            },
          });
        }

        contasAfetadas.add(contaId);
        valorTotalImposto = valorTotalImposto.plus(imposto);
        porLinha.push({
          aliquotaParametroId,
          aliquotaNome: parametro.nome,
          contaId,
          base: base.toFixed(2),
          aliquotaPct: aliquotaPct.toString(),
          imposto: imposto.toFixed(2),
        });
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'IMPOSTOS_GERADOS',
          descricao: `Impostos gerados para a Versão: ${porLinha.length} linha(s), total R$ ${valorTotalImposto.toFixed(2)}`,
          dadosSerializados: {
            versaoId: input.versaoId,
            contasAfetadas: [...contasAfetadas],
            porLinha,
            paresPuladosPorDeclarado,
            paresPuladosPorBaseZero,
          },
        },
      });
    });

    return {
      linhasGeradas: porLinha.length,
      valorTotalImposto: valorTotalImposto.toFixed(2),
      contasAfetadas: [...contasAfetadas],
      porLinha,
      paresPuladosPorDeclarado,
      paresPuladosPorBaseZero,
    };
  }
}
