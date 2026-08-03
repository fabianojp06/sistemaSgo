import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarMetaUseCase } from './CadastrarMetaUseCase';
import { CamposObrigatoriosMetaError, MetaForaDeEscopoCategoriaError, MetaJaExistenteError } from '@/domain/plano-contas/errors';

type VersaoMock = { id: string; tenantId: string; status: string; ativa: boolean; proposta: { categoria: string } };
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

function criarPrismaMock(versoes: VersaoMock[], valoresOrcados: number[] = [], metaExistente: MetaMock | null = null) {
  let meta = metaExistente;
  let idSeq = 1;

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; ativa: boolean } }) =>
        Promise.resolve(versoes.find((v) => v.id === where.id && v.tenantId === where.tenantId && v.ativa) ?? null),
      ),
    },
    meta: {
      findUnique: vi.fn(() => Promise.resolve(meta)),
      create: vi.fn(({ data }: { data: Omit<MetaMock, 'id' | 'ativo'> }) => {
        meta = { id: `m${idSeq++}`, ativo: true, ...data };
        return Promise.resolve(meta);
      }),
      update: vi.fn(({ data }: { data: Partial<MetaMock> }) => {
        meta = { ...(meta as MetaMock), ...data };
        return Promise.resolve(meta);
      }),
    },
    valorOrcadoConta: {
      aggregate: vi.fn(() =>
        Promise.resolve({ _sum: { valor: valoresOrcados.length ? new Prisma.Decimal(valoresOrcados.reduce((a, b) => a + b, 0)) : null } }),
      ),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const versaoPorMeta: VersaoMock = { id: 'v1', tenantId: 't1', status: 'RASCUNHO', ativa: true, proposta: { categoria: 'POR_META' } };
const versaoConsolidada: VersaoMock = { id: 'v2', tenantId: 't1', status: 'RASCUNHO', ativa: true, proposta: { categoria: 'CONSOLIDADA' } };
const versaoOficializada: VersaoMock = { id: 'v3', tenantId: 't1', status: 'OFICIALIZADO', ativa: true, proposta: { categoria: 'POR_META' } };

describe('CadastrarMetaUseCase [US-112]', () => {
  it('cadastra a Meta com Valor Global espelhado do total orçado [Cenário 1]', async () => {
    const prisma = criarPrismaMock([versaoPorMeta], [1_000_000]);
    const useCase = new CadastrarMetaUseCase(prisma as never);

    const meta = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      versaoId: 'v1',
      tipo: 'Capacitação',
      nome: 'Capacitação Regional',
      status: 'ATIVO',
    });

    expect(meta.valorGlobal.toString()).toBe('1000000');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'META_CRIADA' }) }),
    );
  });

  it('bloqueia cadastro de uma segunda Meta ativa na mesma Versão [Cenário 2]', async () => {
    const metaExistente: MetaMock = {
      id: 'm0',
      tenantId: 't1',
      versaoId: 'v1',
      tipo: 'Capacitação',
      nome: 'Meta existente',
      status: 'ATIVO',
      observacao: null,
      valorGlobal: new Prisma.Decimal(500000),
      ativo: true,
    };
    const prisma = criarPrismaMock([versaoPorMeta], [1_000_000], metaExistente);
    const useCase = new CadastrarMetaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', tipo: 'Capacitação', nome: 'Nova', status: 'ATIVO' }),
    ).rejects.toThrow(MetaJaExistenteError);
  });

  it('bloqueia cadastro em Proposta CONSOLIDADA [Cenário 3]', async () => {
    const prisma = criarPrismaMock([versaoConsolidada]);
    const useCase = new CadastrarMetaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v2', tipo: 'Capacitação', nome: 'Meta', status: 'ATIVO' }),
    ).rejects.toThrow(MetaForaDeEscopoCategoriaError);
  });

  it('bloqueia cadastro sem campos obrigatórios [Cenário 4]', async () => {
    const prisma = criarPrismaMock([versaoPorMeta]);
    const useCase = new CadastrarMetaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v1', tipo: '', nome: 'Meta', status: 'ATIVO' }),
    ).rejects.toThrow(CamposObrigatoriosMetaError);
  });

  it('bloqueia cadastro em Versão Oficializada [Cenário 5]', async () => {
    const prisma = criarPrismaMock([versaoOficializada]);
    const useCase = new CadastrarMetaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', versaoId: 'v3', tipo: 'Capacitação', nome: 'Meta', status: 'ATIVO' }),
    ).rejects.toThrow(/homologado/);
  });
});
