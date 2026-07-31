import type { PrismaClient } from '@prisma/client';
import {
  ExclusaoCicloVidaInvalidoError,
  VersaoPropostaInvalidaError,
  VersaoUnicaNaoPodeSerExcluidaError,
  VinculosAtivosImpedemExclusaoError,
} from '@/domain/plano-contas/errors';

type ExcluirVersaoPropostaInput = {
  tenantId: string;
  usuarioId: string;
  versaoId: string;
};

/**
 * US-103 — Excluir Versão da Proposta (soft delete via `ativa=false`, nunca
 * DELETE físico). Ordem de validação [ADR/Tech Lead]: ciclo de vida → única
 * versão ativa → vínculos operacionais — nessa ordem, para que a mensagem de
 * erro nunca sugira "remova os vínculos" quando o bloqueio real é "é a única
 * versão", que nenhuma remoção de vínculo resolveria.
 */
export class ExcluirVersaoPropostaUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: ExcluirVersaoPropostaInput): Promise<void> {
    const versao = await this.prisma.versaoProposta.findFirst({
      where: { tenantId: input.tenantId, id: input.versaoId, ativa: true },
    });
    if (!versao) {
      throw new VersaoPropostaInvalidaError('Versão de Proposta não encontrada.');
    }

    if (versao.status !== 'RASCUNHO' && versao.status !== 'EM_ELABORACAO') {
      throw new ExclusaoCicloVidaInvalidoError();
    }

    const versoesAtivas = await this.prisma.versaoProposta.count({
      where: { tenantId: input.tenantId, propostaId: versao.propostaId, ativa: true },
    });
    if (versoesAtivas <= 1) {
      throw new VersaoUnicaNaoPodeSerExcluidaError();
    }

    const [totalValoresOrcados, totalRateiosImposto] = await Promise.all([
      this.prisma.valorOrcadoConta.count({ where: { tenantId: input.tenantId, versaoId: input.versaoId } }),
      this.prisma.rateioImpostoGrade.count({ where: { tenantId: input.tenantId, versaoId: input.versaoId } }),
    ]);
    if (totalValoresOrcados > 0 || totalRateiosImposto > 0) {
      throw new VinculosAtivosImpedemExclusaoError();
    }

    await this.prisma.$transaction([
      this.prisma.versaoProposta.update({
        where: { id: versao.id },
        data: { ativa: false },
      }),
      this.prisma.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'VERSAO_PROPOSTA_EXCLUIDA',
          descricao: `Versão ${versao.numeroVersao} da Proposta excluída (soft delete)`,
          dadosSerializados: { versaoRemovida: versao },
        },
      }),
    ]);
  }
}
