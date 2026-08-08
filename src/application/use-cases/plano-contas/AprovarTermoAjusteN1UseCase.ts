import type { PrismaClient } from '@prisma/client';
import {
  ConflitoConcorrenciaError,
  TermoAjusteAcessoNegadoN1Error,
  TermoAjusteEstadoInvalidoError,
  TermoAjusteNaoEncontradoError,
} from '@/domain/plano-contas/errors';

type AprovarTermoAjusteN1Input = {
  tenantId: string;
  usuarioId: string;
  termoAjusteId: string;
  temPermissaoAprovarN1: boolean;
  /** US-105 — updatedAt lido pelo cliente antes de aprovar; se divergir do atual, é conflito. */
  tokenConcorrencia?: Date;
};

type AprovarTermoAjusteN1Result = {
  id: string;
  status: string;
};

/**
 * US-111, Cenário 4 (1ª etapa) — aprovação N1 do Termo de Ajuste: PENDENTE_APROVACAO_N1 ->
 * PENDENTE_APROVACAO_GESTOR_MASTER. Não move nenhum saldo — isso só acontece na homologação
 * do Gestor Master (ver HomologarTermoAjusteUseCase).
 */
export class AprovarTermoAjusteN1UseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: AprovarTermoAjusteN1Input): Promise<AprovarTermoAjusteN1Result> {
    if (!input.temPermissaoAprovarN1) {
      throw new TermoAjusteAcessoNegadoN1Error();
    }

    const termoAjuste = await this.prisma.termoAjuste.findFirst({
      where: { tenantId: input.tenantId, id: input.termoAjusteId },
    });
    if (!termoAjuste) {
      throw new TermoAjusteNaoEncontradoError();
    }
    if (termoAjuste.status !== 'PENDENTE_APROVACAO_N1') {
      throw new TermoAjusteEstadoInvalidoError(
        'Ação Negada: este Termo de Ajuste não está aguardando aprovação de 1º nível.',
      );
    }
    if (input.tokenConcorrencia && input.tokenConcorrencia.getTime() !== termoAjuste.updatedAt.getTime()) {
      throw new ConflitoConcorrenciaError();
    }

    const resultado = await this.prisma.$transaction(async (tx) => {
      const atualizacao = await tx.termoAjuste.updateMany({
        where: { id: termoAjuste.id, updatedAt: termoAjuste.updatedAt },
        data: { status: 'PENDENTE_APROVACAO_GESTOR_MASTER' },
      });
      if (atualizacao.count === 0) {
        throw new ConflitoConcorrenciaError();
      }

      await tx.historicoOperacao.create({
        data: {
          tenantId: input.tenantId,
          usuarioId: input.usuarioId,
          tipoOperacao: 'TERMO_AJUSTE_APROVADO_N1',
          descricao: `Termo de Ajuste ${termoAjuste.id} aprovado em 1º nível — aguardando homologação do Gestor Master`,
          dadosSerializados: { termoAjusteId: termoAjuste.id },
        },
      });

      return { id: termoAjuste.id, status: 'PENDENTE_APROVACAO_GESTOR_MASTER' as const };
    });

    return resultado;
  }
}
