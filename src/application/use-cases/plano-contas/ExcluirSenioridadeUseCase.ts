import type { PrismaClient } from '@prisma/client';
import {
  SenioridadeNaoEncontradaError,
  SenioridadePadraoNaoExcluivelError,
  SenioridadeReferenciadaError,
} from '@/domain/plano-contas/errors';

type ExcluirSenioridadeInput = {
  tenantId: string;
  usuarioId: string;
  senioridadeId: string;
};

/**
 * US-131, Cenário 4 [TRAVA O ERRO], RN_TAB_01 — Senioridade padrão (Jr/Pl/Sr) nunca é
 * excluível. Senioridade customizada só é excluível sem nenhum registro vinculado na
 * Tabela Salarial. [SOFT DELETE].
 */
export class ExcluirSenioridadeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirSenioridadeInput) {
    const atual = await this.prisma.senioridade.findFirst({
      where: { tenantId: input.tenantId, id: input.senioridadeId, ativo: true },
    });
    if (!atual) {
      throw new SenioridadeNaoEncontradaError();
    }

    if (atual.isPadrao) {
      throw new SenioridadePadraoNaoExcluivelError();
    }

    const referencia = await this.prisma.tabelaSalarial.findFirst({
      where: { tenantId: input.tenantId, senioridadeId: atual.id },
      select: { id: true },
    });
    if (referencia) {
      throw new SenioridadeReferenciadaError();
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.senioridade.update({ where: { id: atual.id }, data: { ativo: false } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'SENIORIDADE_EXCLUIDA',
          descricao: `Senioridade "${atual.descricao}" excluída`,
          dadosSerializados: { senioridadeId: atual.id, descricao: atual.descricao },
        },
      });

      return { id: atual.id };
    });
  }
}
