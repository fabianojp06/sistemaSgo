import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarEmpregadoUseCase } from './CadastrarEmpregadoUseCase';
import { CargoObrigatorioEmpregadoError, MetaNaoEncontradaError, PeriodoInicialRetroativoError } from '@/domain/plano-contas/errors';

type PropostaMock = { id: string; tenantId: string; categoria: string; status: string; dataInicio: Date };
type VersaoMock = { id: string; tenantId: string; propostaId: string; vigente: boolean; ativa: boolean };
type MetaMock = { id: string; tenantId: string; versaoId: string; ativo: boolean };
type CargoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  codigoCargo: string;
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
          (() => {
            const c = cargos.find((c) => c.tenantId === where.tenantId && c.id === where.id && c.propostaId === where.propostaId);
            return c
              ? {
                  salarioTotal: c.custoTotalCargo,
                  contaGratificacaoId: null,
                  contaEncargosSociaisId: null,
                  contaValeAlimentacaoId: null,
                  contaValeRefeicaoId: null,
                  contaValeTransporteId: null,
                  contaPlanoOdontologicoId: null,
                  contaSeguroVidaId: null,
                  contaPlanoSaudeId: null,
                  contaAuxilioCrecheId: null,
                  encargosSociaisPct: 0,
                  vaAtivo: false,
                  vaValorUnitario: 0,
                  vrAtivo: false,
                  vrValorUnitario: 0,
                  planoSaudeAtivo: false,
                  planoSaudeFaixa: null,
                  planoSaudeValor: 0,
                  planoOdontoAtivo: false,
                  planoOdontoValor: 0,
                  seguroVidaAtivo: false,
                  seguroVidaValor: 0,
                  auxilioCrecheAtivo: false,
                  auxilioCrecheValor: 0,
                  transporteAtivo: false,
                  transporteValorUnitario: 0,
                  ...c,
                }
              : null;
          })(),
        ),
      ),
    },
    empregadoHeadcount: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: `e${idSeq++}`, ativo: true, ...data })),
    },
    parametroSistema: {
      findUnique: vi.fn().mockResolvedValue(null),
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
const versaoVigentePorMeta: VersaoMock = { id: 'v2', tenantId: 't1', propostaId: 'p2', vigente: true, ativa: true };
const metaAtiva: MetaMock = { id: 'm1', tenantId: 't1', versaoId: 'v2', ativo: true };
const cargo: CargoMock = {
  id: 'c1',
  tenantId: 't1',
  propostaId: 'p1',
  codigoCargo: 'CARGO-2026-0001',
  custoTotalCargo: new Prisma.Decimal(6200),
  alocacoes: [{ percentual: 100, unidadeFuncional: { nome: 'Setor de Compras' } }],
};
const cargoPorMeta: CargoMock = {
  id: 'c2',
  tenantId: 't1',
  propostaId: 'p2',
  codigoCargo: 'CARGO-2026-0002',
  custoTotalCargo: new Prisma.Decimal(5000),
  alocacoes: [{ percentual: 100, unidadeFuncional: { nome: 'Setor de Projetos' } }],
};

describe('CadastrarEmpregadoUseCase [US-108]', () => {
  it('cadastra Empregado herdando custo e vínculo do Cargo [Cenário 1]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      cargoId: 'c1',
      nome: 'Maria da Silva',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregado.custoTotalMensal.toString()).toBe('6200');
    expect(empregado.vinculoFuncionalHerdado).toBe('Setor de Compras');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'EMPREGADO_CRIADO' }) }),
    );
  });

  it('grava "A CONTRATAR" quando o nome vem vazio [Cenário 2, RN0249]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      cargoId: 'c1',
      nome: '',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregado.nome).toBe('A CONTRATAR');
  });

  it('cadastra Empregado em Proposta POR_META derivando metaId da Meta vigente [Cenário 3, ADR-024]', async () => {
    const prisma = criarPrismaMock([propostaPorMeta], [cargoPorMeta], [versaoVigentePorMeta], [metaAtiva]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    const empregado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p2',
      cargoId: 'c2',
      categoria: 'EMPREGADO',
      periodoInicio: new Date('2026-02-01'),
    });

    expect(empregado.metaId).toBe('m1');
  });

  it('bloqueia cadastro em Proposta POR_META sem Meta cadastrada', async () => {
    const prisma = criarPrismaMock([propostaPorMeta], [cargoPorMeta], [versaoVigentePorMeta], []);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p2',
        cargoId: 'c2',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2026-02-01'),
      }),
    ).rejects.toThrow(MetaNaoEncontradaError);
  });

  it('bloqueia cadastro sem Cargo [Cenário 4]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        cargoId: '',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2026-02-01'),
      }),
    ).rejects.toThrow(CargoObrigatorioEmpregadoError);
  });

  it('bloqueia Período Inicial anterior à data de início da Proposta [Cenário 5]', async () => {
    const prisma = criarPrismaMock([propostaConsolidada], [cargo]);
    const useCase = new CadastrarEmpregadoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        cargoId: 'c1',
        categoria: 'EMPREGADO',
        periodoInicio: new Date('2025-12-01'),
      }),
    ).rejects.toThrow(PeriodoInicialRetroativoError);
  });
});
