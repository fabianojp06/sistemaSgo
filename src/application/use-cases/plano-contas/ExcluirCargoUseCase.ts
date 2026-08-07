import type { PrismaClient } from '@prisma/client';
import { CargoNaoEncontradoError, ExclusaoCargoBloqueadaError, PropostaImutavelError, PropostaNaoEncontradaError } from '@/domain/plano-contas/errors';

type ExcluirCargoInput = {
  tenantId: string;
  usuarioId: string;
  cargoId: string;
};

/** ADR-031 — excluir (soft delete) um Cargo, mesmo padrão de InativarUnidadeFuncionalUseCase (US-106). */
export class ExcluirCargoUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirCargoInput): Promise<void> {
    const cargo = await this.prisma.cargo.findFirst({
      where: { tenantId: input.tenantId, id: input.cargoId, ativo: true },
    });
    if (!cargo) {
      throw new CargoNaoEncontradoError();
    }

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: cargo.propostaId },
    });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new PropostaImutavelError();
    }

    const totalEmpregadosVinculados = await this.prisma.empregadoHeadcount.count({
      where: { tenantId: input.tenantId, cargoId: input.cargoId, ativo: true },
    });
    if (totalEmpregadosVinculados > 0) {
      throw new ExclusaoCargoBloqueadaError([cargo.codigoCargo]);
    }

    await this.prisma.$transaction([
      this.prisma.cargo.update({ where: { id: input.cargoId }, data: { ativo: false } }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'CARGO_EXCLUIDO',
          descricao: `Cargo "${cargo.codigoCargo} — ${cargo.nomeCargoMercado}" excluído`,
          dadosSerializados: { cargoId: cargo.id },
        },
      }),
    ]);
  }
}
