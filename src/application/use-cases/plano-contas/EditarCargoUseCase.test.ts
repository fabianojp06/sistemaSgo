import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarCargoUseCase } from './EditarCargoUseCase';
import { CargoNaoEncontradoError, VinculoCargoNaoAnaliticoError } from '@/domain/plano-contas/errors';
import { alertaDesvioMercado } from '@/domain/plano-contas/calcularSalarioTotalCargo';

type UnidadeMock = { id: string; tenantId: string; propostaId: string; tipoNivel: string };
type CargoMock = {
  id: string;
  tenantId: string;
  propostaId: string;
  unidadeFuncionalId: string;
  codigoCargo: string;
  salarioReal: Prisma.Decimal | null;
};

function criarPrismaMock(unidades: UnidadeMock[], cargo: CargoMock) {
  let atual = { ...cargo };

  const base = {
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(atual.tenantId === where.tenantId && atual.id === where.id ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<CargoMock> & { salarioTotal: Prisma.Decimal } }) => {
        atual = { ...atual, ...data };
        return Promise.resolve(atual);
      }),
    },
    unidadeFuncional: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string; propostaId: string } }) =>
        Promise.resolve(
          unidades.find((u) => u.id === where.id && u.tenantId === where.tenantId && u.propostaId === where.propostaId) ??
            null,
        ),
      ),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const unidadeAnalitica: UnidadeMock = { id: 'u1', tenantId: 't1', propostaId: 'p1', tipoNivel: 'ANALITICO_SETOR' };
const unidadeSintetica: UnidadeMock = { id: 'u2', tenantId: 't1', propostaId: 'p1', tipoNivel: 'SINTETICO_GERENCIA' };

const cargoBase: CargoMock = {
  id: 'c1',
  tenantId: 't1',
  propostaId: 'p1',
  unidadeFuncionalId: 'u1',
  codigoCargo: 'CARGO-2026-0001',
  salarioReal: new Prisma.Decimal(5300),
};

describe('EditarCargoUseCase [US-107]', () => {
  it('ignora tentativa de edição manual do Salário Real e processa o resto do update [Cenário 4]', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica], cargoBase);
    const useCase = new EditarCargoUseCase(prisma as never);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      cargoId: 'c1',
      unidadeFuncionalId: 'u1',
      nomeCargoMercado: 'Analista de Compras Sênior',
      periodoInicio: new Date('2026-01-01'),
      salarioMercadoMinimo: 4500,
      salarioMercadoMaximo: 6200,
      fonteAtiva: 'RUBI',
      // client tenta injetar um valor diferente — deve ser ignorado
      salarioReal: 99999,
    });

    // salarioReal permanece o valor originalmente persistido (5300), nunca o injetado (99999)
    expect(cargo.salarioReal?.toString()).toBe('5300');
    expect(cargo.salarioTotal.toString()).toBe('5300');
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'CARGO_EDITADO' }) }),
    );
  });

  it('bloqueia edição ao trocar vínculo para nó Sintético [Cenário 3]', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica, unidadeSintetica], cargoBase);
    const useCase = new EditarCargoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        cargoId: 'c1',
        unidadeFuncionalId: 'u2',
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(VinculoCargoNaoAnaliticoError);
  });

  it('bloqueia edição de cargo inexistente', async () => {
    const prisma = criarPrismaMock([unidadeAnalitica], cargoBase);
    const useCase = new EditarCargoUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        cargoId: 'inexistente',
        unidadeFuncionalId: 'u1',
        nomeCargoMercado: 'Analista',
        periodoInicio: new Date('2026-01-01'),
        salarioMercadoMinimo: 4000,
        salarioMercadoMaximo: 5000,
        fonteAtiva: 'MERCADO_MINIMO',
      }),
    ).rejects.toThrow(CargoNaoEncontradoError);
  });
});

describe('alertaDesvioMercado [US-107, Cenário 7]', () => {
  it('sinaliza quando o Salário Real está acima do teto de mercado', () => {
    expect(alertaDesvioMercado(7000, 4500, 6200)).toBe(true);
  });

  it('sinaliza quando o Salário Real está abaixo do piso de mercado', () => {
    expect(alertaDesvioMercado(3000, 4500, 6200)).toBe(true);
  });

  it('não sinaliza quando o Salário Real está dentro da faixa', () => {
    expect(alertaDesvioMercado(5300, 4500, 6200)).toBe(false);
  });

  it('não sinaliza quando não há Salário Real', () => {
    expect(alertaDesvioMercado(null, 4500, 6200)).toBe(false);
  });
});
