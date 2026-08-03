import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CadastrarCargoUseCase } from './CadastrarCargoUseCase';
import {
  CamposObrigatoriosCargoError,
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
  unidadeFuncionalId: string;
};

function criarPrismaMock(unidades: UnidadeMock[], cargosExistentes: CargoMock[] = []) {
  const cargos = [...cargosExistentes];
  let idSeq = 1;

  const base = {
    unidadeFuncional: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; propostaId: string } }) =>
        Promise.resolve(
          unidades.find((u) => u.id === where.id && u.tenantId === where.tenantId && u.propostaId === where.propostaId) ??
            null,
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
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const unidadeAnalitica: UnidadeMock = { id: 'u1', tenantId: 't1', propostaId: 'p1', tipoNivel: 'ANALITICO_SETOR' };
const unidadeSintetica: UnidadeMock = { id: 'u2', tenantId: 't1', propostaId: 'p1', tipoNivel: 'SINTETICO_GERENCIA' };

function providerFixo(valor: number | null): CargoRubiProvider {
  return { buscarSalarioReal: vi.fn().mockResolvedValue(valor === null ? null : new Prisma.Decimal(valor)) };
}

describe('CadastrarCargoUseCase [US-107]', () => {
  it('cadastra Cargo com Fonte Ativa = Mercado e registra auditoria [Cenário 1]', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica]);
    const provider = providerFixo(5300);
    const useCase = new CadastrarCargoUseCase(prisma as never, provider);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      unidadeFuncionalId: 'u1',
      nomeCargoMercado: 'Analista de Compras Pleno',
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4500,
      salarioMercadoMaximo: 6200,
      fonteAtiva: 'MERCADO_MAXIMO',
    });

    expect(cargo.codigoCargo).toMatch(/^CARGO-\d{4}-0001$/);
    expect(cargo.salarioReal?.toString()).toBe('5300');
    expect(cargo.salarioTotal.toString()).toBe('6200');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'CARGO_CRIADO' }) }),
    );
  });

  it('bloqueia cadastro sem vínculo funcional [Cenário 2]', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica]);
    const useCase = new CadastrarCargoUseCase(prisma as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        unidadeFuncionalId: '',
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(VinculoFuncionalObrigatorioError);
  });

  it('bloqueia vínculo com nó Sintético [Cenário 3]', async () => {
    const prisma = criarPrismaMock([unidadeSintetica]);
    const useCase = new CadastrarCargoUseCase(prisma as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        unidadeFuncionalId: 'u2',
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(VinculoCargoNaoAnaliticoError);
  });

  it('bloqueia quando a unidade funcional não existe', async () => {
    const prisma = criarPrismaMock([]);
    const useCase = new CadastrarCargoUseCase(prisma as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        unidadeFuncionalId: 'inexistente',
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(UnidadeFuncionalNaoEncontradaError);
  });

  it('bloqueia cadastro sem campos obrigatórios', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica]);
    const useCase = new CadastrarCargoUseCase(prisma as never, providerFixo(5000));

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        propostaId: 'p1',
        unidadeFuncionalId: 'u1',
        nomeCargoMercado: '',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(CamposObrigatoriosCargoError);
  });

  it('calcula Salário Total somando Função Gratificada à Fonte Ativa [Cenário 5]', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica]);
    const useCase = new CadastrarCargoUseCase(prisma as never, providerFixo(5000));

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      unidadeFuncionalId: 'u1',
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
    const prisma = criarPrismaMock([unidadeAnalitica], [
      { id: 'c0', tenantId: 't1', codigoCargo: `CARGO-${new Date().getFullYear()}-0001`, propostaId: 'p1', unidadeFuncionalId: 'u1' },
    ]);
    const useCase = new CadastrarCargoUseCase(prisma as never, providerFixo(5000));

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      propostaId: 'p1',
      unidadeFuncionalId: 'u1',
      nomeCargoMercado: 'Assessor Técnico',
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4000,
      salarioMercadoMaximo: 5000,
      fonteAtiva: 'MERCADO_MINIMO',
    });

    expect(cargo.codigoCargo).toMatch(/-0002$/);
  });
});
