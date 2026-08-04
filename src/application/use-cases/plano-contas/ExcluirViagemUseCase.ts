import type { PrismaClient } from '@prisma/client';
import { VersaoPropostaInvalidaError, ViagemNaoEncontradaError, ViagemPropostaEmAprovacaoError } from '@/domain/plano-contas/errors';

type ExcluirViagemInput = {
  tenantId: string;
  usuarioId: string;
  viagemId: string;
};

/**
 * US-109, Cenário 5/6 — Excluir Viagem (soft delete). Bloqueada apenas se a
 * Proposta já foi enviada para aprovação (status diferente de RASCUNHO) —
 * adiantamento financeiro e diária liquidada (UC03.33) ficam fora de escopo,
 * mesmo padrão de RN0274/US-108a: módulos de Adiantamento/Liquidação não
 * existem ainda.
 */
export class ExcluirViagemUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirViagemInput): Promise<void> {
    const viagem = await this.prisma.viagem.findFirst({ where: { tenantId: input.tenantId, id: input.viagemId, ativo: true } });
    if (!viagem) {
      throw new ViagemNaoEncontradaError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: viagem.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }
    if (versao.status !== 'RASCUNHO') {
      throw new ViagemPropostaEmAprovacaoError();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.viagem.update({ where: { id: input.viagemId }, data: { ativo: false } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VIAGEM_EXCLUIDA',
          descricao: `Viagem "${viagem.descricao}" excluída`,
          dadosSerializados: { viagemId: viagem.id, versaoId: viagem.versaoId, custoEstimado: viagem.custoEstimado.toString() },
        },
      });
    });
  }
}
