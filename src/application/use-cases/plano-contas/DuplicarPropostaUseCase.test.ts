import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DuplicarPropostaUseCase } from './DuplicarPropostaUseCase';
import { DatasPropostaInvalidasError, PropostaNaoEncontradaError } from '@/domain/plano-contas/errors';

function criarPrismaMock() {
  const propostas = [
    {
      id: 'p-origem',
      tenantId: 't1',
      codigo: 'PROP-2025-0010',
      nome: 'Projeto Original',
      tipo: 'CONTRATO',
      categoria: 'CONSOLIDADA',
      dataInicio: new Date('2025-01-01'),
      dataFim: new Date('2025-12-31'),
      status: 'OFICIALIZADO',
    },
  ];
  const versoes = [
    { id: 'v-origem', tenantId: 't1', propostaId: 'p-origem', numeroVersao: 1, vigente: true, ativa: true, status: 'OFICIALIZADO' },
  ];
  const valores = [
    { tenantId: 't1', versaoId: 'v-origem', contaId: 'c1', exercicio: 2025, valor: new Prisma.Decimal(1000) },
    { tenantId: 't1', versaoId: 'v-origem', contaId: 'c2', exercicio: 2025, valor: new Prisma.Decimal(2000) },
  ];
  const rateios = [
    {
      tenantId: 't1',
      versaoId: 'v-origem',
      aliquotaParametroId: 'a-iss',
      competencia: new Date('2025-01-01'),
      valorDeclarado: new Prisma.Decimal(50),
      aliquotaAplicadaSnapshot: new Prisma.Decimal(3),
      ativo: true,
    },
    {
      tenantId: 't1',
      versaoId: 'v-origem',
      aliquotaParametroId: 'a-pis',
      competencia: new Date('2025-01-01'),
      valorDeclarado: new Prisma.Decimal(10),
      aliquotaAplicadaSnapshot: new Prisma.Decimal(9.25),
      ativo: false, // desativado — não deve ser copiado
    },
  ];

  let idSeq = 1;
  const base = {
    proposta: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) =>
        Promise.resolve(propostas.find((p) => p.id === where.id && p.tenantId === where.tenantId) ?? null),
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const nova = { id: `p-nova-${idSeq++}`, ...data };
        propostas.push(nova as never);
        return Promise.resolve(nova);
      }),
    },
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(
          versoes.find(
            (v) => v.tenantId === where.tenantId && v.propostaId === where.propostaId && v.vigente === where.vigente && v.ativa === where.ativa,
          ) ?? null,
        ),
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'v-nova', ...data })),
    },
    valorOrcadoConta: {
      findMany: vi.fn(({ where }: { where: { tenantId: string; versaoId: string } }) =>
        Promise.resolve(valores.filter((v) => v.tenantId === where.tenantId && v.versaoId === where.versaoId)),
      ),
      createMany: vi.fn().mockResolvedValue({}),
    },
    rateioImpostoGrade: {
      findMany: vi.fn(({ where }: { where: { tenantId: string; versaoId: string; ativo: boolean } }) =>
        Promise.resolve(
          rateios.filter((r) => r.tenantId === where.tenantId && r.versaoId === where.versaoId && r.ativo === where.ativo),
        ),
      ),
      createMany: vi.fn().mockResolvedValue({}),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

describe('DuplicarPropostaUseCase [US-104]', () => {
  it('duplica proposta oficializada em nova Proposta RASCUNHO/Versão 1, copiando dados ativos [Cenário 1]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new DuplicarPropostaUseCase(prisma as never);

    const resultado = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaOrigemId: 'p-origem' });

    expect(resultado.status).toBe('RASCUNHO');
    expect(resultado.nome).toBe('Cópia de Projeto Original');
    expect(resultado.versaoInicial).toEqual(expect.objectContaining({ numeroVersao: 1, vigente: true, status: 'RASCUNHO' }));
    expect(prisma.valorOrcadoConta.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ versaoId: 'v-nova', contaId: 'c1', exercicio: 2025 }),
        expect.objectContaining({ versaoId: 'v-nova', contaId: 'c2', exercicio: 2025 }),
      ],
    });
    // Só o rateio ativo (ISS) é copiado — o PIS desativado não deve "ressuscitar" na cópia.
    expect(prisma.rateioImpostoGrade.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ versaoId: 'v-nova', aliquotaParametroId: 'a-iss' })],
    });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'PROPOSTA_DUPLICADA',
          dadosSerializados: expect.objectContaining({ valoresOrcadosCopiados: 2, rateiosImpostoCopiados: 1 }),
        }),
      }),
    );
  });

  it('aceita nome customizado em vez do prefixo padrão', async () => {
    const prisma = criarPrismaMock();
    const useCase = new DuplicarPropostaUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaOrigemId: 'p-origem',
      nome: 'Projeto Renovado 2026',
    });

    expect(resultado.nome).toBe('Projeto Renovado 2026');
  });

  it('bloqueia se a Proposta de origem não existir', async () => {
    const prisma = criarPrismaMock();
    const useCase = new DuplicarPropostaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaOrigemId: 'inexistente' }),
    ).rejects.toThrow(PropostaNaoEncontradaError);
  });

  it('bloqueia datas de vigência incoerentes ao expandir o período', async () => {
    const prisma = criarPrismaMock();
    const useCase = new DuplicarPropostaUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaOrigemId: 'p-origem',
        dataInicio: new Date('2026-06-01'),
        dataFim: new Date('2026-01-01'),
      }),
    ).rejects.toThrow(DatasPropostaInvalidasError);
  });
});
