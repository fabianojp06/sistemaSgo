import type { PrismaClient } from '@prisma/client';
import {
  ConflitoConcorrenciaError,
  TermoAjusteAcessoNegadoGestorMasterError,
  TermoAjusteAcessoNegadoN1Error,
  TermoAjusteEstadoInvalidoError,
  TermoAjusteNaoEncontradoError,
} from '@/domain/plano-contas/errors';

type RejeitarTermoAjusteInput = {
  tenantId: string;
  usuarioId: string;
  termoAjusteId: string;
  temPermissaoAprovarN1: boolean;
  temPermissaoGestorMaster: boolean;
  /** US-105 — updatedAt do TermoAjuste lido pelo cliente antes de rejeitar. */
  tokenConcorrencia?: Date;
};

type RejeitarTermoAjusteResult = {
  id: string;
  status: string;
};

/**
 * US-111 — rejeição do Termo de Ajuste, disponível em qualquer etapa de aprovação
 * pendente (N1 ou Gestor Master). Nunca move saldo — o débito/crédito só acontece na
 * homologação (HomologarTermoAjusteUseCase), então rejeitar antes disso não exige estorno.
 */
export class RejeitarTermoAjusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: RejeitarTermoAjusteInput): Promise<RejeitarTermoAjusteResult> {
    const termoAjuste = await this.prisma.termoAjuste.findFirst({
      where: { tenantId: input.tenantId, id: input.termoAjusteId },
    });
    if (!termoAjuste) {
      throw new TermoAjusteNaoEncontradoError();
    }

    if (termoAjuste.status === 'PENDENTE_APROVACAO_N1' && !input.temPermissaoAprovarN1) {
      throw new TermoAjusteAcessoNegadoN1Error();
    }
    if (termoAjuste.status === 'PENDENTE_APROVACAO_GESTOR_MASTER' && !input.temPermissaoGestorMaster) {
      throw new TermoAjusteAcessoNegadoGestorMasterError();
    }
    if (termoAjuste.status !== 'PENDENTE_APROVACAO_N1' && termoAjuste.status !== 'PENDENTE_APROVACAO_GESTOR_MASTER') {
      throw new TermoAjusteEstadoInvalidoError(
        'Ação Negada [TRAVA O ERRO]: este Termo de Ajuste já foi homologado ou rejeitado.',
      );
    }
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== termoAjuste.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    await this.prisma.$transaction(async (tx) => {
      const atualizacao = await tx.termoAjuste.updateMany({
        where: { id: termoAjuste.id, updatedAt: termoAjuste.updatedAt },
        data: { status: 'REJEITADO' },
      });
      if (atualizacao.count === 0) {
        throw new ConflitoConcorrenciaError();
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TERMO_AJUSTE_REJEITADO',
          descricao: `Termo de Ajuste ${termoAjuste.id} rejeitado (estava em ${termoAjuste.status})`,
          dadosSerializados: { termoAjusteId: termoAjuste.id, statusAnterior: termoAjuste.status },
        },
      });
    });

    return { id: termoAjuste.id, status: 'REJEITADO' };
  }
}
