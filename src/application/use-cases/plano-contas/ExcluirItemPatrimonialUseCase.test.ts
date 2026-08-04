import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExcluirItemPatrimonialUseCase } from './ExcluirItemPatrimonialUseCase';
import { ItemPatrimonialNaoEncontradoError } from '@/domain/plano-contas/errors';

type ItemMock = { id: string; tenantId: string; versaoId: string; descricao: string; valorTotal: Prisma.Decimal; ativo: boolean };
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };

function criarPrismaMock(item: ItemMock | null, versao: VersaoMock) {
  let atual = item ? { ...item } : null;

  const base = {
    itemPatrimonial: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; ativo: boolean } }) =>
        Promise.resolve(atual && atual.tenantId === where.tenantId && atual.id === where.id && atual.ativo ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<ItemMock> }) => {
        atual = { ...(atual as ItemMock), ...data };
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

describe('ExcluirItemPatrimonialUseCase [US-110]', () => {
  it('exclui o item patrimonial via soft delete [Cenário 7]', async () => {
    const item: ItemMock = { id: 'item1', tenantId: 't1', versaoId: 'v1', descricao: 'Notebook Dell Latitude', valorTotal: new Prisma.Decimal(22500), ativo: true };
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
    const { base, getAtual } = criarPrismaMock(item, versao);
    const useCase = new ExcluirItemPatrimonialUseCase(base as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', itemPatrimonialId: 'item1' });

    expect(getAtual()?.ativo).toBe(false);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'ITEM_PATRIMONIAL_EXCLUIDO' }) }),
    );
  });

  it('bloqueia exclusão de item inexistente', async () => {
    const versao: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
    const { base } = criarPrismaMock(null, versao);
    const useCase = new ExcluirItemPatrimonialUseCase(base as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', itemPatrimonialId: 'inexistente' })).rejects.toThrow(
      ItemPatrimonialNaoEncontradoError,
    );
  });
});
