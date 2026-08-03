import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExcluirMetaUseCase } from './ExcluirMetaUseCase';
import { MetaNaoEncontradaError } from '@/domain/plano-contas/errors';

type MetaMock = { id: string; tenantId: string; versaoId: string; nome: string; valorGlobal: Prisma.Decimal; ativo: boolean };
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };

function criarPrismaMock(meta: MetaMock | null, versao: VersaoMock) {
  let atual = meta ? { ...meta } : null;

  const base = {
    meta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; ativo: boolean } }) =>
        Promise.resolve(atual && atual.tenantId === where.tenantId && atual.id === where.id && atual.ativo ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<MetaMock> }) => {
        atual = { ...(atual as MetaMock), ...data };
        return Promise.resolve(atual);
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(() => Promise.resolve(versao.ativa ? versao : null)),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

describe('ExcluirMetaUseCase [US-112]', () => {
  it('exclui a Meta via soft delete [Cenário 8]', async () => {
    const meta: MetaMock = { id: 'm1', tenantId: 't1', versaoId: 'v1', nome: 'Meta 1', valorGlobal: new Prisma.Decimal(500000), ativo: true };
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
    const { base, getAtual } = criarPrismaMock(meta, versao);
    const useCase = new ExcluirMetaUseCase(base as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', metaId: 'm1' });

    expect(getAtual()?.ativo).toBe(false);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'META_EXCLUIDA' }) }),
    );
  });

  it('bloqueia exclusão de Meta inexistente', async () => {
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
    const { base } = criarPrismaMock(null, versao);
    const useCase = new ExcluirMetaUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', metaId: 'inexistente' })).rejects.toThrow(MetaNaoEncontradaError);
  });
});
