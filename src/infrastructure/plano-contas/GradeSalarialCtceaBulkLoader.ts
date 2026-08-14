import type { PrismaClient } from '@prisma/client';
import type { GradeSalarialCtceaPayload } from '@/infrastructure/integrations/ctcea/types';

export type ResultadoSincronismoGradeSalarialCtcea = {
  linhasProcessadas: number;
};

/**
 * ADR-046 (US-137) — único ponto de escrita em GradeSalarialCtcea. Diferente do
 * PlanoContasBulkLoader, a grade é PLANA (sem hierarquia pai/filho) — um único
 * upsert em lote via `$executeRaw` resolve tudo, sem 2 passes de resolução.
 *
 * O `DO UPDATE` só toca `salario`/`syncedAt` — nunca `cargoMercado`/`cargoCtcea`,
 * preservando parametrização local já preenchida manualmente (Cenário 2 da
 * US-137, mesmo espírito do Cenário 2 da US-001).
 */
// Postgres aceita até 65535 parâmetros por statement — 4 por linha, então até
// ~16k linhas por lote. 2.000 é uma margem folgada para o tamanho atual (140
// linhas) sem se aproximar do limite se a grade crescer bastante no futuro.
const LINHAS_POR_LOTE = 2000;

export class GradeSalarialCtceaBulkLoader {
  constructor(private readonly prisma: PrismaClient) {}

  async sincronizar(
    tenantId: string,
    payload: GradeSalarialCtceaPayload[],
  ): Promise<ResultadoSincronismoGradeSalarialCtcea> {
    if (payload.length === 0) {
      return { linhasProcessadas: 0 };
    }

    for (let inicio = 0; inicio < payload.length; inicio += LINHAS_POR_LOTE) {
      const lote = payload.slice(inicio, inicio + LINHAS_POR_LOTE);

      const valores: string[] = [];
      const parametros: unknown[] = [];
      let indice = 1;

      for (const linha of lote) {
        valores.push(`(gen_random_uuid(), $${indice++}, $${indice++}, $${indice++}, $${indice++}, now())`);
        parametros.push(tenantId, linha.faixa, linha.nivel, linha.salario);
      }

      const sql = `
        INSERT INTO "GradeSalarialCtcea" ("id", "tenantId", "faixa", "nivel", "salario", "syncedAt")
        VALUES ${valores.join(', ')}
        ON CONFLICT ("tenantId", "faixa", "nivel")
        DO UPDATE SET "salario" = EXCLUDED."salario", "syncedAt" = now()
      `;

      await this.prisma.$executeRawUnsafe(sql, ...parametros);
    }

    return { linhasProcessadas: payload.length };
  }
}
