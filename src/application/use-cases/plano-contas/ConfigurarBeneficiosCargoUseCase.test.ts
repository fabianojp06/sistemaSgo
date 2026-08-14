import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ConfigurarBeneficiosCargoUseCase } from './ConfigurarBeneficiosCargoUseCase';
import {
  CargoNaoEncontradoError,
  EncargosSociaisPercentualInvalidoError,
  PercentualValorAdicionalInvalidoError,
  TipoValorAdicionalObrigatorioError,
  ValorAdicionalNegativoError,
  ValorBeneficioNegativoError,
} from '@/domain/plano-contas/errors';

type CargoMock = {
  id: string;
  tenantId: string;
  codigoCargo: string;
  salarioTotal: Prisma.Decimal;
  encargosSociaisPct: Prisma.Decimal;
  vaAtivo: boolean;
  vaValorUnitario: Prisma.Decimal;
  vrAtivo: boolean;
  vrValorUnitario: Prisma.Decimal;
  planoSaudeAtivo: boolean;
  planoSaudeFaixa: string | null;
  planoSaudeValor: Prisma.Decimal;
  planoOdontoAtivo: boolean;
  planoOdontoValor: Prisma.Decimal;
  seguroVidaAtivo: boolean;
  seguroVidaValor: Prisma.Decimal;
  auxilioCrecheAtivo: boolean;
  auxilioCrecheValor: Prisma.Decimal;
  transporteAtivo: boolean;
  transporteValorUnitario: Prisma.Decimal;
  periculosidadeAtivo: boolean;
  periculosidadeTipo: string | null;
  periculosidadeValor: Prisma.Decimal;
  insalubridadeAtivo: boolean;
  insalubridadeTipo: string | null;
  insalubridadeValor: Prisma.Decimal;
  custoTotalCargo: Prisma.Decimal;
};

function criarPrismaMock(cargo: CargoMock | null, diasUteisPadrao: number | null = 22) {
  let atual = cargo ? { ...cargo } : null;

  const base = {
    cargo: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) =>
        Promise.resolve(atual && atual.tenantId === where.tenantId && atual.id === where.id ? atual : null),
      ),
      update: vi.fn(({ data }: { data: Partial<CargoMock> }) => {
        atual = { ...(atual as CargoMock), ...data };
        return Promise.resolve(atual);
      }),
    },
    parametroSistema: {
      findUnique: vi.fn(() => Promise.resolve(diasUteisPadrao === null ? null : { diasUteisPadrao })),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, getAtual: () => atual };
}

function cargoZerado(overrides: Partial<CargoMock> = {}): CargoMock {
  return {
    id: 'c1',
    tenantId: 't1',
    codigoCargo: 'CARGO-2026-0001',
    salarioTotal: new Prisma.Decimal(6200),
    encargosSociaisPct: new Prisma.Decimal(0),
    vaAtivo: false,
    vaValorUnitario: new Prisma.Decimal(0),
    vrAtivo: false,
    vrValorUnitario: new Prisma.Decimal(0),
    planoSaudeAtivo: false,
    planoSaudeFaixa: null,
    planoSaudeValor: new Prisma.Decimal(0),
    planoOdontoAtivo: false,
    planoOdontoValor: new Prisma.Decimal(0),
    seguroVidaAtivo: false,
    seguroVidaValor: new Prisma.Decimal(0),
    auxilioCrecheAtivo: false,
    auxilioCrecheValor: new Prisma.Decimal(0),
    transporteAtivo: false,
    transporteValorUnitario: new Prisma.Decimal(0),
    periculosidadeAtivo: false,
    periculosidadeTipo: null,
    periculosidadeValor: new Prisma.Decimal(0),
    insalubridadeAtivo: false,
    insalubridadeTipo: null,
    insalubridadeValor: new Prisma.Decimal(0),
    custoTotalCargo: new Prisma.Decimal(0),
    ...overrides,
  };
}

