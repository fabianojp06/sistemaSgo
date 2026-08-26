import { describe, expect, it, vi } from 'vitest';
import { BuscarCargoMercadoCatalogoUseCase } from './BuscarCargoMercadoCatalogoUseCase';

function criarPrismaMock() {
  return {
    cargoMercadoCatalogo: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe('BuscarCargoMercadoCatalogoUseCase [ADR-047/US-139]', () => {
  it('retorna vazio sem consultar o banco quando o termo tem menos de 2 caracteres (Cenário 5)', async () => {
    const prisma = criarPrismaMock();
    const useCase = new BuscarCargoMercadoCatalogoUseCase(prisma as never);

    const resultado = await useCase.execute('t1', 'a');

    expect(resultado).toEqual([]);
    expect(prisma.cargoMercadoCatalogo.findMany).not.toHaveBeenCalled();
  });

  it('busca por substring case-insensitive, filtrando por tenant e limitando a 20 resultados', async () => {
    const prisma = criarPrismaMock();
    prisma.cargoMercadoCatalogo.findMany.mockResolvedValue([
      { codigoOrigem: '1', nome: 'ADMINISTRADOR DE BANCO DE DADOS' },
    ]);
    const useCase = new BuscarCargoMercadoCatalogoUseCase(prisma as never);

    const resultado = await useCase.execute('t1', ' administrador ');

    expect(resultado).toEqual([{ codigoOrigem: '1', nome: 'ADMINISTRADOR DE BANCO DE DADOS' }]);
    expect(prisma.cargoMercadoCatalogo.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', nome: { contains: 'administrador', mode: 'insensitive' } },
      orderBy: { nome: 'asc' },
      take: 20,
      select: { codigoOrigem: true, nome: true },
    });
  });

  it('retorna lista vazia quando nenhum cargo corresponde ao termo', async () => {
    const prisma = criarPrismaMock();
    const useCase = new BuscarCargoMercadoCatalogoUseCase(prisma as never);

    const resultado = await useCase.execute('t1', 'termo-inexistente');

    expect(resultado).toEqual([]);
  });
});
