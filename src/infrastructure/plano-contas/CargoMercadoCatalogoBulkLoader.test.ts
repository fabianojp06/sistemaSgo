import { describe, expect, it, vi } from 'vitest';
import { CargoMercadoCatalogoBulkLoader } from './CargoMercadoCatalogoBulkLoader';
import type { CargoMercadoPayload } from '@/infrastructure/integrations/cargo-mercado/types';

function criarPrismaMock() {
  const prisma = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  };
  return prisma;
}

describe('CargoMercadoCatalogoBulkLoader [ADR-047/US-139]', () => {
  it('não executa nada quando o payload está vazio', async () => {
    const prisma = criarPrismaMock();
    const loader = new CargoMercadoCatalogoBulkLoader(prisma as never);

    const resultado = await loader.sincronizar('tenant-1', []);

    expect(resultado.linhasProcessadas).toBe(0);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('monta um único INSERT ... ON CONFLICT em lote com upsert (Cenário 4)', async () => {
    const prisma = criarPrismaMock();
    const loader = new CargoMercadoCatalogoBulkLoader(prisma as never);

    const payload: CargoMercadoPayload[] = [
      { codigoOrigem: '1', nome: 'ADMINISTRADOR DE BANCO DE DADOS' },
      { codigoOrigem: '2', nome: 'ADMINISTRADOR DE REDES' },
    ];

    const resultado = await loader.sincronizar('tenant-1', payload);

    expect(resultado.linhasProcessadas).toBe(2);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, ...parametros] = prisma.$executeRawUnsafe.mock.calls[0];
    expect(sql).toContain('INSERT INTO "CargoMercadoCatalogo"');
    expect(sql).toContain('ON CONFLICT ("tenantId", "codigoOrigem")');
    expect(sql).toContain('DO UPDATE SET "nome" = EXCLUDED."nome", "syncedAt" = now()');

    expect(parametros).toEqual([
      'tenant-1',
      '1',
      'ADMINISTRADOR DE BANCO DE DADOS',
      'tenant-1',
      '2',
      'ADMINISTRADOR DE REDES',
    ]);
  });

  it('divide em múltiplos lotes quando o payload excede o limite por statement', async () => {
    const prisma = criarPrismaMock();
    const loader = new CargoMercadoCatalogoBulkLoader(prisma as never);

    const payload: CargoMercadoPayload[] = Array.from({ length: 2001 }, (_, i) => ({
      codigoOrigem: String(i),
      nome: `CARGO ${i}`,
    }));

    const resultado = await loader.sincronizar('tenant-1', payload);

    expect(resultado.linhasProcessadas).toBe(2001);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
