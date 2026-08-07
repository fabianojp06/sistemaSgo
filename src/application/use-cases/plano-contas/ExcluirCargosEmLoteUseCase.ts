import type { PrismaClient } from '@prisma/client';
import { ExclusaoCargoBloqueadaError, PropostaImutavelError, PropostaNaoEncontradaError } from '@/domain/plano-contas/errors';

type ExcluirCargosEmLoteInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  cargoIds: string[];
};

/**
 * ADR-031 — exclusão em lote, tudo-ou-nada: valida todos os cargoIds antes
 * de excluir qualquer um. Se algum tiver Empregado ativo vinculado, a
 * operação inteira é rejeitada e o erro lista quais cargos bloquearam —
 * evita exclusão parcial silenciosa que deixaria o usuário sem saber quais
 * cargos saíram e quais ficaram.
 */
export class ExcluirCargosEmLoteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirCargosEmLoteInput): Promise<void> {
    if (input.cargoIds.length === 0) return;

    const proposta = await this.prisma.proposta.findFirst({
      where: { tenantId: input.tenantId, id: input.propostaId },
    });
    if (!proposta) {
      throw new PropostaNaoEncontradaError();
    }
    if (proposta.status !== 'RASCUNHO' && proposta.status !== 'EM_ELABORACAO') {
      throw new PropostaImutavelError();
    }

    const cargos = await this.prisma.cargo.findMany({
      where: { tenantId: input.tenantId, propostaId: input.propostaId, id: { in: input.cargoIds }, ativo: true },
    });

    const empregadosPorCargo = await this.prisma.empregadoHeadcount.groupBy({
      by: ['cargoId'],
      where: { tenantId: input.tenantId, cargoId: { in: input.cargoIds }, ativo: true },
      _count: { _all: true },
    });
    const cargoIdsBloqueados = new Set(empregadosPorCargo.map((e) => e.cargoId));

    const codigosBloqueados = cargos.filter((c) => cargoIdsBloqueados.has(c.id)).map((c) => c.codigoCargo);
    if (codigosBloqueados.length > 0) {
      throw new ExclusaoCargoBloqueadaError(codigosBloqueados);
    }

    await this.prisma.$transaction([
      this.prisma.cargo.updateMany({
        where: { tenantId: input.tenantId, propostaId: input.propostaId, id: { in: input.cargoIds } },
        data: { ativo: false },
      }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'CARGO_EXCLUIDO',
          descricao: `${cargos.length} cargo(s) excluído(s) em lote: ${cargos.map((c) => c.codigoCargo).join(', ')}`,
          dadosSerializados: { cargoIds: input.cargoIds },
        },
      }),
    ]);
  }
}
