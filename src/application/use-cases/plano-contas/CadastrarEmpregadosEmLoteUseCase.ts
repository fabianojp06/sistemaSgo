import type { CategoriaEmpregado, EmpregadoHeadcount, PrismaClient } from '@prisma/client';
import {
  CargoNaoEncontradoParaEmpregadoError,
  CargoObrigatorioEmpregadoError,
  CargoRascunhoNaoPodeReceberEmpregadoError,
  MetaNaoEncontradaError,
  PeriodoInicialRetroativoError,
  PropostaNaoEncontradaError,
  QuantidadeEmpregadoLoteInvalidaError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';
import { formatarVinculoFuncionalHerdado } from '@/domain/plano-contas/formatarVinculoFuncionalHerdado';
import { montarSnapshotComponenteCustoEmpregado } from '@/domain/plano-contas/montarSnapshotComponenteCustoEmpregado';

type CadastrarEmpregadosEmLoteInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  cargoId: string;
  quantidade: number;
  categoria: CategoriaEmpregado;
  periodoInicio: Date;
  periodoFim?: Date | null;
};

/**
 * US-108b — Lançamento em Lote de Vagas por Cargo (Quantidade). Mesmas
 * validações de CadastrarEmpregadoUseCase (US-108); cria N registros de
 * EmpregadoHeadcount idênticos, todos "A CONTRATAR" [RN0249] — nome nomeado
 * não faz sentido para lote, por isso não é aceito aqui (ver CadastrarEmpregadoUseCase
 * para lançamento individual nomeado).
 */
export class CadastrarEmpregadosEmLoteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarEmpregadosEmLoteInput): Promise<EmpregadoHeadcount[]> {
    if (!input.cargoId) {
      throw new CargoObrigatorioEmpregadoError();
    }
    if (!Number.isInteger(input.quantidade) || input.quantidade <= 0) {
      throw new QuantidadeEmpregadoLoteInvalidaError();
    }

    const proposta = await this.prisma.proposta.findFirst({ where: { tenantId: input.tenantId, id: input.propostaId } });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada: esta Proposta está oficializada e seus dados estão congelados.',
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
      include: { unidadeFuncional: true },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoParaEmpregadoError();
    }
    // ADR-042 [TRAVA O ERRO] — mesmo bloqueio de CadastrarEmpregadoUseCase (a checagem
    // de contaId/unidadeFuncional, além de status, também estreita o tipo para o TS).
    if (cargo.status === 'RASCUNHO' || !cargo.contaId || !cargo.unidadeFuncional) {
      throw new CargoRascunhoNaoPodeReceberEmpregadoError();
    }
    // Extraído em variável local — narrowing não atravessa a closure da transação abaixo.
    const contaIdCargo = cargo.contaId;

    const vinculoFuncionalHerdado = formatarVinculoFuncionalHerdado(cargo.unidadeFuncional);
    const parametro = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
    const diasUteisPadrao = parametro?.diasUteisPadrao ?? 22;
    const snapshotComponentes = montarSnapshotComponenteCustoEmpregado(cargo, diasUteisPadrao);

    return this.prisma.$transaction(async (tx) => {
      const empregados: EmpregadoHeadcount[] = [];
      for (let i = 0; i < input.quantidade; i++) {
        const empregado = await tx.empregadoHeadcount.create({
          data: {
            tenantId: input.tenantId,
            propostaId: input.propostaId,
            metaId,
            cargoId: input.cargoId,
            nome: 'A CONTRATAR', // RN0249 — lote é sempre vaga de contingência, sem nome individual.
            categoria: input.categoria,
            periodoInicio: input.periodoInicio,
            periodoFim: input.periodoFim ?? null,
            vinculoFuncionalHerdado,
            custoTotalMensal: cargo.custoTotalCargo,
            contaId: contaIdCargo,
            ...snapshotComponentes,
          },
        });
        empregados.push(empregado);
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'EMPREGADOS_LOTE_CADASTRADO',
          descricao: `${input.quantidade} vaga(s) do cargo "${cargo.codigoCargo}" cadastrada(s) em lote`,
          dadosSerializados: {
            propostaId: input.propostaId,
            cargoId: input.cargoId,
            quantidade: input.quantidade,
            empregadoIds: empregados.map((e) => e.id),
            custoTotalMensal: cargo.custoTotalCargo.toString(),
          },
        },
      });

      return empregados;
    });
  }
}
