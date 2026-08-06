import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarQtdeEmpregadoUseCase } from './CadastrarQtdeEmpregadoUseCase';
import {
  CamposObrigatoriosQtdeEmpregadoError,
  MetaNaoEncontradaError,
  PeriodoQtdeEmpregadoForaDaVigenciaError,
  SobreposicaoPeriodoQtdeEmpregadoError,
} from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; categoria: string; status: string; dataInicio: Date; dataFim: Date };
type VersaoMock = { id: string; tenantId: string; propostaId: string; vigente: boolean; ativa: boolean };
type MetaMock = { id: string; tenantId: string; versaoId: string; ativo: boolean };
type HeadcountMock = {
  tenantId: string;
  propostaId: string;
  metaId: string | null;
  categoria: string;
  ativo: boolean;
  periodoInicio?: Date;
  periodoFim?: Date | null;
  custoTotalMensal?: Prisma.Decimal;
};
type QtdeMock = { id: string; tenantId: string; propostaId: string; periodoInicio: Date; periodoFim: Date; ativo: boolean };

function criarPrismaMock(
  propostas: PropostaMock[],
  versoes: VersaoMock[] = [],
  metas: MetaMock[] = [],
  headcounts: HeadcountMock[] = [],
  existentes: QtdeMock[] = [],
) {
  let idSeq = 1;

  const base = {
    proposta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(propostas.find((p) => p.tenantId === where.tenantId && p.id === where.id) ?? null),
      ),
    },
    versaoProposta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; propostaId: string; vigente: boolean; ativa: boolean } }) =>
        Promise.resolve(
          versoes.find(
            (v) => v.tenantId === where.tenantId && v.propostaId === where.propostaId && v.vigente === where.vigente && v.ativa === where.ativa,
          ) ?? null,
        ),
      ),
    },
    meta: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; versaoId: string; ativo: boolean } }) =>
        Promise.resolve(metas.find((m) => m.tenantId === where.tenantId && m.versaoId === where.versaoId && m.ativo === where.ativo) ?? null),
      ),
    },
    empregadoHeadcount: {
      count: vi.fn(({ where }: { where: { tenantId: string; propostaId: string; ativo: boolean; metaId?: string; categoria: string } }) =>
        Promise.resolve(
          headcounts.filter(
            (h) =>
              h.tenantId === where.tenantId &&
              h.propostaId === where.propostaId &&
              h.ativo === where.ativo &&
              h.categoria === where.categoria &&
              (where.metaId === undefined || h.metaId === where.metaId),
          ).length,
        ),
      ),
      findMany: vi.fn(({ where }: { where: { tenantId: string; propostaId: string; ativo: boolean; metaId?: string } }) =>
        Promise.resolve(
          headcounts
            .filter(
              (h) =>
                h.tenantId === where.tenantId &&
                h.propostaId === where.propostaId &&
                h.ativo === where.ativo &&
                (where.metaId === undefined || h.metaId === where.metaId),
            )
            .map((h) => ({
              periodoInicio: h.periodoInicio ?? new Date('2026-01-01'),
              periodoFim: h.periodoFim ?? null,
              custoTotalMensal: h.custoTotalMensal ?? new Prisma.Decimal(0),
            })),
        ),
      ),
    },
    qtdeEmpregado: {
      findMany: vi.fn(({ where }: { where: { tenantId: string; propostaId: string; ativo: boolean } }) =>
        Promise.resolve(existentes.filter((e) => e.tenantId === where.tenantId && e.propostaId === where.propostaId && e.ativo === where.ativo)),
      ),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `q${idSeq++}`, ativo: true, ...data })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const propostaConsolidada: PropostaMock = {
  id: 'p1',
  tenantId: 't1',
  categoria: 'CONSOLIDADA',
  status: 'RASCUNHO',
  dataInicio: new Date('2026-01-01'),
  dataFim: new Date('2026-12-31'),
};
const propostaPorMeta: PropostaMock = {
  id: 'p2',
  tenantId: 't1',
  categoria: 'POR_META',
  status: 'RASCUNHO',
  dataInicio: new Date('2026-01-01'),
  dataFim: new Date('2026-12-31'),
};
const versaoVigentePorMeta: VersaoMock = { id: 'v2', tenantId: 't1', propostaId: 'p2', vigente: true, ativa: true };
const metaAtiva: MetaMock = { id: 'm1', tenantId: 't1', versaoId: 'v2', ativo: true };

const inputBase = {
  tenantId: 't1',
  usuarioId: 'u1',
  propostaId: 'p1',
  periodoInicio: new Date('2026-01-01'),
  periodoFim: new Date('2026-06-30'),
  numeroDocumento: 'APOST-2026-014',
};

