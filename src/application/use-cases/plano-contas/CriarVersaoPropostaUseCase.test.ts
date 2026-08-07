import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CriarVersaoPropostaUseCase } from './CriarVersaoPropostaUseCase';
import { VersaoPropostaInvalidaError } from '@/domain/plano-contas/errors';

type Fixtures = {
  valores?: Array<{ tenantId: string; versaoId: string; contaId: string; exercicio: number; valor: Prisma.Decimal }>;
  rateios?: Array<Record<string, unknown>>;
  meta?: Record<string, unknown> | null;
  viagens?: Array<Record<string, unknown>>;
  itens?: Array<Record<string, unknown>>;
  termos?: Array<Record<string, unknown>>;
};

function criarPrismaMock(fixtures: Fixtures = {}) {
  const versoes = [
    { id: 'v1', tenantId: 't1', propostaId: 'p1', numeroVersao: 1, vigente: true, ativa: true, status: 'RASCUNHO' },
  ];
  const valores = fixtures.valores ?? [{ tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(1000) }];
  const rateios = fixtures.rateios ?? [];
  const meta = fixtures.meta ?? null;
  const viagens = fixtures.viagens ?? [];
  const itens = fixtures.itens ?? [];
  const termos = fixtures.termos ?? [];

  const base = {
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          versoes.find(
            (v) => v.tenantId === where.tenantId && v.propostaId === where.propostaId && v.vigente === where.vigente && v.ativa === where.ativa,
          ) ?? null,
        ),
      ),
      update: vi.fn(({ where, data }: { where: { id: string }; data: { vigente: boolean } }) => {
        const v = versoes.find((x) => x.id === where.id);
        if (v) v.vigente = data.vigente;
        return Promise.resolve(v);
      }),
      create: vi.fn(({ data }: { data: Omit<(typeof versoes)[number], 'ativa' | 'status'> & { status: string } }) => {
        const nova = { ...data, ativa: true, id: 'v2' };
        versoes.push(nova as never);
        return Promise.resolve(nova);
      }),
    },
    valorOrcadoConta: {
      findMany: vi.fn(({ where }: { where: { tenantId: string; versaoId: string } }) =>
        Promise.resolve(valores.filter((v) => v.tenantId === where.tenantId && v.versaoId === where.versaoId)),
      ),
      createMany: vi.fn().mockResolvedValue({}),
    },
    rateioImpostoGrade: {
      findMany: vi.fn().mockResolvedValue(rateios),
      createMany: vi.fn().mockResolvedValue({}),
    },
    meta: {
      findFirst: vi.fn().mockResolvedValue(meta),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...data, id: 'meta-nova' })),
    },
    viagem: {
      findMany: vi.fn().mockResolvedValue(viagens),
      createMany: vi.fn().mockResolvedValue({}),
    },
    itemPatrimonial: {
      findMany: vi.fn().mockResolvedValue(itens),
      createMany: vi.fn().mockResolvedValue({}),
    },
    termoAjuste: {
      findMany: vi.fn(({ where }: { where: { status: string } }) => Promise.resolve(termos.filter((t) => t.status === where.status))),
      createMany: vi.fn().mockResolvedValue({}),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('CriarVersaoPropostaUseCase [US-007/US-119, ADR-033]', () => {
  it('cria nova versão copiando os valores orçados da versão vigente', async () => {
    const prisma = criarPrismaMock();
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    const novaVersao = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' });

    expect(novaVersao.numeroVersao).toBe(2);
    expect(prisma.versaoProposta.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { vigente: false } });
    expect(prisma.valorOrcadoConta.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ versaoId: 'v2', contaId: 'c7', exercicio: 2026 })],
    });
  });

  it('bloqueia se a proposta não tiver versão vigente', async () => {
    const prisma = criarPrismaMock();
    prisma.versaoProposta.findFirst = vi.fn().mockResolvedValue(null);
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' })).rejects.toThrow(
      VersaoPropostaInvalidaError,
    );
  });

  it('copia Meta recalculando valorGlobal a partir dos ValorOrcadoConta copiados, não copiando o valor literal', async () => {
    const valores = [
      { tenantId: 't1', versaoId: 'v1', contaId: 'c7', exercicio: 2026, valor: new Prisma.Decimal(1000) },
      { tenantId: 't1', versaoId: 'v1', contaId: 'c8', exercicio: 2027, valor: new Prisma.Decimal(500) },
    ];
    const meta = { tenantId: 't1', versaoId: 'v1', tipo: 'INSTITUCIONAL', nome: 'Meta X', valorGlobal: new Prisma.Decimal(999999), status: 'ATIVO', observacao: null };
    const prisma = criarPrismaMock({ valores, meta });
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' });

    expect(prisma.meta.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        versaoId: 'v2',
        nome: 'Meta X',
        valorGlobal: expect.objectContaining({ d: expect.anything() }),
      }),
    });
    const valorGlobalPassado = (prisma.meta.create.mock.calls[0][0] as { data: { valorGlobal: Prisma.Decimal } }).data.valorGlobal;
    expect(valorGlobalPassado.toNumber()).toBe(1500);
  });

  it('copia Viagem e ItemPatrimonial apontando metaId para a Meta nova', async () => {
    const meta = { tenantId: 't1', versaoId: 'v1', tipo: 'INSTITUCIONAL', nome: 'Meta X', valorGlobal: new Prisma.Decimal(0), status: 'ATIVO', observacao: null };
    const viagens = [{ tenantId: 't1', versaoId: 'v1', metaId: 'meta-antiga', descricao: 'Viagem X', quantidadePessoas: 2, mediaDias: 3, custoUnitarioPassagem: new Prisma.Decimal(100), contaPassagemId: 'cp', custoUnitarioDiaria: new Prisma.Decimal(50), contaDiariaId: 'cd', custoUnitarioTransporte: new Prisma.Decimal(30), contaTransporteId: 'ct', custoEstimado: new Prisma.Decimal(400) }];
    const itens = [{ tenantId: 't1', versaoId: 'v1', metaId: 'meta-antiga', contaId: 'ci', descricao: 'Item X', data: new Date('2026-01-01'), quantidade: 1, valorUnitario: new Prisma.Decimal(200), valorTotal: new Prisma.Decimal(200) }];
    const prisma = criarPrismaMock({ meta, viagens, itens });
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' });

    expect(prisma.viagem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ versaoId: 'v2', metaId: 'meta-nova', descricao: 'Viagem X' })],
    });
    expect(prisma.itemPatrimonial.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ versaoId: 'v2', metaId: 'meta-nova', descricao: 'Item X' })],
    });
  });

  it('copia TermoAjuste HOMOLOGADO mas não copia PENDENTE_APROVACAO_N1', async () => {
    const termos = [
      { tenantId: 't1', versaoId: 'v1', contaOrigemId: 'co', contaDestinoId: 'cd', exercicio: 2026, valor: new Prisma.Decimal(100), status: 'HOMOLOGADO', createdBy: 'u-antigo' },
      { tenantId: 't1', versaoId: 'v1', contaOrigemId: 'co2', contaDestinoId: 'cd2', exercicio: 2026, valor: new Prisma.Decimal(50), status: 'PENDENTE_APROVACAO_N1', createdBy: 'u-antigo' },
    ];
    const prisma = criarPrismaMock({ termos });
    const useCase = new CriarVersaoPropostaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1' });

    expect(prisma.termoAjuste.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ versaoId: 'v2', contaOrigemId: 'co', status: 'HOMOLOGADO' })],
    });
    const chamada = prisma.termoAjuste.createMany.mock.calls[0][0] as { data: Array<{ contaOrigemId: string }> };
    expect(chamada.data).toHaveLength(1);
  });
});
