import type { ItemPatrimonial, PrismaClient } from '@prisma/client';
import { calcularValorTotalItemPatrimonial } from '@/domain/plano-contas/calcularValorTotalItemPatrimonial';
import {
  CamposObrigatoriosItemPatrimonialError,
  ConflitoConcorrenciaError,
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
  /** US-105 — updatedAt lido pelo cliente antes de editar; se divergir do atual, é conflito. */
  tokenConcorrencia?: Date;
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

    // US-105 — se o cliente informou o token e ele já diverge do estado lido, nem tenta:
    // conflito é certo. Evita abrir transação para uma escrita que vamos rejeitar de qualquer forma.
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== itemAtual.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    return this.prisma.$transaction(async (tx) => {
      // Condição por updatedAt (optimistic locking, US-105) — vale mesmo sem tokenConcorrencia
      // explícito, usando o valor que este próprio use-case acabou de ler.
      const resultado = await tx.itemPatrimonial.updateMany({
        where: { id: input.itemPatrimonialId, updatedAt: itemAtual.updatedAt },
        data: {
          descricao,
          data: input.data,
          quantidade: input.quantidade,
          valorUnitario: input.valorUnitario,
          contaId: input.contaId,
          valorTotal,
        },
      });
      if (resultado.count === 0) {
        throw new ConflitoConcorrenciaError();
      }
      const item = await tx.itemPatrimonial.findUniqueOrThrow({ where: { id: input.itemPatrimonialId } });

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
