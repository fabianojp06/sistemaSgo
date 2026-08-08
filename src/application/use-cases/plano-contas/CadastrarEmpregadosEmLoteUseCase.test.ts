import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarEmpregadosEmLoteUseCase } from './CadastrarEmpregadosEmLoteUseCase';
import {
  CargoObrigatorioEmpregadoError,
  MetaNaoEncontradaError,
  PeriodoInicialRetroativoError,
  QuantidadeEmpregadoLoteInvalidaError,
} from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; categoria: string; status: string; dataInicio: Date };
type VersaoMock = { id: string; tenantId: string; propostaId: string; vigente: boolean; ativa: boolean };
type MetaMock = { id: string; tenantId: string; versaoId: string; ativo: boolean };
type CargoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  codigoCargo: string;
  contaId: string;
  custoTotalCargo: Prisma.Decimal;
  alocacoes: { percentual: number; unidadeFuncional: { nome: string } }[];
};

function criarPrismaMock(propostas: PropostaMock[], cargos: CargoMock[], versoes: VersaoMock[] = [], metas: MetaMock[] = []) {
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
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string; propostaId: string } }) =>
        Promise.resolve(
          cargos.find((c) => c.tenantId === where.tenantId && c.id === where.id && c.propostaId === where.propostaId) ?? null,
        ),
      ),
    },
    empregadoHeadcount: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `e${idSeq++}`, ativo: true, ...data })),
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
};
const propostaPorMeta: PropostaMock = {
  id: 'p2',
  tenantId: 't1',
  categoria: 'POR_META',
  status: 'RASCUNHO',
  dataInicio: new Date('2026-01-01'),
};
const propostaOficializada: PropostaMock = {
  id: 'p3',
  tenantId: 't1',
  categoria: 'CONSOLIDADA',
  status: 'OFICIALIZADO',
  dataInicio: new Date('2026-01-01'),
};
const versaoVigentePorMeta: VersaoMock = { id: 'v2', tenantId: 't1', propostaId: 'p2', vigente: true, ativa: true };
const metaAtiva: MetaMock = { id: 'm1', tenantId: 't1', versaoId: 'v2', ativo: true };
const cargo: CargoMock = {
  id: 'c1',
  tenantId: 't1',
  propostaId: 'p1',
  codigoCargo: 'CARGO-2026-0001',
  contaId: 'conta1',
  custoTotalCargo: new Prisma.Decimal(6200),
  alocacoes: [{ percentual: 100, unidadeFuncional: { nome: 'Setor de Compras' } }],
};
const cargoPorMeta: CargoMock = {
  id: 'c2',
  tenantId: 't1',
  propostaId: 'p2',
  codigoCargo: 'CARGO-2026-0002',
  contaId: 'conta2',
  custoTotalCargo: new Prisma.Decimal(5000),
  alocacoes: [{ percentual: 100, unidadeFuncional: { nome: 'Setor de Projetos' } }],
};
const cargoOficializada: CargoMock = {
  id: 'c3',
  tenantId: 't1',
  propostaId: 'p3',
  codigoCargo: 'CARGO-2026-0003',
  contaId: 'conta3',
  custoTotalCargo: new Prisma.Decimal(4000),
  alocacoes: [{ percentual: 100, unidadeFuncional: { nome: 'Setor X' } }],
};

describe('CadastrarEmpregadosEmLoteUseCase [US-108b]', () => {
  it('cadastra N vagas "A CONTRATAR" herdando custo e vínculo do Cargo [Cenário 1]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    const empregados = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      cargoId: 'c1',
      quantidade: 5,
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregados).toHaveLength(5);
    expect(empregados.every((e) => e.nome === 'A CONTRATAR')).toBe(true);
    expect(empregados.every((e) => e.custoTotalMensal.toString() === '6200')).toBe(true);
    expect(empregados.every((e) => e.vinculoFuncionalHerdado === 'Setor de Compras')).toBe(true);
    expect(prisma.empregadoHeadcount.create).toHaveBeenCalledTimes(5);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledTimes(1);
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipoOperacao: 'EMPREGADOS_LOTE_CADASTRADO', dadosSerializados: expect.objectContaining({ quantidade: 5 }) }),
      }),
    );
  });

  it('bloqueia quantidade zero ou negativa', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', cargoId: 'c1', quantidade: 0, categoria: 'EMPREGADO', periodoInicio: new Date('2026-02-01') }),
    ).rejects.toThrow(QuantidadeEmpregadoLoteInvalidaError);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', cargoId: 'c1', quantidade: -3, categoria: 'EMPREGADO', periodoInicio: new Date('2026-02-01') }),
    ).rejects.toThrow(QuantidadeEmpregadoLoteInvalidaError);
    expect(prisma.empregadoHeadcount.create).not.toHaveBeenCalled();
  });

  it('bloqueia quantidade não-inteira', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', cargoId: 'c1', quantidade: 2.5, categoria: 'EMPREGADO', periodoInicio: new Date('2026-02-01') }),
    ).rejects.toThrow(QuantidadeEmpregadoLoteInvalidaError);
  });

  it('bloqueia lançamento sem Cargo', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', cargoId: '', quantidade: 3, categoria: 'EMPREGADO', periodoInicio: new Date('2026-02-01') }),
    ).rejects.toThrow(CargoObrigatorioEmpregadoError);
  });

  it('bloqueia Proposta oficializada', async () => {
    const prisma = criarPrismaMock([propostaOficializada], [cargoOficializada]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p3', cargoId: 'c3', quantidade: 2, categoria: 'EMPREGADO', periodoInicio: new Date('2026-02-01') }),
    ).rejects.toThrow('Ação Negada');
    expect(prisma.empregadoHeadcount.create).not.toHaveBeenCalled();
  });

  it('bloqueia Período Inicial retroativo', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p1', cargoId: 'c1', quantidade: 2, categoria: 'EMPREGADO', periodoInicio: new Date('2025-12-01') }),
    ).rejects.toThrow(PeriodoInicialRetroativoError);
  });

  it('deriva metaId da Meta vigente em Proposta POR_META [ADR-024]', async () => {
    const prisma = criarPrismaMock([propostaPorMeta], [cargoPorMeta], [versaoVigentePorMeta], [metaAtiva]);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    const empregados = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p2',
      cargoId: 'c2',
      quantidade: 3,
      categoria: 'ESTAGIARIO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregados.every((e) => e.metaId === 'm1')).toBe(true);
  });

  it('bloqueia Proposta POR_META sem Meta cadastrada', async () => {
    const prisma = criarPrismaMock([propostaPorMeta], [cargoPorMeta], [versaoVigentePorMeta], []);
    const useCase = new CadastrarEmpregadosEmLoteUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', propostaId: 'p2', cargoId: 'c2', quantidade: 2, categoria: 'EMPREGADO', periodoInicio: new Date('2026-02-01') }),
    ).rejects.toThrow(MetaNaoEncontradaError);
  });
});
