import type { PrismaClient } from '@prisma/client';
import { MetaNaoEncontradaError, VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type ExcluirMetaInput = {
  tenantId: string;
  usuarioId: string;
  metaId: string;
};

/**
 * US-112, Cenário 8/9 — Excluir Meta (soft delete). Verificação de vínculo
 * operacional (headcounts/viagens por Meta) sempre retorna "sem vínculo"
 * nesta US — Empregado/Viagem ainda não têm FK para Meta.
 */
export class ExcluirMetaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirMetaInput): Promise<void> {
    const meta = await this.prisma.meta.findFirst({ where: { tenantId: input.tenantId, id: input.metaId, ativo: true } });
    if (!meta) {
      throw new MetaNaoEncontradaError();
    }

    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: meta.versaoId, ativa: true },
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
      await tx.meta.update({ where: { id: input.metaId }, data: { ativo: false } });

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'META_EXCLUIDA',
          descricao: `Meta "${meta.nome}" excluída`,
          dadosSerializados: { metaId: meta.id, versaoId: meta.versaoId, valorGlobal: meta.valorGlobal.toString() },
        },
      });
    });
  }
}
