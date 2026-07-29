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

type CriarAgrupadorInput = {
  tenantId: string;
  usuarioId: string;
  nome: string;
  contaIds: string[];
};

/** UC03.00 / A2 — Criar Agrupador de Contas. Validações: RN_PLA_008. */
export class CriarAgrupadorUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CriarAgrupadorInput): Promise<{ id: string }> {
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
      const agrupador = await this.prisma.$transaction(async (tx) => {
        const criado = await tx.contaAgrupadora.create({
          data: { tenantId: input.tenantId, nome },
        });

        await tx.contaAgrupadoraItem.createMany({
          data: contaIdsUnicos.map((contaId) => ({ agrupadoraId: criado.id, contaId })),
        });

        await tx.historicoOperacao.create({
          data: {
            tenantId: input.tenantId,
            usuarioId: input.usuarioId,
            tipoOperacao: 'AGRUPADOR_CRIADO',
            descricao: `Agrupador de Contas "${nome}" criado`,
            dadosSerializados: { agrupadorId: criado.id, nome, contaIds: contaIdsUnicos },
          },
        });

        return criado;
      });

      return { id: agrupador.id };
    } catch (erro) {
      if (isUniqueConstraintError(erro)) {
        throw new AgrupadorNomeDuplicadoError();
      }
      throw erro;
    }
  }
}
