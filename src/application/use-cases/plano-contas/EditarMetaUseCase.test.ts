import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarMetaUseCase } from './EditarMetaUseCase';
import { ConflitoConcorrenciaError } from '@/domain/plano-contas/errors';

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
  updatedAt: Date;
};
type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean };

function criarPrismaMock(meta: MetaMock, versao: VersaoMock, novoTotal: number) {
  let atual = { ...meta };

  const base = {
    meta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(atual.tenantId === where.tenantId && atual.id === where.id ? atual : null),
      ),
      findUniqueOrThrow: vi.fn(() => Promise.resolve(atual)),
      updateMany: vi.fn(({ where, data }: { where: { id: string; updatedAt: Date }; data: Partial<MetaMock> }) => {
        if (atual.id !== where.id || atual.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return Promise.resolve({ count: 0 });
        }
        atual = { ...atual, ...data, updatedAt: new Date(atual.updatedAt.getTime() + 1) };
        return Promise.resolve({ count: 1 });
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
  updatedAt: new Date('2026-01-01T00:00:00Z'),
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

  it('bloqueia conflito de concorrência quando o token informado diverge do estado atual [US-105]', async () => {
    const prisma = criarPrismaMock(metaBase, versaoRascunho, 1_500_000);
    const useCase = new EditarMetaUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        metaId: 'm1',
        nome: 'Capacitação Regional — Revisão 1',
        status: 'ATIVO',
        tokenConcorrencia: new Date('2020-01-01T00:00:00Z'),
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
    expect(prisma.meta.updateMany).not.toHaveBeenCalled();
  });

  it('bloqueia conflito detectado só no updateMany (corrida real entre leitura e escrita) [US-105]', async () => {
    const prisma = criarPrismaMock(metaBase, versaoRascunho, 1_500_000);
    // Simula outro usuário alterando o registro entre a leitura e a escrita deste use-case.
    prisma.meta.updateMany.mockResolvedValueOnce({ count: 0 });
    const useCase = new EditarMetaUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        metaId: 'm1',
        nome: 'Capacitação Regional — Revisão 1',
        status: 'ATIVO',
      }),
    ).rejects.toThrow(ConflitoConcorrenciaError);
  });
});
