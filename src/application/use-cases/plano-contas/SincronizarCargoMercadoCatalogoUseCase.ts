import type { Prisma, PrismaClient, TipoOperacao } from '@prisma/client';
import type { CargoMercadoProvider } from '@/infrastructure/integrations/cargo-mercado/types';
import type { CargoMercadoCatalogoBulkLoader } from '@/infrastructure/plano-contas/CargoMercadoCatalogoBulkLoader';
import type { SincronismoCargoMercadoCatalogoLockRepository } from '@/infrastructure/plano-contas/SincronismoCargoMercadoCatalogoLockRepository';
import {
  AcessoNegadoSincronismoCargoMercadoCatalogoError,
  SincronismoCargoMercadoCatalogoEmAndamentoError,
} from '@/domain/plano-contas/errors';

type SincronizarCargoMercadoCatalogoInput = {
  tenantId: string;
  usuarioId: string;
  temPermissaoAdministrativa: boolean;
  ipEstacao?: string;
};

/**
 * ADR-047 (US-139) — orquestra a sincronização do Catálogo de Cargo de
 * Mercado, mesmo padrão de SincronizarGradeSalarialCtceaUseCase: permissão
 * administrativa, lock pessimista por tenant, upsert em lote via o loader,
 * auditoria dentro do mesmo fluxo (sucesso ou erro).
 */
export class SincronizarCargoMercadoCatalogoUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: CargoMercadoProvider,
    private readonly loader: CargoMercadoCatalogoBulkLoader,
    private readonly lock: SincronismoCargoMercadoCatalogoLockRepository,
  ) {}

  async execute(input: SincronizarCargoMercadoCatalogoInput): Promise<{ linhasProcessadas: number }> {
    if (!input.temPermissaoAdministrativa) {
      throw new AcessoNegadoSincronismoCargoMercadoCatalogoError();
    }

    const adquiriu = await this.lock.tentarAdquirir(input.tenantId, input.usuarioId);
    if (!adquiriu) {
      throw new SincronismoCargoMercadoCatalogoEmAndamentoError();
    }

    try {
      const payload = await this.provider.buscarCatalogoAtivo();
      const resultado = await this.loader.sincronizar(input.tenantId, payload);

      await this.registrarAuditoria(input, 'SYNC_CARGO_MERCADO_CATALOGO' as TipoOperacao, {
        linhasProcessadas: resultado.linhasProcessadas,
      });

      return resultado;
    } catch (erro) {
      await this.registrarAuditoria(input, 'SYNC_CARGO_MERCADO_CATALOGO' as TipoOperacao, {
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
      });
      throw erro;
    } finally {
      await this.lock.liberar(input.tenantId);
    }
  }

  private async registrarAuditoria(
    input: SincronizarCargoMercadoCatalogoInput,
    tipoOperacao: TipoOperacao,
    dados: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.historicoOperacao.create({
      data: {
        tenantId: input.tenantId,
        usuarioId: input.usuarioId,
        tipoOperacao,
        descricao: 'Sincronismo do Catálogo de Cargo de Mercado com fonte externa',
        ipEstacao: input.ipEstacao,
        dadosSerializados: dados,
      },
    });
  }
}
