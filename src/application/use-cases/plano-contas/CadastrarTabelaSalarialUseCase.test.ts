import { describe, expect, it, vi } from 'vitest';
import { CadastrarTabelaSalarialUseCase } from './CadastrarTabelaSalarialUseCase';
import { CargoNaoEncontradoError, SalarioMinimoMaiorIgualMaximoError, SenioridadeNaoEncontradaError } from '@/domain/plano-contas/errors';

function criarPrismaMock(cargoExiste: boolean, senioridadeExiste: boolean) {
  const base = {
    cargo: {
      findFirst: vi.fn(() => Promise.resolve(cargoExiste ? { id: 'c1' } : null)),
    },
    senioridade: {
      findFirst: vi.fn(() => Promise.resolve(senioridadeExiste ? { id: 's1', descricao: 'Sênior' } : null)),
    },
    tabelaSalarial: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'ts-1', ...data })),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const inputBase = { tenantId: 't1', usuarioId: 'u1', cargoId: 'c1', senioridadeId: 's1' };

describe('CadastrarTabelaSalarialUseCase', () => {
  it('cadastra a faixa salarial [Cenário 1]', async () => {
    const base = criarPrismaMock(true, true);
    const useCase = new CadastrarTabelaSalarialUseCase(base as never);

    const resultado = await useCase.execute({ ...inputBase, salarioMinimo: '6500.00', salarioMaximo: '9200.00' });

    expect(resultado.id).toBe('ts-1');
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('bloqueia Salário Mínimo >= Salário Máximo [Cenário 2, TRAVA O ERRO]', async () => {
    const base = criarPrismaMock(true, true);
    const useCase = new CadastrarTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, salarioMinimo: '9000.00', salarioMaximo: '8500.00' })).rejects.toThrow(
      SalarioMinimoMaiorIgualMaximoError,
    );
    expect(base.tabelaSalarial.create).not.toHaveBeenCalled();
  });

  it('bloqueia Salário Mínimo igual ao Máximo (limite estrito)', async () => {
    const base = criarPrismaMock(true, true);
    const useCase = new CadastrarTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, salarioMinimo: '8000.00', salarioMaximo: '8000.00' })).rejects.toThrow(
      SalarioMinimoMaiorIgualMaximoError,
    );
  });

  it('lança erro se o Cargo não existir', async () => {
    const base = criarPrismaMock(false, true);
    const useCase = new CadastrarTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, salarioMinimo: '1000', salarioMaximo: '2000' })).rejects.toThrow(
      CargoNaoEncontradoError,
    );
  });

  it('lança erro se a Senioridade não existir', async () => {
    const base = criarPrismaMock(true, false);
    const useCase = new CadastrarTabelaSalarialUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, salarioMinimo: '1000', salarioMaximo: '2000' })).rejects.toThrow(
      SenioridadeNaoEncontradaError,
    );
  });
});
