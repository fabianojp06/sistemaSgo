import type { EmpregadoHeadcount, PrismaClient } from '@prisma/client';
import { CargoNaoEncontradoError } from '@/domain/plano-contas/errors';
import { montarSnapshotComponenteCustoEmpregado } from '@/domain/plano-contas/montarSnapshotComponenteCustoEmpregado';
import { formatarVinculoFuncionalHerdado } from '@/domain/plano-contas/formatarVinculoFuncionalHerdado';

type RessincronizarSnapshotEmpregadosCargoInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
};

export type RessincronizacaoEmpregadoResultado = {
  empregadoId: string;
  nome: string;
  custoTotalMensalAnterior: string;
  custoTotalMensalNovo: string;
  atualizado: boolean;
  motivoIgnorado?: string;
};

/**
 * ADR-030 — ação explícita (não automática em ConfigurarBeneficiosCargoUseCase/
 * EditarCargoUseCase) para não quebrar o congelamento intencional do
 * snapshot (ADR-018): só re-herda de propostas ainda editáveis
 * (RASCUNHO/EM_ELABORACAO); Empregados de propostas oficializadas ficam
 * congelados e são ignorados, reportados no resultado.
 */
export class RessincronizarSnapshotEmpregadosCargoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: RessincronizarSnapshotEmpregadosCargoInput): Promise<RessincronizacaoEmpregadoResultado[]> {
    const cargo = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId },
      include: { alocacoes: { include: { unidadeFuncional: true } } },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoError();
    }
    // ADR-042 — Cargo Rascunho não tem contaId nem pode ter Empregado vinculado
    // (bloqueado em CadastrarEmpregadoUseCase); nada para ressincronizar.
    if (!cargo.contaId) {
      return [];
    }
    // Extraído em variável local — narrowing não atravessa a closure da transação abaixo.
    const contaIdCargo = cargo.contaId;

    const parametro = await this.prisma.parametroSistema.findUnique({ where: { tenantId: input.tenantId } });
    const diasUteisPadrao = parametro?.diasUteisPadrao ?? 22;
    const vinculoFuncionalHerdado = formatarVinculoFuncionalHerdado(cargo.alocacoes);
    const snapshotComponentes = montarSnapshotComponenteCustoEmpregado(cargo, diasUteisPadrao);

    const empregados = await this.prisma.empregadoHeadcount.findMany({
      where: { tenantId: input.tenantId, cargoId: input.cargoId, ativo: true },
      include: { proposta: { select: { status: true } } },
    });

    const resultados: RessincronizacaoEmpregadoResultado[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const empregado of empregados) {
        const editavel = empregado.proposta.status === 'RASCUNHO' || empregado.proposta.status === 'EM_ELABORACAO';
        if (!editavel) {
          resultados.push({
            empregadoId: empregado.id,
            nome: empregado.nome,
            custoTotalMensalAnterior: empregado.custoTotalMensal.toString(),
            custoTotalMensalNovo: empregado.custoTotalMensal.toString(),
            atualizado: false,
            motivoIgnorado: 'Proposta oficializada — dados congelados.',
          });
          continue;
        }

        await tx.empregadoHeadcount.update({
          where: { id: empregado.id },
          data: {
            vinculoFuncionalHerdado,
            custoTotalMensal: cargo.custoTotalCargo,
            contaId: contaIdCargo,
            ...snapshotComponentes,
          },
        });

        resultados.push({
          empregadoId: empregado.id,
          nome: empregado.nome,
          custoTotalMensalAnterior: empregado.custoTotalMensal.toString(),
          custoTotalMensalNovo: cargo.custoTotalCargo.toString(),
          atualizado: true,
        });
      }

      const atualizados = resultados.filter((r) => r.atualizado);
      if (atualizados.length > 0) {
        await tx.historicoOperacao.create({
          data: {
            tenantId: input.tenantId,
            usuarioId: input.usuarioId,
            tipoOperacao: 'EMPREGADOS_SNAPSHOT_RESSINCRONIZADO',
            descricao: `Snapshot de custo ressincronizado para ${atualizados.length} empregado(s) do Cargo "${cargo.codigoCargo}"`,
            dadosSerializados: {
              cargoId: cargo.id,
              empregados: atualizados.map((r) => ({
                empregadoId: r.empregadoId,
                custoTotalMensalAnterior: r.custoTotalMensalAnterior,
                custoTotalMensalNovo: r.custoTotalMensalNovo,
              })),
            },
          },
        });
      }
    });

    return resultados;
  }
}
