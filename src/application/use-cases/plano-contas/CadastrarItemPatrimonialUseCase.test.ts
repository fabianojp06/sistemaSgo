import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarItemPatrimonialUseCase } from './CadastrarItemPatrimonialUseCase';
import {
  CamposObrigatoriosItemPatrimonialError,
  ContaItemPatrimonialNaoAnaliticaError,
  MetaObrigatoriaItemPatrimonialError,
  QuantidadeOuValorItemPatrimonialInvalidoError,
} from '@/domain/plano-contas/errors';

type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean; proposta: { categoria: string } };
type ContaMock = { id: string; isAnalitica: boolean };
type MetaMock = { id: string; tenantId: string; versaoId: string; ativo: boolean };

function criarPrismaMock(versoes: VersaoMock[], metas: MetaMock[], contas: ContaMock[]) {
  let idSeq = 1;

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) =>
        Promise.resolve(versoes.find((v) => v.id === where.id && v.tenantId === where.tenantId && v.ativa) ?? null),
      ),
    },
    meta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; versaoId: string; ativo: boolean } }) =>
        Promise.resolve(metas.find((m) => m.versaoId === where.versaoId && m.tenantId === where.tenantId && m.ativo === where.ativo) ?? null),
      ),
    },
    contaContabil: {
      findFirst: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(contas.find((c) => c.id === where.id) ?? null)),
    },
    itemPatrimonial: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `item${idSeq++}`, ativo: true, ...data })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const versaoConsolidada: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true, proposta: { categoria: 'CONSOLIDADA' } };
const versaoPorMeta: VersaoMock = { id: 'v2', tenantId: 't1', status: 'RASCUNHO', ativa: true, proposta: { categoria: 'POR_META' } };
const metaAtiva: MetaMock = { id: 'm1', tenantId: 't1', versaoId: 'v2', ativo: true };
const contaAnalitica: ContaMock = { id: 'c1', isAnalitica: true };
const contaSintetica: ContaMock = { id: 'c1', isAnalitica: false };

const inputBase = {
  tenantId: 't1',
  usuarioId: 'u1',
  versaoId: 'v1',
  contaId: 'c1',
  descricao: 'Notebook Dell Latitude',
  data: new Date('2026-08-10'),
  quantidade: 5,
  valorUnitario: 4500,
};

describe('CadastrarItemPatrimonialUseCase [US-110]', () => {
  it('cadastra item em Proposta CONSOLIDADA com Valor Total calculado, metaId=null [Cenário 1]', async () => {
    const prisma = criarPrismaMock([versaoConsolidada], [], [contaAnalitica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    const item = await useCase.execute(inputBase);

    expect((item.valorTotal as Prisma.Decimal).toString()).toBe('22500');
    expect(item.metaId).toBeNull();
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'ITEM_PATRIMONIAL_CADASTRADO' }) }),
    );
  });

  it('bloqueia cadastro em Proposta POR_META sem Meta cadastrada [Cenário 2]', async () => {
    const prisma = criarPrismaMock([versaoPorMeta], [], [contaAnalitica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, versaoId: 'v2' })).rejects.toThrow(MetaObrigatoriaItemPatrimonialError);
  });

  it('cadastra item em Proposta POR_META vinculando a Meta automaticamente', async () => {
    const prisma = criarPrismaMock([versaoPorMeta], [metaAtiva], [contaAnalitica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    const item = await useCase.execute({ ...inputBase, versaoId: 'v2' });

    expect(item.metaId).toBe('m1');
  });

  it('valorTotal ignora tentativa de override e é sempre calculado [Cenário 3]', async () => {
    const prisma = criarPrismaMock([versaoConsolidada], [], [contaAnalitica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    const item = await useCase.execute({ ...inputBase, quantidade: 3, valorUnitario: 100 });

    expect((item.valorTotal as Prisma.Decimal).toString()).toBe('300');
  });

  it('bloqueia campos obrigatórios em branco [Cenário 4]', async () => {
    const prisma = criarPrismaMock([versaoConsolidada], [], [contaAnalitica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, descricao: '' })).rejects.toThrow(CamposObrigatoriosItemPatrimonialError);
  });

  it('bloqueia quantidade zero ou valor unitário negativo [Cenário 5]', async () => {
    const prisma = criarPrismaMock([versaoConsolidada], [], [contaAnalitica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, quantidade: 0 })).rejects.toThrow(QuantidadeOuValorItemPatrimonialInvalidoError);
    await expect(useCase.execute({ ...inputBase, valorUnitario: -1 })).rejects.toThrow(QuantidadeOuValorItemPatrimonialInvalidoError);
  });

  it('bloqueia conta sintética', async () => {
    const prisma = criarPrismaMock([versaoConsolidada], [], [contaSintetica]);
    const useCase = new CadastrarItemPatrimonialUseCase(prisma as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(ContaItemPatrimonialNaoAnaliticaError);
  });
});
