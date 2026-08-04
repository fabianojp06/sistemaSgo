import type { ItemPatrimonial, PrismaClient } from '@prisma/client';
import { calcularValorTotalItemPatrimonial } from '@/domain/plano-contas/calcularValorTotalItemPatrimonial';
import {
  CamposObrigatoriosItemPatrimonialError,
  ContaItemPatrimonialNaoAnaliticaError,
  MetaObrigatoriaItemPatrimonialError,
  QuantidadeOuValorItemPatrimonialInvalidoError,
  VersaoPropostaInvalidaError,
} from '@/domain/plano-contas/errors';

type CadastrarItemPatrimonialInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
  contaId: string;
  descricao: string;
  data: Date;
  quantidade: number;
  valorUnitario: number;
};

/**
 * US-110, Cenários 1/2 — Cadastrar Item Patrimonial. metaId é derivado
 * automaticamente da Meta 1:1 da versão (ADR-017) — obrigatório apenas quando
 * Proposta.categoria=POR_META (ADR-023); sempre null em CONSOLIDADA. Conta deve
 * ser analítica [RN_PLA_003]. Valor Total sempre calculado no servidor.
 */
export class CadastrarItemPatrimonialUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CadastrarItemPatrimonialInput): Promise<ItemPatrimonial> {
    const descricao = input.descricao?.trim() ?? '';
    if (descricao.length === 0 || descricao.length > 100 || !input.data || !input.contaId) {
      throw new CamposObrigatoriosItemPatrimonialError();
    }
    if (!input.quantidade || input.quantidade <= 0 || input.valorUnitario == null || input.valorUnitario < 0) {
      throw new QuantidadeOuValorItemPatrimonialInvalidoError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
      include: { proposta: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new VersaoPropostaInvalidaError(
        'Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida.',
      );
    }

    let metaId: string | null = null;
    if (versao.proposta.categoria === 'POR_META') {
      const meta = await this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, versaoId: input.versaoId, ativo: true } });
      if (!meta) {
        throw new MetaObrigatoriaItemPatrimonialError();
      }
      metaId = meta.id;
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
      const item = await tx.itemPatrimonial.create({
        data: {
          tenantId: input.tenantId,
          versaoId: input.versaoId,
          metaId,
          contaId: input.contaId,
          descricao,
          data: input.data,
          quantidade: input.quantidade,
          valorUnitario: input.valorUnitario,
          valorTotal,
        },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'ITEM_PATRIMONIAL_CADASTRADO',
          descricao: `Item patrimonial "${descricao}" cadastrado para a Versão ${input.versaoId}`,
          dadosSerializados: { itemPatrimonialId: item.id, versaoId: input.versaoId, valorTotal: valorTotal.toString() },
        },
      });

      return item;
    });
  }
}