describe('ConfigurarBeneficiosCargoUseCase [US-107a]', () => {
  it('calcula custoTotalCargo somando salário + encargos + benefícios ativos [Cenário 1]', async () => {
    const { base, getAtual } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      cargoId: 'c1',
      encargosSociaisPct: 68,
      vaAtivo: true,
      vaValorUnitario: 30,
      vrAtivo: true,
      vrValorUnitario: 25,
      planoSaudeAtivo: true,
      planoSaudeFaixa: 'INTERMEDIARIO',
      planoSaudeValor: 450,
      planoOdontoAtivo: false,
      planoOdontoValor: 0,
      seguroVidaAtivo: true,
      seguroVidaValor: 40,
      auxilioCrecheAtivo: false,
      auxilioCrecheValor: 0,
      transporteAtivo: false,
      transporteValorUnitario: 0,
      periculosidadeAtivo: false,
      periculosidadeValor: 0,
      insalubridadeAtivo: false,
      insalubridadeValor: 0,
    });

    // encargos = 6200*0.68 = 4216; beneficios = 30*22 + 25*22 + 450 + 40 = 660+550+450+40=1700
    // total = 6200 + 4216 + 1700 = 12116
    expect(cargo.custoTotalCargo.toString()).toBe('12116');
    expect(getAtual()?.custoTotalCargo.toString()).toBe('12116');
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'CARGO_BENEFICIOS_CONFIGURADOS' }) }),
    );
  });

  it('benefício inativo não entra na soma mesmo com valor preenchido [Cenário 2]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      cargoId: 'c1',
      encargosSociaisPct: 0,
      vaAtivo: false,
      vaValorUnitario: 999,
      vrAtivo: false,
      vrValorUnitario: 999,
      planoSaudeAtivo: false,
      planoSaudeValor: 999,
      planoOdontoAtivo: false,
      planoOdontoValor: 999,
      seguroVidaAtivo: false,
      seguroVidaValor: 999,
      auxilioCrecheAtivo: false,
      auxilioCrecheValor: 999,
      transporteAtivo: false,
      transporteValorUnitario: 0,
      periculosidadeAtivo: false,
      periculosidadeValor: 0,
      insalubridadeAtivo: false,
      insalubridadeValor: 0,
    });

    expect(cargo.custoTotalCargo.toString()).toBe('6200'); // só o salário
  });

  it('bloqueia percentual de Encargos Sociais fora da faixa 0-100 [Cenário 3]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        cargoId: 'c1',
        encargosSociaisPct: 150,
        vaAtivo: false,
        vaValorUnitario: 0,
        vrAtivo: false,
        vrValorUnitario: 0,
        planoSaudeAtivo: false,
        planoSaudeValor: 0,
        planoOdontoAtivo: false,
        planoOdontoValor: 0,
        seguroVidaAtivo: false,
        seguroVidaValor: 0,
        auxilioCrecheAtivo: false,
        auxilioCrecheValor: 0,
        transporteAtivo: false,
        transporteValorUnitario: 0,
        periculosidadeAtivo: false,
        periculosidadeValor: 0,
        insalubridadeAtivo: false,
        insalubridadeValor: 0,
      }),
    ).rejects.toThrow(EncargosSociaisPercentualInvalidoError);
  });

  it('bloqueia valor negativo de benefício [Cenário 4]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        cargoId: 'c1',
        encargosSociaisPct: 0,
        vaAtivo: true,
        vaValorUnitario: -10,
        vrAtivo: false,
        vrValorUnitario: 0,
        planoSaudeAtivo: false,
        planoSaudeValor: 0,
        planoOdontoAtivo: false,
        planoOdontoValor: 0,
        seguroVidaAtivo: false,
        seguroVidaValor: 0,
        auxilioCrecheAtivo: false,
        auxilioCrecheValor: 0,
        transporteAtivo: false,
        transporteValorUnitario: 0,
        periculosidadeAtivo: false,
        periculosidadeValor: 0,
        insalubridadeAtivo: false,
        insalubridadeValor: 0,
      }),
    ).rejects.toThrow(ValorBeneficioNegativoError);
  });

  it('recalcula custoTotalCargo ao editar (registra CARGO_BENEFICIOS_EDITADOS) [Cenário 5]', async () => {
    const cargoJaConfigurado = cargoZerado({ encargosSociaisPct: new Prisma.Decimal(68), custoTotalCargo: new Prisma.Decimal(10432) });
    const { base } = criarPrismaMock(cargoJaConfigurado);
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      cargoId: 'c1',
      encargosSociaisPct: 70,
      vaAtivo: false,
      vaValorUnitario: 0,
      vrAtivo: false,
      vrValorUnitario: 0,
      planoSaudeAtivo: false,
      planoSaudeValor: 0,
      planoOdontoAtivo: false,
      planoOdontoValor: 0,
      seguroVidaAtivo: false,
      seguroVidaValor: 0,
      auxilioCrecheAtivo: false,
      auxilioCrecheValor: 0,
      transporteAtivo: false,
      transporteValorUnitario: 0,
      periculosidadeAtivo: false,
      periculosidadeValor: 0,
      insalubridadeAtivo: false,
      insalubridadeValor: 0,
    });

    expect(cargo.custoTotalCargo.toString()).toBe('10540'); // 6200 + 6200*0.70
    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'CARGO_BENEFICIOS_EDITADOS' }) }),
    );
  });

  it('bloqueia quando o Cargo não existe', async () => {
    const { base } = criarPrismaMock(null);
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        cargoId: 'inexistente',
        encargosSociaisPct: 0,
        vaAtivo: false,
        vaValorUnitario: 0,
        vrAtivo: false,
        vrValorUnitario: 0,
        planoSaudeAtivo: false,
        planoSaudeValor: 0,
        planoOdontoAtivo: false,
        planoOdontoValor: 0,
        seguroVidaAtivo: false,
        seguroVidaValor: 0,
        auxilioCrecheAtivo: false,
        auxilioCrecheValor: 0,
        transporteAtivo: false,
        transporteValorUnitario: 0,
        periculosidadeAtivo: false,
        periculosidadeValor: 0,
        insalubridadeAtivo: false,
        insalubridadeValor: 0,
      }),
    ).rejects.toThrow(CargoNaoEncontradoError);
  });

  it('usa diasUteisPadrao=22 quando não há ParametroSistema para o tenant', async () => {
    const { base } = criarPrismaMock(cargoZerado(), null);
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      cargoId: 'c1',
      encargosSociaisPct: 0,
      vaAtivo: true,
      vaValorUnitario: 10,
      vrAtivo: false,
      vrValorUnitario: 0,
      planoSaudeAtivo: false,
      planoSaudeValor: 0,
      planoOdontoAtivo: false,
      planoOdontoValor: 0,
      seguroVidaAtivo: false,
      seguroVidaValor: 0,
      auxilioCrecheAtivo: false,
      auxilioCrecheValor: 0,
      transporteAtivo: false,
      transporteValorUnitario: 0,
      periculosidadeAtivo: false,
      periculosidadeValor: 0,
      insalubridadeAtivo: false,
      insalubridadeValor: 0,
    });

    expect(cargo.custoTotalCargo.toString()).toBe('6420'); // 6200 + 10*22
  });

  // ADR-044 / US-136 — Periculosidade e Insalubridade.
  const inputBase = {
    tenantId: 't1',
    usuarioId: 'u1',
    cargoId: 'c1',
    encargosSociaisPct: 0,
    vaAtivo: false,
    vaValorUnitario: 0,
    vrAtivo: false,
    vrValorUnitario: 0,
    planoSaudeAtivo: false,
    planoSaudeValor: 0,
    planoOdontoAtivo: false,
    planoOdontoValor: 0,
    seguroVidaAtivo: false,
    seguroVidaValor: 0,
    auxilioCrecheAtivo: false,
    auxilioCrecheValor: 0,
    transporteAtivo: false,
    transporteValorUnitario: 0,
  };

  it('Periculosidade percentual é calculada sobre salarioTotal e somada depois de Encargos [ADR-044]', async () => {
    const { base } = criarPrismaMock(cargoZerado({ encargosSociaisPct: new Prisma.Decimal(10) }));
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      ...inputBase,
      encargosSociaisPct: 10,
      periculosidadeAtivo: true,
      periculosidadeTipo: 'PERCENTUAL',
      periculosidadeValor: 30,
      insalubridadeAtivo: false,
      insalubridadeValor: 0,
    });

    // encargos = 6200*0.10 = 620; periculosidade = 6200*0.30 = 1860; total = 6200+620+1860 = 8680
    expect(cargo.custoTotalCargo.toString()).toBe('8680');
  });

  it('Insalubridade valor fixo é somada direto, sem aplicar percentual [ADR-044]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      ...inputBase,
      periculosidadeAtivo: false,
      periculosidadeValor: 0,
      insalubridadeAtivo: true,
      insalubridadeTipo: 'VALOR_FIXO',
      insalubridadeValor: 250,
    });

    expect(cargo.custoTotalCargo.toString()).toBe('6450'); // 6200 + 250
  });

  it('bloqueia percentual de Periculosidade fora da faixa 0-100 [ADR-044, Cenário 3]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        ...inputBase,
        periculosidadeAtivo: true,
        periculosidadeTipo: 'PERCENTUAL',
        periculosidadeValor: 150,
        insalubridadeAtivo: false,
        insalubridadeValor: 0,
      }),
    ).rejects.toThrow(PercentualValorAdicionalInvalidoError);
  });

  it('bloqueia valor negativo de Periculosidade em qualquer tipo [ADR-044, Cenário 4]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        ...inputBase,
        periculosidadeAtivo: true,
        periculosidadeTipo: 'VALOR_FIXO',
        periculosidadeValor: -10,
        insalubridadeAtivo: false,
        insalubridadeValor: 0,
      }),
    ).rejects.toThrow(ValorAdicionalNegativoError);
  });

  it('bloqueia valor negativo de Insalubridade em qualquer tipo [ADR-044, Cenário 4]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        ...inputBase,
        periculosidadeAtivo: false,
        periculosidadeValor: 0,
        insalubridadeAtivo: true,
        insalubridadeTipo: 'PERCENTUAL',
        insalubridadeValor: -5,
      }),
    ).rejects.toThrow(ValorAdicionalNegativoError);
  });

  it('bloqueia Ativo=true sem Tipo informado [ADR-044, Cenário 6]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    await expect(
      useCase.execute({
        ...inputBase,
        periculosidadeAtivo: true,
        periculosidadeTipo: null,
        periculosidadeValor: 30,
        insalubridadeAtivo: false,
        insalubridadeValor: 0,
      }),
    ).rejects.toThrow(TipoValorAdicionalObrigatorioError);
  });

  it('Periculosidade inativa não entra no cálculo mesmo com valor preenchido [ADR-044, Cenário 6]', async () => {
    const { base } = criarPrismaMock(cargoZerado());
    const useCase = new ConfigurarBeneficiosCargoUseCase(base as never);

    const cargo = await useCase.execute({
      ...inputBase,
      periculosidadeAtivo: false,
      periculosidadeTipo: 'PERCENTUAL',
      periculosidadeValor: 30,
      insalubridadeAtivo: false,
      insalubridadeValor: 0,
    });

    expect(cargo.custoTotalCargo.toString()).toBe('6200'); // só o salário, periculosidade ignorada
  });
});
