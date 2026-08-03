import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarMetaUseCase } from './EditarMetaUseCase';

type MetaMock = {
  id: string;
  tenantId: string;
  versaoId: string;
  tipo: string;
  nome: string;
  status: string;
  observacao: string | null;
  valorGlobal: Prisma.Decimal;
  ativo: boolean;
};
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };

function criarPrismaMock(meta: MetaMock, versao: VersaoMock, novoTotal: number) {
  let atual = { ...meta };

  const base = {
    meta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(atual.tenantId === where.tenantId && atual.id === where.id ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<MetaMock> }) => {
        atual = { ...atual, ...data };
        return Promise.resolve(atual);
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) =>
        Promise.resolve(versao.id === where.id && versao.tenantId === where.tenantId && versao.ativa ? versao : null),
      ),
    },
    valorOrcadoConta: {
      aggregate: vi.fn(() => Promise.resolve({ _sum: { valor: new Prisma.Decimal(novoTotal) } })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const metaBase: MetaMock = {
  id: 'm1',
  tenantId: 't1',
  versaoId: 'v1',
  tipo: 'Capacitação',
  nome: 'Capacitação Regional',
  status: 'ATIVO',
  observacao: null,
  valorGlobal: new Prisma.Decimal(1_000_000),
  ativo: true,
};
const versaoRascunho: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true };

describe('EditarMetaUseCase [US-112]', () => {
  it('ignora Valor Global enviado e recalcula a partir do total orçado corrente [Cenário 7]', async () => {
    const prisma = criarPrismaMock(metaBase, versaoRascunho, 1_500_000);
    const useCase = new EditarMetaUseCase(prisma as never);

    const meta = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      metaId: 'm1',
      nome: 'Capacitação Regional — Revisão 1',
      status: 'ATIVO',
      valorGlobal: 999, // tentativa de injeção — deve ser ignorada
    });

    expect(meta.nome).toBe('Capacitação Regional — Revisão 1');
    expect(meta.valorGlobal.toString()).toBe('1500000');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'META_EDITADA' }) }),
    );
  });
});
