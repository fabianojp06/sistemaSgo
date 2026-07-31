import { Prisma, type PrismaClient } from '@prisma/client';
import {
  AliquotaImpostoNaoEncontradaError,
  ConflitoConcorrenciaError,
  ImpostoNaoDisponivelParaTipoPropostaError,
  ValorOrcadoInvalidoError,
  VersaoOficializadaCongeladaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type ConfigurarRateioImpostoInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  aliquotaParametroId: string;
  competencia: Date;
  valorDeclarado: Prisma.Decimal.Value;
  /** US-105 — updatedAt lido pelo cliente antes de editar; se divergir do atual, é conflito. */
  tokenConcorrencia?: Date;
};

/**
 * US-101 — Parametrizar Impostos em Proposta. Cenários 1, 2, 4, 5: valida
 * versão editável + imunidade tributária de Termo de Parceria (RN_PRO_010) +
 * valor >= 0, persiste com snapshot da alíquota vigente (RN_TAX_03) e audita.
 */
export class ConfigurarRateioImpostoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ConfigurarRateioImpostoInput) {
    const valor = new Prisma.Decimal(input.valorDeclarado);
    if (valor.isNaN() || valor.isNegative()) {
      throw new ValorOrcadoInvalidoError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
      include: { proposta: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    // Cenário 4 [TRAVA O ERRO] — dados fiscais congelados fora de RASCUNHO/EM_ELABORACAO.
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoOficializadaCongeladaError();
    }

    const aliquotaParametro = await this.prisma.aliquotaImpostoParametro.findFirst({
      where: { tenantId: input.tenantId, id: input.aliquotaParametroId },
    });
    if (!aliquotaParametro) {
      throw new AliquotaImpostoNaoEncontradaError();
    }

    // Cenário 5, RN_PRO_010 — Termo de Parceria: tributos CONTRATO-only ficam indisponíveis.
    if (versao.proposta.tipo === 'TERMO_DE_PARCERIA' && aliquotaParametro.tipoIncidencia === 'CONTRATO') {
      throw new ImpostoNaoDisponivelParaTipoPropostaError();
    }

    const registroAnterior = await this.prisma.rateioImpostoGrade.findUnique({
      where: {
        tenantId_versaoId_aliquotaParametroId_competencia: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          aliquotaParametroId: input.aliquotaParametroId,
          competencia: input.competencia,
        },
      },
    });

    // US-105 — rejeita de cara se o token já diverge do estado lido, sem abrir transação.
    if (
      registroAnterior &&
      input.tokenConcorrencia &&
      input.tokenConcorrencia.getTime() !== registroAnterior.updatedAt.getTime()
    ) {
      throw new ConflitoConcorrenciaError();
    }

    return this.prisma.$transaction(async (tx) => {
      let salvo: { valorDeclarado: Prisma.Decimal; aliquotaAplicadaSnapshot: Prisma.Decimal; ativo: boolean };

      if (!registroAnterior) {
        salvo = await tx.rateioImpostoGrade.create({
          data: {
            tenantId: input.tenantId,
            versaoId: input.versaoId,
            aliquotaParametroId: input.aliquotaParametroId,
            competencia: input.competencia,
            valorDeclarado: valor,
            aliquotaAplicadaSnapshot: aliquotaParametro.aliquotaPct,
            ativo: true,
          },
        });
      } else {
        // Condição por updatedAt (optimistic locking, US-105) — vale mesmo sem tokenConcorrencia
        // explícito, usando o valor que este próprio use-case acabou de ler.
        const resultado = await tx.rateioImpostoGrade.updateMany({
          where: { id: registroAnterior.id, updatedAt: registroAnterior.updatedAt },
          data: { valorDeclarado: valor, aliquotaAplicadaSnapshot: aliquotaParametro.aliquotaPct, ativo: true },
        });
        if (resultado.count === 0) {
          throw new ConflitoConcorrenciaError();
        }
        salvo = { valorDeclarado: valor, aliquotaAplicadaSnapshot: aliquotaParametro.aliquotaPct, ativo: true };
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'RATEIO_IMPOSTO_CONFIGURADO',
          descricao: `Rateio do tributo "${aliquotaParametro.nome}" configurado para a competência ${input.competencia.toISOString().slice(0, 7)}`,
          dadosSerializados: {
            versaoId: input.versaoId,
            aliquotaParametroId: input.aliquotaParametroId,
            competencia: input.competencia,
            valorAnterior: registroAnterior?.valorDeclarado.toString() ?? null,
            valorNovo: valor.toString(),
            aliquotaAplicadaSnapshot: aliquotaParametro.aliquotaPct.toString(),
          },
        },
      });

      return salvo;
    });
  }
}
