import type { PrismaClient } from '@prisma/client';
import { AgrupadorInvalidoError, AgrupadorNomeDuplicadoError } from '@/domain/plano-contas/errors';

const UNIQUE_CONSTRAINT_ERROR_CODE = 'P2002';

function isUniqueConstraintError(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE
  );
}

type EditarAgrupadorInput = {
  tenantId: string;
  usuarioId: string;
  agrupadorId: string;
  nome: string;
  contaIds: string[];
};

/** UC03.00 / A3 — Editar Agrupador de Contas. Validações: RN_PLA_008. */
export class EditarAgrupadorUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarAgrupadorInput): Promise<void> {
    const nome = input.nome.trim();
    const contaIdsUnicos = [...new Set(input.contaIds)];

    if (nome.length === 0 || contaIdsUnicos.length < 2) {
      throw new AgrupadorInvalidoError(
        'O Agrupador deve ter um Nome preenchido e ao menos duas contas analíticas selecionadas.',
      );
    }

    const contasAnaliticas = await this.prisma.contaContabil.count({
      where: { id: { in: contaIdsUnicos }, tenantId: input.tenantId, isAnalitica: true },
    });
    if (contasAnaliticas !== contaIdsUnicos.length) {
      throw new AgrupadorInvalidoError(
        'Todas as contas selecionadas devem ser contas analíticas (nó folha) do Plano de Contas.',
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const estadoAnterior = await tx.contaAgrupadora.findUniqueOrThrow({
          where: { id: input.agrupadorId },
          include: { itens: true },
        });

        await tx.contaAgrupadora.update({
          where: { id: input.agrupadorId },
          data: { nome },
        });

        await tx.contaAgrupadoraItem.deleteMany({ where: { agrupadoraId: input.agrupadorId } });
        await tx.contaAgrupadoraItem.createMany({
          data: contaIdsUnicos.map((contaId) => ({ agrupadoraId: input.agrupadorId, contaId })),
        });

        await tx.historicoOperacao.create({
          data: {
            tenantId: input.tenantId,
            usuarioId: input.usuarioId,
            tipoOperacao: 'AGRUPADOR_EDITADO',
            descricao: `Agrupador de Contas "${nome}" editado`,
            dadosSerializados: {
              agrupadorId: input.agrupadorId,
              estadoAnterior: { nome: estadoAnterior.nome, contaIds: estadoAnterior.itens.map((i) => i.contaId) },
              estadoAtual: { nome, contaIds: contaIdsUnicos },
            },
          },
        });
      });
    } catch (erro) {
      if (isUniqueConstraintError(erro)) {
        throw new AgrupadorNomeDuplicadoError();
      }
      throw erro;
    }
  }
}
