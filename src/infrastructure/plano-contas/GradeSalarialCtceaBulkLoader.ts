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
export class GradeSalarialCtceaBulkLoader {
  constructor(private readonly prisma: PrismaClient) {}

  async sincronizar(
    tenantId: string,
    payload: GradeSalarialCtceaPayload[],
  ): Promise<ResultadoSincronismoGradeSalarialCtcea> {
    if (payload.length === 0) {
      return { linhasProcessadas: 0 };
    }

    const valores: string[] = [];
    const parametros: unknown[] = [];
    let indice = 1;

    for (const linha of payload) {
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

    return { linhasProcessadas: payload.length };
  }
}
