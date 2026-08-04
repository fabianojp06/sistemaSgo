import type { PrismaClient } from '@prisma/client';
import { ItemPatrimonialNaoEncontradoError, VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type ExcluirItemPatrimonialInput = {
  tenantId: string;
  usuarioId: string;
  itemPatrimonialId: string;
};

/**
 * US-110, Cenário 7 — Excluir Item Patrimonial (soft delete). Mesma simplicidade
 * de Meta/Cargo/Viagem: nenhuma lógica de exclusão física condicional (ADR-023).
 */
export class ExcluirItemPatrimonialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirItemPatrimonialInput): Promise<void> {
    const item = await this.prisma.itemPatrimonial.findFirst({
      where: { tenantId: input.tenantId, id: input.itemPatrimonialId, ativo: true },
    });
    if (!item) {
      throw new ItemPatrimonialNaoEncontradoError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: item.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.itemPatrimonial.update({ where: { id: input.itemPatrimonialId }, data: { ativo: false } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ITEM_PATRIMONIAL_EXCLUIDO',
          descricao: `Item patrimonial "${item.descricao}" excluído`,
          dadosSerializados: { itemPatrimonialId: item.id, versaoId: item.versaoId, valorTotal: item.valorTotal.toString() },
        },
      });
    });
  }
}
