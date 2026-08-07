import type { PrismaClient, VersaoProposta } from '@prisma/client';
import { VersaoPropostaInvalidaError, VersaoJaVigenteError } from '@/domain/plano-contas/errors';

type RestaurarVersaoPropostaInput = {
  tenantId: string;
  usuarioId: string;
  propostaId: string;
  versaoRestauradaId: string;
};

/**
 * US-120/ADR-034 — restaura uma versão antiga como vigente, sem copiar dados
 * (diferente de CriarVersaoPropostaUseCase). A versão-alvo mantém seu
 * numeroVersao original; apenas a flag `vigente` é reposicionada. Reativa
 * incondicionalmente (`ativa=true`) se a versão-alvo estava excluída
 * (US-103) — restaurar uma versão excluída sem reativá-la não teria efeito
 * prático.
 */
export class RestaurarVersaoPropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: RestaurarVersaoPropostaInput): Promise<VersaoProposta> {
    const versaoRestaurada = await this.prisma.versaoProposta.findFirst({
      where: { id: input.versaoRestauradaId, tenantId: input.tenantId, propostaId: input.propostaId },
    });
    if (!versaoRestaurada) {
      throw new VersaoPropostaInvalidaError('Versão não encontrada para esta Proposta.');
    }
    if (versaoRestaurada.vigente) {
      throw new VersaoJaVigenteError();
    }

    const versaoVigenteAtual = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, propostaId: input.propostaId, vigente: true, ativa: true },
    });

    return this.prisma.$transaction(async (tx) => {
      if (versaoVigenteAtual) {
        await tx.versaoProposta.update({
          where: { id: versaoVigenteAtual.id },
          data: { vigente: false },
        });
      }

      const versaoRestauradaAtualizada = await tx.versaoProposta.update({
        where: { id: versaoRestaurada.id },
        data: { vigente: true, ativa: true },
      });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VERSAO_PROPOSTA_RESTAURADA',
          descricao: `Versão ${versaoRestauradaAtualizada.numeroVersao} restaurada como vigente`,
          dadosSerializados: {
            propostaId: input.propostaId,
            versaoRestauradaId: versaoRestaurada.id,
            versaoAnteriorId: versaoVigenteAtual?.id ?? null,
          },
        },
      });

      return versaoRestauradaAtualizada;
    });
  }
}
