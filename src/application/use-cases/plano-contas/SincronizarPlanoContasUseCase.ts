import type { Prisma, PrismaClient, TipoOperacao } from '@prisma/client';
import type { PlanoContasFixtureProvider } from '@/infrastructure/integrations/senior/PlanoContasFixtureProvider';
import type { PlanoContasBulkLoader } from '@/infrastructure/plano-contas/PlanoContasBulkLoader';
import type { SincronismoLockRepository } from '@/infrastructure/plano-contas/SincronismoLockRepository';
import { AcessoNegadoSincronismoError, SincronismoEmAndamentoError } from '@/domain/plano-contas/errors';

type SincronizarPlanoContasInput = {
  tenantId: string;
  usuarioId: string;
  temPermissaoAdministrativa: boolean;
  ipEstacao?: string;
};

/**
 * Orquestra o Fluxo Principal do UC03.00. Fonte dos dados é o
 * PlanoContasFixtureProvider (cenário de teste, sem ERP real) — a troca por
 * integração real do ERP Senior não muda este use case, só a implementação do
 * provider injetado.
 */
export class SincronizarPlanoContasUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: PlanoContasFixtureProvider,
    private readonly loader: PlanoContasBulkLoader,
    private readonly lock: SincronismoLockRepository,
  ) {}

  async execute(input: SincronizarPlanoContasInput): Promise<{ contasProcessadas: number }> {
    if (!input.temPermissaoAdministrativa) {
      throw new AcessoNegadoSincronismoError();
    }

    const adquiriu = await this.lock.tentarAdquirir(input.tenantId, input.usuarioId);
    if (!adquiriu) {
      throw new SincronismoEmAndamentoError();
    }

    try {
      const payload = await this.provider.buscarContasAtivas();
      const resultado = await this.loader.sincronizar(input.tenantId, payload);

      await this.registrarAuditoria(input, 'SYNC_PLANO_CONTAS' as TipoOperacao, {
        contasProcessadas: resultado.contasProcessadas,
      });

      return resultado;
    } catch (erro) {
      await this.registrarAuditoria(input, 'SYNC_PLANO_CONTAS' as TipoOperacao, {
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
      });
      throw erro;
    } finally {
      await this.lock.liberar(input.tenantId);
    }
  }

  private async registrarAuditoria(
    input: SincronizarPlanoContasInput,
    tipoOperacao: TipoOperacao,
    dados: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.historicoOperacao.create({
      data: {
        tenantId: input.tenantId,
        usuarioId: input.usuarioId,
        tipoOperacao,
        descricao: 'Sincronismo do Plano de Contas Único com fonte externa',
        ipEstacao: input.ipEstacao,
        dadosSerializados: dados,
      },
    });
  }
}