describe('CadastrarQtdeEmpregadoUseCase [US-113]', () => {
  it('consolida quantidade com contagem calculada [Cenário 1]', async () => {
    const headcounts: HeadcountMock[] = [
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p1', metaId: null, categoria: 'ESTAGIARIO', ativo: true },
    ];
    const prisma = criarPrismaMock([propostaConsolidada], [], [], headcounts);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    const qtde = await useCase.execute(inputBase);

    expect(qtde.quantidadeEmpregados).toBe(2);
    expect(qtde.quantidadeEstagiarios).toBe(1);
    expect(qtde.quantidadeJovemAprendiz).toBe(0);
    expect(qtde.metaId).toBeNull();
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'QTDE_EMPREGADO_CADASTRADA' }) }),
    );
  });

  it('bloqueia período que extrapola a vigência da Proposta [Cenário 2]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada]);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, periodoFim: new Date('2027-03-31') })).rejects.toThrow(
      PeriodoQtdeEmpregadoForaDaVigenciaError,
    );
  });

  it('bloqueia sobreposição de períodos na mesma Proposta [Cenário 3]', async () => {
    const existentes: QtdeMock[] = [
      { id: 'q0', tenantId: 't1', propostaId: 'p1', periodoInicio: new Date('2026-01-01'), periodoFim: new Date('2026-06-30'), ativo: true },
    ];
    const prisma = criarPrismaMock([propostaConsolidada], [], [], [], existentes);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({ ...inputBase, periodoInicio: new Date('2026-05-01'), periodoFim: new Date('2026-08-31') }),
    ).rejects.toThrow(SobreposicaoPeriodoQtdeEmpregadoError);
  });

  it('bloqueia campos obrigatórios em branco [Cenário 4]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada]);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, numeroDocumento: '' })).rejects.toThrow(CamposObrigatoriosQtdeEmpregadoError);
  });

  it('agrupa contagem apenas pelos headcounts da Meta vinculada [Cenário 8]', async () => {
    const headcounts: HeadcountMock[] = [
      { tenantId: 't1', propostaId: 'p2', metaId: 'm1', categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p2', metaId: 'm1', categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p2', metaId: 'm1', categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p2', metaId: 'm1', categoria: 'ESTAGIARIO', ativo: true },
      { tenantId: 't1', propostaId: 'p3', metaId: null, categoria: 'EMPREGADO', ativo: true },
      { tenantId: 't1', propostaId: 'p3', metaId: null, categoria: 'EMPREGADO', ativo: true },
    ];
    const prisma = criarPrismaMock([propostaPorMeta], [versaoVigentePorMeta], [metaAtiva], headcounts);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    const qtde = await useCase.execute({ ...inputBase, propostaId: 'p2' });

    expect(qtde.metaId).toBe('m1');
    expect(qtde.quantidadeEmpregados).toBe(3);
    expect(qtde.quantidadeEstagiarios).toBe(1);
  });

  it('bloqueia Proposta POR_META sem Meta cadastrada', async () => {
    const prisma = criarPrismaMock([propostaPorMeta], [versaoVigentePorMeta], []);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    await expect(useCase.execute({ ...inputBase, propostaId: 'p2' })).rejects.toThrow(MetaNaoEncontradaError);
  });

  it('calcula valorTotalConsolidado por overlap de período [US-113b]', async () => {
    const headcounts: HeadcountMock[] = [
      // Dentro do período do documento (jan-jun/2026), sem periodoFim (usa dataFim da Proposta) — 6 meses de overlap.
      {
        tenantId: 't1',
        propostaId: 'p1',
        metaId: null,
        categoria: 'EMPREGADO',
        ativo: true,
        periodoInicio: new Date('2026-01-01'),
        periodoFim: null,
        custoTotalMensal: new Prisma.Decimal(6550),
      },
      // Fora do período do documento (começa depois do fim do documento) — não contribui.
      {
        tenantId: 't1',
        propostaId: 'p1',
        metaId: null,
        categoria: 'EMPREGADO',
        ativo: true,
        periodoInicio: new Date('2026-08-01'),
        periodoFim: null,
        custoTotalMensal: new Prisma.Decimal(5000),
      },
    ];
    const prisma = criarPrismaMock([propostaConsolidada], [], [], headcounts);
    const useCase = new CadastrarQtdeEmpregadoUseCase(prisma as never);

    const qtde = await useCase.execute(inputBase);

    expect(qtde.valorTotalConsolidado.toString()).toBe('39300'); // 6550 * 6 meses (jan-jun)
  });
});
