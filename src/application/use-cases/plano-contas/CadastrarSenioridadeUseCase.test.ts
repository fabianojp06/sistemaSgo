import { describe, expect, it, vi } from 'vitest';
import { CadastrarSenioridadeUseCase } from './CadastrarSenioridadeUseCase';
import { SenioridadeNomeDuplicadoError } from '@/domain/plano-contas/errors';

function criarPrismaMock(duplicada: boolean) {
  const base = {
    senioridade: {
      findFirst: vi.fn(() => Promise.resolve(duplicada ? { id: 's-existente' } : null)),
      create: vi.fn(({ data }: { data: { descricao: string; isPadrao: boolean } }) =>
        Promise.resolve({ id: 'nova', ...data }),
      ),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('CadastrarSenioridadeUseCase', () => {
  it('cadastra uma Senioridade customizada (isPadrao=false) [Cenário 3]', async () => {
    const base = criarPrismaMock(false);
    const useCase = new CadastrarSenioridadeUseCase(base as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', descricao: 'Especialista' });

    expect(resultado.descricao).toBe('Especialista');
    expect(resultado.isPadrao).toBe(false);
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('bloqueia nome duplicado (case-insensitive)', async () => {
    const base = criarPrismaMock(true);
    const useCase = new CadastrarSenioridadeUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', descricao: 'especialista' })).rejects.toThrow(
      SenioridadeNomeDuplicadoError,
    );
    expect(base.senioridade.create).not.toHaveBeenCalled();
  });
});
