import type { Prisma, PrismaClient, TipoOperacao } from '@prisma/client';
import type { GradeSalarialCtceaProvider } from '@/infrastructure/integrations/ctcea/types';
import type { GradeSalarialCtceaBulkLoader } from '@/infrastructure/plano-contas/GradeSalarialCtceaBulkLoader';
import type { SincronismoGradeSalarialCtceaLockRepository } from '@/infrastructure/plano-contas/SincronismoGradeSalarialCtceaLockRepository';
import {
  AcessoNegadoSincronismoGradeSalarialCtceaError,
  SincronismoGradeSalarialCtceaEmAndamentoError,
} from '@/domain/plano-contas/errors';

type SincronizarGradeSalarialCtceaInput = {
  tenantId: string;
  usuarioId: string;
  temPermissaoAdministrativa: boolean;
  ipEstacao?: string;
};

/**
 * ADR-046 (US-137) — orquestra a sincronização da Grade Salarial CTCEA, mesmo
 * padrão de SincronizarPlanoContasUseCase: permissão administrativa, lock
 * pessimista por tenant, upsert em lote via o loader, auditoria dentro do
 * mesmo fluxo (sucesso ou erro).
 */
export class SincronizarGradeSalarialCtceaUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: GradeSalarialCtceaProvider,
    private readonly loader: GradeSalarialCtceaBulkLoader,
    private readonly lock: SincronismoGradeSalarialCtceaLockRepository,
  ) {}

  async execute(input: SincronizarGradeSalarialCtceaInput): Promise<{ linhasProcessadas: number }> {
    if (!input.temPermissaoAdministrativa) {
      throw new AcessoNegadoSincronismoGradeSalarialCtceaError();
    }

    const adquiriu = await this.lock.tentarAdquirir(input.tenantId, input.usuarioId);
    if (!adquiriu) {
      throw new SincronismoGradeSalarialCtceaEmAndamentoError();
    }

    try {
      const payload = await this.provider.buscarGradeAtiva();
      const resultado = await this.loader.sincronizar(input.tenantId, payload);

      await this.registrarAuditoria(input, 'SYNC_GRADE_SALARIAL_CTCEA' as TipoOperacao, {
        linhasProcessadas: resultado.linhasProcessadas,
      });

      return resultado;
    } catch (erro) {
      await this.registrarAuditoria(input, 'SYNC_GRADE_SALARIAL_CTCEA' as TipoOperacao, {
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
      });
      throw erro;
    } finally {
      await this.lock.liberar(input.tenantId);
    }
  }

  private async registrarAuditoria(
    input: SincronizarGradeSalarialCtceaInput,
    tipoOperacao: TipoOperacao,
    dados: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.historicoOperacao.create({
      data: {
        tenantId: input.tenantId,
        usuarioId: input.usuarioId,
        tipoOperacao,
        descricao: 'Sincronismo da Grade Salarial CTCEA com fonte externa',
        ipEstacao: input.ipEstacao,
        dadosSerializados: dados,
      },
    });
  }
}
