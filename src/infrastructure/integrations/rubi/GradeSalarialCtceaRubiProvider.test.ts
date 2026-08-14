import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { GradeSalarialCtceaRubiProvider } from './GradeSalarialCtceaRubiProvider';

function criarPrismaMock(linhas: unknown[]) {
  return {
    gradeSalarialCtcea: {
      findMany: vi.fn().mockResolvedValue(linhas),
    },
  };
}

describe('GradeSalarialCtceaRubiProvider [ADR-046/US-137]', () => {
  it('filtra por faixa e nível quando informados (busca exata)', async () => {
    const prisma = criarPrismaMock([
      { faixa: 'F1', nivel: 'N1', salario: new Prisma.Decimal('1570.98'), cargoMercado: null, cargoCtcea: null },
    ]);
    const provider = new GradeSalarialCtceaRubiProvider(prisma as never);

    const candidatos = await provider.buscarCandidatos({ tenantId: 't1', faixa: 'F1', nivel: 'N1' });

    expect(prisma.gradeSalarialCtcea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1', faixa: 'F1', nivel: 'N1' }) }),
    );
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].faixaCodigo).toBe('F1');
    expect(candidatos[0].nivelCodigo).toBe('N1');
    expect(candidatos[0].salarioReal.toString()).toBe('1570.98');
  });

  it('usa placeholder quando cargoMercado ainda é null (Cenário 4)', async () => {
    const prisma = criarPrismaMock([
      { faixa: 'F2', nivel: 'N5', salario: new Prisma.Decimal('2924.86'), cargoMercado: null, cargoCtcea: null },
    ]);
    const provider = new GradeSalarialCtceaRubiProvider(prisma as never);

    const candidatos = await provider.buscarCandidatos({ tenantId: 't1', faixa: 'F2', nivel: 'N5' });

    expect(candidatos[0].nomeCargoMercado).toBe('(sem nome cadastrado)');
    expect(candidatos[0].tabSalCodigo).toBe('F2');
  });

  it('mapeia cargoMercado/cargoCtcea quando já preenchidos pela 2ª fonte', async () => {
    const prisma = criarPrismaMock([
      {
        faixa: 'F3',
        nivel: 'N10',
        salario: new Prisma.Decimal('6266.49'),
        cargoMercado: 'Analista de Sistemas Pleno',
        cargoCtcea: 'ANL-SIS-PL',
      },
    ]);
    const provider = new GradeSalarialCtceaRubiProvider(prisma as never);

    const candidatos = await provider.buscarCandidatos({ tenantId: 't1', termo: 'Analista' });

    expect(candidatos[0].nomeCargoMercado).toBe('Analista de Sistemas Pleno');
    expect(candidatos[0].tabSalCodigo).toBe('ANL-SIS-PL');
    expect(candidatos[0].tabSalDescricao).toBe('Cargo CTCEA: ANL-SIS-PL');
  });

  it('busca por termo via ILIKE em cargoMercado/cargoCtcea quando informado', async () => {
    const prisma = criarPrismaMock([]);
    const provider = new GradeSalarialCtceaRubiProvider(prisma as never);

    await provider.buscarCandidatos({ tenantId: 't1', termo: 'analista' });

    const chamada = prisma.gradeSalarialCtcea.findMany.mock.calls[0][0];
    expect(chamada.where.OR).toEqual([
      { cargoMercado: { contains: 'analista', mode: 'insensitive' } },
      { cargoCtcea: { contains: 'analista', mode: 'insensitive' } },
    ]);
  });

  it('combina faixa/nivel e termo na mesma busca', async () => {
    const prisma = criarPrismaMock([]);
    const provider = new GradeSalarialCtceaRubiProvider(prisma as never);

    await provider.buscarCandidatos({ tenantId: 't1', faixa: 'F1', nivel: 'N1', termo: 'analista' });

    const chamada = prisma.gradeSalarialCtcea.findMany.mock.calls[0][0];
    expect(chamada.where).toEqual(
      expect.objectContaining({ tenantId: 't1', faixa: 'F1', nivel: 'N1', OR: expect.any(Array) }),
    );
  });
});
