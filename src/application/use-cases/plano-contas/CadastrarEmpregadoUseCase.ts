import type { CategoriaEmpregado, EmpregadoHeadcount, PrismaClient } from '@prisma/client';
import {
  CargoNaoEncontradoParaEmpregadoError,
  CargoObrigatorioEmpregadoError,
  MetaNaoEncontradaError,
  PeriodoInicialRetroativoError,
  PropostaNaoEncontradaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { formatarVinculoFuncionalHerdado } from '@/domain/plano-contas/formatarVinculoFuncionalHerdado';
import { montarSnapshotComponenteCustoEmpregado } from '@/domain/plano-contas/montarSnapshotComponenteCustoEmpregado';

type CadastrarEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  cargoId: string;
  nome?: string | null;
  categoria: CategoriaEmpregado;
  periodoInicio: Date;
  periodoFim?: Date | null;
};

/**
 * US-108 — Cadastrar Empregado. Herda (snapshot) Vínculo Funcional e Custo
 * Total Mensal do Cargo no momento do cadastro — congelado até troca
 * explícita de Cargo [ORIGEM BLINDADA, ADR-018].
 *
 * ADR-024/US-113 — Empregado passou a ser aceito também em Proposta
 * categoria=POR_META (antes restrito a CONSOLIDADA): metaId é derivado
 * automaticamente da Meta 1:1 da versão vigente [[Meta]] (mesmo padrão de
 * CadastrarViagemUseCase), nunca input direto. Em CONSOLIDADA, metaId=null.
 */
export class CadastrarEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarEmpregadoInput): Promise<EmpregadoHeadcount> {
    if (!input.cargoId) {
      throw new CargoObrigatorioEmpregadoError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: input.propostaId } });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada [TRAVA O ERRO]: esta Proposta está oficializada e seus dados estão congelados.',
      );
    }
    if (input.periodoInicio.getTime() < proposta.dataInicio.getTime()) {
      throw new PeriodoInicialRetroativoError();
    }

    let metaId: string | null = null;
    if (proposta.categoria === 'POR_META') {
      const versaoVigente = await this.prisma.versaoProposta.findFirst({
        where: { tenantId: input.tenantId, propostaId: input.propostaId, vigente: true, ativa: true },
      });
      const meta = versaoVigente
        ? await this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, versaoId: versaoVigente.id, ativo: true } })
        : null;
      if (!meta) {
        throw new MetaNaoEncontradaError();
      }
      metaId = meta.id;
    }

    const cargo = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId, propostaId: input.propostaId },
      include: { alocacoes: { include: { unidadeFuncional: true } } },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoParaEmpregadoError();
    }

    const parametro = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
    const diasUteisPadrao = parametro?.diasUteisPadrao ?? 22;
    const snapshotComponentes = montarSnapshotComponenteCustoEmpregado(cargo, diasUteisPadrao);

    const nome = input.nome?.trim() || 'A CONTRATAR'; // RN0249

    return this.prisma.$transaction(async (tx) => {
      const empregado = await tx.empregadoHeadcount.create({
        data: {
          tenantId: input.tenantId,
          propostaId: input.propostaId,
          metaId,
          cargoId: input.cargoId,
          nome,
          categoria: input.categoria,
          periodoInicio: input.periodoInicio,
          periodoFim: input.periodoFim ?? null,
          // numeroDependentes deliberadamente omitido (default 0) — deprecated
          // pelo ADR-020/US-108a; dependentes agora são por benefício em
          // EmpregadoBeneficioElegibilidade.
          vinculoFuncionalHerdado: formatarVinculoFuncionalHerdado(cargo.alocacoes),
          custoTotalMensal: cargo.custoTotalCargo,
          contaId: cargo.contaId, // ADR-027 — snapshot herdado, mesmo padrão de vinculoFuncionalHerdado
          ...snapshotComponentes, // ADR-029 — snapshot de valor + conta de cada componente de custo
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'EMPREGADO_CRIADO',
          descricao: `Empregado "${nome}" cadastrado no cargo "${cargo.codigoCargo}"`,
          dadosSerializados: {
            empregadoId: empregado.id,
            propostaId: input.propostaId,
            cargoId: input.cargoId,
            custoTotalMensal: cargo.custoTotalCargo.toString(),
          },
        },
      });

      return empregado;
    });
  }
}
