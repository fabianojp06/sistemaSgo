import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExcluirTabelaSalarialUseCase } from './ExcluirTabelaSalarialUseCase';
import { TabelaSalarialNaoEncontradaError } from '@/domain/plano-contas/errors';

function criarPrismaMock(existe: boolean) {
  const base = {
    tabelaSalarial: {
      findFirst: vi.fn(() =>
        Promise.resolve(
          existe
            ? {
                id: 'ts-1',
                tenantId: 't1',
                cargoId: 'c1',
                senioridadeId: 's1',
                salarioMinimo: new Prisma.Decimal('6000'),
                salarioMaximo: new Prisma.Decimal('9000'),
              }
            : null,
        ),
      ),
      delete: vi.fn(() => Promise.resolve({})),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('ExcluirTabelaSalarialUseCase', () => {
  it('exclui fisicamente o registro', async () => {
    const base = criarPrismaMock(true);
    const useCase = new ExcluirTabelaSalarialUseCase(base as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', tabelaSalarialId: 'ts-1' });

    expect(resultado.id).toBe('ts-1');
    expect(base.tabelaSalarial.delete).toHaveBeenCalledWith({ where: { id: 'ts-1' } });
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('lança erro se o registro não existir', async () => {
    const base = criarPrismaMock(false);
    const useCase = new ExcluirTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', tabelaSalarialId: 'inexistente' })).rejects.toThrow(
      TabelaSalarialNaoEncontradaError,
    );
  });
});
