import type { CategoriaEmpregado, EmpregadoHeadcount, PrismaClient } from '@prisma/client';
import {
  CargoNaoEncontradoParaEmpregadoError,
  CargoObrigatorioEmpregadoError,
  EmpregadoNaoEncontradoError,
  PeriodoInicialRetroativoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type EditarEmpregadoInput = {
  tenantId: string;
  usuarioId: string;
  empregadoId: string;
  cargoId: string;
  nome?: string | null;
  categoria: CategoriaEmpregado;
  periodoInicio: Date;
  periodoFim?: Date | null;
  /** Cenário 7 — qualquer valor enviado aqui é ignorado; sempre herdado do Cargo atual. */
  custoTotalMensal?: number | null;
};

/**
 * US-108 — Editar Empregado. Trocar o cargoId recalcula o snapshot de
 * Vínculo Funcional/Custo Total Mensal (Cenário 6); se o cargo não mudar,
 * o snapshot existente é preservado (não é lido de volta do Cargo).
 */
export class EditarEmpregadoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarEmpregadoInput): Promise<EmpregadoHeadcount> {
    if (!input.cargoId) {
      throw new CargoObrigatorioEmpregadoError();
    }

    const empregadoAtual = await this.prisma.empregadoHeadcount.findFirst({
      where: { tenantId: input.tenantId, id: input.empregadoId },
    });
    if (!empregadoAtual) {
      throw new EmpregadoNaoEncontradoError();
    }

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: empregadoAtual.propostaId },
    });
    if (!proposta || (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO')) {
      throw new VersaoPropostaInvalidaError(
        'Ação Negada [TRAVA O ERRO]: esta Proposta está oficializada e seus dados estão congelados.',
      );
    }
    if (input.periodoInicio.getTime() < proposta.dataInicio.getTime()) {
      throw new PeriodoInicialRetroativoError();
    }

    const nome = input.nome?.trim() || 'A CONTRATAR';

    // Cenário 6 — troca de cargo dispara novo gatilho de herança; se o cargo
    // não mudou, o snapshot atual (vinculoFuncionalHerdado/custoTotalMensal)
    // é preservado, não recarregado do Cargo (ADR-018 — congelado por padrão).
    let vinculoFuncionalHerdado = empregadoAtual.vinculoFuncionalHerdado;
    let custoTotalMensal = empregadoAtual.custoTotalMensal;
    let codigoCargoParaAuditoria = input.cargoId;

    if (input.cargoId !== empregadoAtual.cargoId) {
      const novoCargo = await this.prisma.cargo.findFirst({
        where: { tenantId: input.tenantId, id: input.cargoId, propostaId: empregadoAtual.propostaId },
        include: { unidadeFuncional: true },
      });
      if (!novoCargo) {
        throw new CargoNaoEncontradoParaEmpregadoError();
      }
      vinculoFuncionalHerdado = novoCargo.unidadeFuncional.nome;
      custoTotalMensal = novoCargo.custoTotalCargo;
      codigoCargoParaAuditoria = novoCargo.codigoCargo;
    }

    return this.prisma.$transaction(async (tx) => {
      const empregado = await tx.empregadoHeadcount.update({
        where: { id: input.empregadoId },
        data: {
          cargoId: input.cargoId,
          nome,
          categoria: input.categoria,
          periodoInicio: input.periodoInicio,
          periodoFim: input.periodoFim ?? null,
          // numeroDependentes deliberadamente não tocado — deprecated pelo
          // ADR-020/US-108a; dependentes agora são por benefício.
          vinculoFuncionalHerdado,
          custoTotalMensal,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'EMPREGADO_EDITADO',
          descricao: `Empregado "${empregadoAtual.nome} — ${nome}" editado (cargo: ${codigoCargoParaAuditoria})`,
          dadosSerializados: {
            empregadoId: empregado.id,
            custoTotalMensalAnterior: empregadoAtual.custoTotalMensal.toString(),
            custoTotalMensalNovo: custoTotalMensal.toString(),
          },
        },
      });

      return empregado;
    });
  }
}
