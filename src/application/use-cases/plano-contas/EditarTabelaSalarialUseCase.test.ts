import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarTabelaSalarialUseCase } from './EditarTabelaSalarialUseCase';
import { SalarioMinimoMaiorIgualMaximoError, TabelaSalarialNaoEncontradaError } from '@/domain/plano-contas/errors';

function criarPrismaMock(existe: boolean) {
  const base = {
    tabelaSalarial: {
      findFirst: vi.fn(() =>
        Promise.resolve(
          existe
            ? { id: 'ts-1', tenantId: 't1', salarioMinimo: new Prisma.Decimal('6000'), salarioMaximo: new Prisma.Decimal('9000') }
            : null,
        ),
      ),
      update: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'ts-1', ...data })),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const inputBase = { tenantId: 't1', usuarioId: 'u1', tabelaSalarialId: 'ts-1' };

describe('EditarTabelaSalarialUseCase', () => {
  it('edita Mín/Máx de um registro existente', async () => {
    const base = criarPrismaMock(true);
    const useCase = new EditarTabelaSalarialUseCase(base as never);

    const resultado = await useCase.execute({ ...inputBase, salarioMinimo: '6800.00', salarioMaximo: '9500.00' });

    expect(resultado.id).toBe('ts-1');
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('bloqueia Salário Mínimo >= Salário Máximo [TRAVA O ERRO]', async () => {
    const base = criarPrismaMock(true);
    const useCase = new EditarTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, salarioMinimo: '9000.00', salarioMaximo: '8000.00' })).rejects.toThrow(
      SalarioMinimoMaiorIgualMaximoError,
    );
    expect(base.tabelaSalarial.update).not.toHaveBeenCalled();
  });

  it('lança erro se o registro não existir', async () => {
    const base = criarPrismaMock(false);
    const useCase = new EditarTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, salarioMinimo: '1000', salarioMaximo: '2000' })).rejects.toThrow(
      TabelaSalarialNaoEncontradaError,
    );
  });
});
