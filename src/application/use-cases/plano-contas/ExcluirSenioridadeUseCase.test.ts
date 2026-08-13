import { describe, expect, it, vi } from 'vitest';
import { ExcluirSenioridadeUseCase } from './ExcluirSenioridadeUseCase';
import { SenioridadeNaoEncontradaError, SenioridadePadraoNaoExcluivelError, SenioridadeReferenciadaError } from '@/domain/plano-contas/errors';

function criarPrismaMock(senioridade: { id: string; isPadrao: boolean; descricao: string } | null, temReferencia: boolean) {
  const base = {
    senioridade: {
      findFirst: vi.fn(() => Promise.resolve(senioridade)),
      update: vi.fn(() => Promise.resolve({})),
    },
    tabelaSalarial: {
      findFirst: vi.fn(() => Promise.resolve(temReferencia ? { id: 'ts-1' } : null)),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('ExcluirSenioridadeUseCase', () => {
  it('exclui Senioridade customizada sem registro vinculado', async () => {
    const base = criarPrismaMock({ id: 's1', isPadrao: false, descricao: 'Especialista' }, false);
    const useCase = new ExcluirSenioridadeUseCase(base as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', senioridadeId: 's1' });

    expect(resultado.id).toBe('s1');
    expect(base.senioridade.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { ativo: false } });
  });

  it('bloqueia exclusão de Senioridade padrão [RN_TAB_01]', async () => {
    const base = criarPrismaMock({ id: 's1', isPadrao: true, descricao: 'Sênior' }, false);
    const useCase = new ExcluirSenioridadeUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', senioridadeId: 's1' })).rejects.toThrow(
      SenioridadePadraoNaoExcluivelError,
    );
    expect(base.senioridade.update).not.toHaveBeenCalled();
  });

  it('bloqueia exclusão de Senioridade customizada com registro vinculado [RN_TAB_01]', async () => {
    const base = criarPrismaMock({ id: 's1', isPadrao: false, descricao: 'Especialista' }, true);
    const useCase = new ExcluirSenioridadeUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', senioridadeId: 's1' })).rejects.toThrow(
      SenioridadeReferenciadaError,
    );
    expect(base.senioridade.update).not.toHaveBeenCalled();
  });

  it('lança erro se a Senioridade não existir', async () => {
    const base = criarPrismaMock(null, false);
    const useCase = new ExcluirSenioridadeUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', senioridadeId: 'inexistente' })).rejects.toThrow(
      SenioridadeNaoEncontradaError,
    );
  });
});
