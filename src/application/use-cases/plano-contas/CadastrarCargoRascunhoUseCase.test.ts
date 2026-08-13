import { describe, expect, it, vi } from 'vitest';
import { CadastrarCargoRascunhoUseCase } from './CadastrarCargoRascunhoUseCase';
import { CamposObrigatoriosCargoError } from '@/domain/plano-contas/errors';

function criarPrismaMock() {
  const base = {
    cargo: {
      findFirst: vi.fn(() => Promise.resolve(null)), // gerarProximoCodigoCargo: nenhum código colidindo ainda
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'cargo-1', ...data })),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const inputBase = { tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', nomeCargoMercado: 'Analista de Requisitos' };

describe('CadastrarCargoRascunhoUseCase [ADR-042]', () => {
  it('cadastra Cargo com status RASCUNHO, só com o nome e código gerado', async () => {
    const base = criarPrismaMock();
    const useCase = new CadastrarCargoRascunhoUseCase(base as never);

    const resultado = await useCase.execute(inputBase);

    expect(resultado.status).toBe('RASCUNHO');
    expect(base.cargo.create).toHaveBeenCalledOnce();
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('bloqueia nome em branco', async () => {
    const base = criarPrismaMock();
    const useCase = new CadastrarCargoRascunhoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, nomeCargoMercado: '   ' })).rejects.toThrow(CamposObrigatoriosCargoError);
    expect(base.cargo.create).not.toHaveBeenCalled();
  });
});
