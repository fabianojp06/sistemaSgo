import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarCargoUseCase } from './CadastrarCargoUseCase';
import {
  CamposObrigatoriosCargoError,
  SomaAlocacaoCargoInvalidaError,
  UnidadeFuncionalNaoEncontradaError,
  VinculoCargoNaoAnaliticoError,
  VinculoFuncionalObrigatorioError,
} from '@/domain/plano-contas/errors';
import type { CargoRubiProvider } from '@/infrastructure/integrations/rubi/types';

type UnidadeMock = { id: string; tenantId: string; propostaId: string; tipoNivel: string };
type CargoMock = {
  id: string;
  tenantId: string;
  codigoCargo: string;
  propostaId: string;
};
type AlocacaoMock = { id: string; tenantId: string; cargoId: string; unidadeFuncionalId: string; percentual: number };

function criarPrismaMock(unidades: UnidadeMock[], cargosExistentes: CargoMock[] = []) {
  const cargos = [...cargosExistentes];
  const alocacoes: AlocacaoMock[] = [];
  let idSeq = 1;

  const base = {
    unidadeFuncional: {
      findMany: vi.fn(({ where }: { where: { id: { in: string[] }; tenantId: string; propostaId: string } }) =>
        Promise.resolve(
          unidades.filter((u) => where.id.in.includes(u.id) && u.tenantId === where.tenantId && u.propostaId === where.propostaId),
        ),
      ),
    },
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; codigoCargo: { startsWith: string } } }) => {
        const candidatos = cargos
          .filter((c) => c.tenantId === where.tenantId && c.codigoCargo.startsWith(where.codigoCargo.startsWith))
          .sort((a, b) => b.codigoCargo.localeCompare(a.codigoCargo));
        return Promise.resolve(candidatos[0] ?? null);
      }),
      create: vi.fn(({ data }: { data: Omit<CargoMock, 'id'> }) => {
        const novo = { id: `c${idSeq++}`, ...data };
        cargos.push(novo as CargoMock);
        return Promise.resolve(novo);
      }),
    },
    cargoAlocacaoPercentual: {
      createMany: vi.fn(({ data }: { data: Omit<AlocacaoMock, 'id'>[] }) => {
        for (const item of data) alocacoes.push({ id: `al${idSeq++}`, ...item });
        return Promise.resolve({ count: data.length });
      }),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAlocacoes: () => alocacoes };
}

const unidadeAnalitica: UnidadeMock = { id: 'u1', tenantId: 't1', propostaId: 'p1', tipoNivel: 'ANALITICO_SETOR' };
const unidadeAnaliticaB: UnidadeMock = { id: 'u3', tenantId: 't1', propostaId: 'p1', tipoNivel: 'ANALITICO_COORDENADORIA' };
const unidadeSintetica: UnidadeMock = { id: 'u2', tenantId: 't1', propostaId: 'p1', tipoNivel: 'SINTETICO_GERENCIA' };

function providerFixo(valor: number | null): CargoRubiProvider {
  return { buscarSalarioReal: vi.fn().mockResolvedValue(valor === null ? null : new Prisma.Decimal(valor)) };
}

describe('CadastrarCargoUseCase [US-107, ADR-026]', () => {
  it('cadastra Cargo com Fonte Ativa = Mercado e registra auditoria [Cenário 1]', async () => {
    const { base, getAlocacoes } = criarPrismaMock([unidadeAnalitica]);
    const provider = providerFixo(5300);
    const useCase = new CadastrarCargoUseCase(base as never, provider);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      alocacoes: [{ unidadeFuncionalId: 'u1', percentual: 100 }],
      nomeCargoMercado: 'Analista de Compras Pleno',
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4500,
      salarioMercadoMaximo: 6200,
      fonteAtiva: 'MERCADO_MAXIMO',
    });

    expect(cargo.codigoCargo).toMatch(/^CARGO-\d{4}-0001$/);
    expect(cargo.salarioReal?.toString()).toBe('5300');
    expect(cargo.salarioTotal.toString()).toBe('6200');
    expect(getAlocacoes()).toHaveLength(1);
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'CARGO_CRIADO' }) }),
    );
  });

  it('cadastra Cargo rateado entre múltiplas unidades somando 100% [RN_EST_03, ADR-026]', async () => {
    const { base, getAlocacoes } = criarPrismaMock([unidadeAnalitica, unidadeAnaliticaB]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      alocacoes: [
        { unidadeFuncionalId: 'u1', percentual: 50 },
        { unidadeFuncionalId: 'u3', percentual: 50 },
      ],
      nomeCargoMercado: 'Analista Compartilhado',
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4000,
      salarioMercadoMaximo: 5000,
      fonteAtiva: 'MERCADO_MINIMO',
    });

    expect(getAlocacoes()).toHaveLength(2);
  });

  it('bloqueia cadastro sem vínculo funcional [Cenário 2]', async () => {
    const { base } = criarPrismaMock([unidadeAnalitica]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        alocacoes: [],
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(VinculoFuncionalObrigatorioError);
  });

  it('bloqueia soma de alocações diferente de 100% [RN_EST_03]', async () => {
    const { base } = criarPrismaMock([unidadeAnalitica, unidadeAnaliticaB]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        alocacoes: [
          { unidadeFuncionalId: 'u1', percentual: 40 },
          { unidadeFuncionalId: 'u3', percentual: 50 },
        ],
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(SomaAlocacaoCargoInvalidaError);
  });

  it('bloqueia vínculo com nó Sintético [Cenário 3]', async () => {
    const { base } = criarPrismaMock([unidadeSintetica]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        alocacoes: [{ unidadeFuncionalId: 'u2', percentual: 100 }],
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(VinculoCargoNaoAnaliticoError);
  });

  it('bloqueia quando a unidade funcional não existe', async () => {
    const { base } = criarPrismaMock([]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        alocacoes: [{ unidadeFuncionalId: 'inexistente', percentual: 100 }],
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(UnidadeFuncionalNaoEncontradaError);
  });

  it('bloqueia cadastro sem campos obrigatórios', async () => {
    const { base } = criarPrismaMock([unidadeAnalitica]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        alocacoes: [{ unidadeFuncionalId: 'u1', percentual: 100 }],
        nomeCargoMercado: '',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(CamposObrigatoriosCargoError);
  });

  it('calcula Salário Total somando Função Gratificada à Fonte Ativa [Cenário 5]', async () => {
    const { base } = criarPrismaMock([unidadeAnalitica]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      alocacoes: [{ unidadeFuncionalId: 'u1', percentual: 100 }],
      nomeCargoMercado: 'Analista de Compras',
      funcaoGratificada: 800,
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4500,
      salarioMercadoMaximo: 6200,
      fonteAtiva: 'MERCADO_MINIMO',
    });

    expect(cargo.salarioTotal.toString()).toBe('5300');
  });

  it('gera o próximo sequencial do código quando já existe um cargo no ano', async () => {
    const { base } = criarPrismaMock([unidadeAnalitica], [
      { id: 'c0', tenantId: 't1', codigoCargo: `CARGO-${new Date().getFullYear()}-0001`, propostaId: 'p1' },
    ]);
    const useCase = new CadastrarCargoUseCase(base as never, providerFixo(5000));

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      alocacoes: [{ unidadeFuncionalId: 'u1', percentual: 100 }],
      nomeCargoMercado: 'Assessor Técnico',
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4000,
      salarioMercadoMaximo: 5000,
      fonteAtiva: 'MERCADO_MINIMO',
    });

    expect(cargo.codigoCargo).toMatch(/-0002$/);
  });
});
