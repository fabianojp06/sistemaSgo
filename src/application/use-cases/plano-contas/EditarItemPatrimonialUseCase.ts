import type { ItemPatrimonial, PrismaClient } from '@prisma/client';
import { calcularValorTotalItemPatrimonial } from '@/domain/plano-contas/calcularValorTotalItemPatrimonial';
import {
  CamposObrigatoriosItemPatrimonialError,
  ContaItemPatrimonialNaoAnaliticaError,
  ItemPatrimonialNaoEncontradoError,
  QuantidadeOuValorItemPatrimonialInvalidoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type EditarItemPatrimonialInput = {
  tenantId: string;
  usuarioId: string;
  itemPatrimonialId: string;
  contaId: string;
  descricao: string;
  data: Date;
  quantidade: number;
  valorUnitario: number;
};

/**
 * US-110, Cenário 6 — Editar Item Patrimonial. Vínculos com Proposta/Versão e
 * Meta são congelados [ORIGEM BLINDADA] — só descrição, data, quantidade,
 * valor unitário e conta são editáveis. Valor Total sempre recalculado.
 */
export class EditarItemPatrimonialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: EditarItemPatrimonialInput): Promise<ItemPatrimonial> {
    const descricao = input.descricao?.trim() ?? '';
    if (descricao.length === 0 || descricao.length > 100 || !input.data || !input.contaId) {
      throw new CamposObrigatoriosItemPatrimonialError();
    }
    if (!input.quantidade || input.quantidade <= 0 || input.valorUnitario == null || input.valorUnitario < 0) {
      throw new QuantidadeOuValorItemPatrimonialInvalidoError();
    }

    const itemAtual = await this.prisma.itemPatrimonial.findFirst({
      where: { tenantId: input.tenantId, id: input.itemPatrimonialId, ativo: true },
    });
    if (!itemAtual) {
      throw new ItemPatrimonialNaoEncontradoError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: itemAtual.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida.',
      );
    }

    const conta = await this.prisma.contaContabil.findFirst({
      where: { tenantId: input.tenantId, id: input.contaId },
      select: { isAnalitica: true },
    });
    if (!conta?.isAnalitica) {
      throw new ContaItemPatrimonialNaoAnaliticaError();
    }

    const valorTotal = calcularValorTotalItemPatrimonial(input.quantidade, input.valorUnitario);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.itemPatrimonial.update({
        where: { id: input.itemPatrimonialId },
        data: {
          descricao,
          data: input.data,
          quantidade: input.quantidade,
          valorUnitario: input.valorUnitario,
          contaId: input.contaId,
          valorTotal,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ITEM_PATRIMONIAL_EDITADO',
          descricao: `Item patrimonial "${itemAtual.descricao} — ${descricao}" editado`,
          dadosSerializados: {
            itemPatrimonialId: item.id,
            valorTotalAnterior: itemAtual.valorTotal.toString(),
            valorTotalNovo: valorTotal.toString(),
          },
        },
      });

      return item;
    });
  }
}
