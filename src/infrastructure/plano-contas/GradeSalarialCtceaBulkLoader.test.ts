import { describe, expect, it, vi } from 'vitest';
import { GradeSalarialCtceaBulkLoader } from './GradeSalarialCtceaBulkLoader';
import type { GradeSalarialCtceaPayload } from '@/infrastructure/integrations/ctcea/types';

function criarPrismaMock() {
  const prisma = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  };
  return prisma;
}

describe('GradeSalarialCtceaBulkLoader [ADR-046/US-137]', () => {
  it('não executa nada quando o payload está vazio', async () => {
    const prisma = criarPrismaMock();
    const loader = new GradeSalarialCtceaBulkLoader(prisma as never);

    const resultado = await loader.sincronizar('tenant-1', []);

    expect(resultado.linhasProcessadas).toBe(0);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('monta um único INSERT ... ON CONFLICT em lote com upsert (Cenário 1)', async () => {
    const prisma = criarPrismaMock();
    const loader = new GradeSalarialCtceaBulkLoader(prisma as never);

    const payload: GradeSalarialCtceaPayload[] = [
      { faixa: 'F1', nivel: 'N1', salario: 1570.98 },
      { faixa: 'F1', nivel: 'N2', salario: 1627.09 },
    ];

    const resultado = await loader.sincronizar('tenant-1', payload);

    expect(resultado.linhasProcessadas).toBe(2);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, ...parametros] = prisma.$executeRawUnsafe.mock.calls[0];
    expect(sql).toContain('INSERT INTO "GradeSalarialCtcea"');
    expect(sql).toContain('ON CONFLICT ("tenantId", "faixa", "nivel")');
    expect(sql).toContain('DO UPDATE SET "salario" = EXCLUDED."salario", "syncedAt" = now()');
    // não toca cargoMercado/cargoCtcea no DO UPDATE, preservando parametrização local (Cenário 2).
    expect(sql).not.toContain('cargoMercado');
    expect(sql).not.toContain('cargoCtcea');

    expect(parametros).toEqual(['tenant-1', 'F1', 'N1', 1570.98, 'tenant-1', 'F1', 'N2', 1627.09]);
  });
});
