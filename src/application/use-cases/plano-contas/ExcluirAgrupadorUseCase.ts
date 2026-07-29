import type { PrismaClient } from '@prisma/client';
import { AgrupadorReferenciadoError } from '@/domain/plano-contas/errors';

type ExcluirAgrupadorInput = {
  tenantId: string;
  usuarioId: string;
  agrupadorId: string;
};

/**
 * UC03.00 / A4 — Excluir Agrupador de Contas. RN_PLA_010 bloqueia exclusão se o
 * Agrupador estiver referenciado em Cronogramas de Desembolso ou Propostas ativas
 * — nenhum desses módulos existe ainda no SGO, então `possuiReferenciaAtiva`
 * é o ponto de extensão a implementar quando eles existirem (hoje sempre `false`).
 */
export class ExcluirAgrupadorUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly possuiReferenciaAtiva: (agrupadorId: string) => Promise<boolean> = async () => false,
  ) {}

  async execute(input: ExcluirAgrupadorInput): Promise<void> {
    if (await this.possuiReferenciaAtiva(input.agrupadorId)) {
      throw new AgrupadorReferenciadoError();
    }

    await this.prisma.$transaction(async (tx) => {
      const agrupador = await tx.contaAgrupadora.findUniqueOrThrow({ where: { id: input.agrupadorId } });

      await tx.contaAgrupadora.delete({ where: { id: input.agrupadorId } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'AGRUPADOR_EXCLUIDO',
          descricao: `Agrupador de Contas "${agrupador.nome}" excluído`,
          dadosSerializados: { agrupadorId: agrupador.id, nome: agrupador.nome },
        },
      });
    });
  }
}
