import type { PrismaClient, VersaoProposta } from '@prisma/client';
import { VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type CriarVersaoPropostaInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  descricao?: string;
};

/**
 * US-007, Cenário 4 — nova versão de uma Proposta nasce copiando os valores
 * orçados da versão de origem (vigente), que permanece intacta e consultável.
 * Não reimplementa o fluxo completo de UC03.24 (Duplicar/Criar Versão) — apenas
 * o necessário para a cópia de ValorOrcadoConta exigida pela US-007.
 */
export class CriarVersaoPropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: CriarVersaoPropostaInput): Promise<VersaoProposta> {
    const versaoOrigem = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, propostaId: input.propostaId, vigente: true, ativa: true },
    });
    if (!versaoOrigem) {
      throw new VersaoPropostaInvalidaError('Proposta não possui versão vigente para servir de origem.');
    }

    const valoresOrigem = await this.prisma.valorOrcadoConta.findMany({
      where: { tenantId: input.tenantId, versaoId: versaoOrigem.id },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.versaoProposta.update({
        where: { id: versaoOrigem.id },
        data: { vigente: false },
      });

      const novaVersao = await tx.versaoProposta.create({
        data: {
          tenantId: input.tenantId,
          propostaId: input.propostaId,
          numeroVersao: versaoOrigem.numeroVersao + 1,
          descricao: input.descricao,
          status: 'RASCUNHO',
          vigente: true,
          createdBy: input.usuarioId,
        },
      });

      if (valoresOrigem.length > 0) {
        await tx.valorOrcadoConta.createMany({
          data: valoresOrigem.map((v) => ({
            tenantId: input.tenantId,
            versaoId: novaVersao.id,
            contaId: v.contaId,
            exercicio: v.exercicio,
            valor: v.valor,
          })),
        });
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VERSAO_PROPOSTA_CRIADA',
          descricao: `Versão ${novaVersao.numeroVersao} criada a partir da versão ${versaoOrigem.numeroVersao}`,
          dadosSerializados: {
            propostaId: input.propostaId,
            versaoOrigemId: versaoOrigem.id,
            versaoNovaId: novaVersao.id,
            valoresCopiados: valoresOrigem.length,
          },
        },
      });

      return novaVersao;
    });
  }
}
