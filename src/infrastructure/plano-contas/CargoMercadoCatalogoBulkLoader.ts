import type { PrismaClient } from '@prisma/client';
import type { CargoMercadoPayload } from '@/infrastructure/integrations/cargo-mercado/types';

export type ResultadoSincronismoCargoMercadoCatalogo = {
  linhasProcessadas: number;
};

/**
 * ADR-047 (US-139) — único ponto de escrita em CargoMercadoCatalogo. Catálogo
 * PLANO (sem hierarquia), mesmo padrão de GradeSalarialCtceaBulkLoader: upsert
 * em lote via `$executeRaw`, chunked para nunca aproximar do limite de 65535
 * parâmetros por statement do Postgres.
 *
 * O `DO UPDATE` só toca `nome`/`syncedAt` — a chave de conflito é
 * (tenantId, codigoOrigem).
 */
const LINHAS_POR_LOTE = 2000;

export class CargoMercadoCatalogoBulkLoader {
  constructor(private readonly prisma: PrismaClient) {}

  async sincronizar(
    tenantId: string,
    payload: CargoMercadoPayload[],
  ): Promise<ResultadoSincronismoCargoMercadoCatalogo> {
    if (payload.length === 0) {
      return { linhasProcessadas: 0 };
    }

    for (let inicio = 0; inicio < payload.length; inicio += LINHAS_POR_LOTE) {
      const lote = payload.slice(inicio, inicio + LINHAS_POR_LOTE);

      const valores: string[] = [];
      const parametros: unknown[] = [];
      let indice = 1;

      for (const linha of lote) {
        valores.push(`(gen_random_uuid(), $${indice++}, $${indice++}, $${indice++}, now())`);
        parametros.push(tenantId, linha.codigoOrigem, linha.nome);
      }

      const sql = `
        INSERT INTO "CargoMercadoCatalogo" ("id", "tenantId", "codigoOrigem", "nome", "syncedAt")
        VALUES ${valores.join(', ')}
        ON CONFLICT ("tenantId", "codigoOrigem")
        DO UPDATE SET "nome" = EXCLUDED."nome", "syncedAt" = now()
      `;

      await this.prisma.$executeRawUnsafe(sql, ...parametros);
    }

    return { linhasProcessadas: payload.length };
  }
}
