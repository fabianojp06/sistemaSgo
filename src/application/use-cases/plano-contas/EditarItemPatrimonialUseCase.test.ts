import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarItemPatrimonialUseCase } from './EditarItemPatrimonialUseCase';
import { ContaItemPatrimonialNaoAnaliticaError } from '@/domain/plano-contas/errors';

type ItemMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  metaId: string | null;
  contaId: string;
  descricao: string;
  data: Date;
  quantidade: number;
  valorUnitario: Prisma.Decimal;
  valorTotal: Prisma.Decimal;
  ativo: boolean;
};
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };
type ContaMock = { id: string; isAnalitica: boolean };

function criarPrismaMock(item: ItemMock, versao: VersaoMock, contas: ContaMock[]) {
  let atual = { ...item };

  const base = {
    itemPatrimonial: {
      findFirst: vi.fn(() => Promise.resolve(atual.ativo ? atual : null)),
      update: vi.fn(({ data }: { data: Partial<ItemMock> }) => {
        atual = { ...atual, ...data };
        return Promise.resolve(atual);
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(() => Promise.resolve(versao.ativa ? versao : null)),
    },
    contaContabil: {
      findFirst: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(contas.find((c) => c.id === where.id) ?? null)),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

const itemBase: ItemMock = {
  id: 'item1',
  tenantId: 't1',
  versaoId: 'v1',
  metaId: null,
  contaId: 'c1',
  descricao: 'Notebook Dell Latitude',
  data: new Date('2026-08-10'),
  quantidade: 5,
  valorUnitario: new Prisma.Decimal(4500),
  valorTotal: new Prisma.Decimal(22500),
  ativo: true,
};
const versaoRascunho: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };
const contaAnalitica: ContaMock = { id: 'c1', isAnalitica: true };

describe('EditarItemPatrimonialUseCase [US-110]', () => {
  it('recalcula Valor Total ao alterar Quantidade [Cenário 6]', async () => {
    const { base, getAtual } = criarPrismaMock(itemBase, versaoRascunho, [contaAnalitica]);
    const useCase = new EditarItemPatrimonialUseCase(base as never);

    const item = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      itemPatrimonialId: 'item1',
      contaId: 'c1',
      descricao: 'Notebook Dell Latitude',
      data: new Date('2026-08-10'),
      quantidade: 6,
      valorUnitario: 4500,
    });

    expect((item.valorTotal as Prisma.Decimal).toString()).toBe('27000');
    expect(getAtual().versaoId).toBe('v1');
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'ITEM_PATRIMONIAL_EDITADO' }) }),
    );
  });

  it('bloqueia conta sintética na edição', async () => {
    const { base } = criarPrismaMock(itemBase, versaoRascunho, [{ id: 'c1', isAnalitica: false }]);
    const useCase = new EditarItemPatrimonialUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        itemPatrimonialId: 'item1',
        contaId: 'c1',
        descricao: 'Notebook Dell Latitude',
        data: new Date('2026-08-10'),
        quantidade: 6,
        valorUnitario: 4500,
      }),
    ).rejects.toThrow(ContaItemPatrimonialNaoAnaliticaError);
  });
});
