import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ImportarCargoRubiUseCase } from './ImportarCargoRubiUseCase';
import { CargoNaoEncontradoError } from '@/domain/plano-contas/errors';
import type { CandidatoCargoRubi } from '@/infrastructure/integrations/rubi/types';

type CargoMock = {
  id: string;
  tenantId: string;
  codigoCargo: string;
  nomeCargoMercado: string;
  tabSalCodigo: string | null;
  tabSalDescricao: string | null;
  faixaCodigo: string | null;
  faixaDescricao: string | null;
  nivelCodigo: string | null;
  nivelDescricao: string | null;
  salarioReal: Prisma.Decimal | null;
  statusSyncSalario: string;
  syncedAt: Date | null;
};

function criarPrismaMock(cargo: CargoMock | null) {
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
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base };
}

const cargoNovo: CargoMock = {
  id: 'c1',
  tenantId: 't1',
  codigoCargo: 'CARGO-2026-0001',
  nomeCargoMercado: 'Cargo Rascunho',
  tabSalCodigo: null,
  tabSalDescricao: null,
  faixaCodigo: null,
  faixaDescricao: null,
  nivelCodigo: null,
  nivelDescricao: null,
  salarioReal: null,
  statusSyncSalario: 'PENDENTE',
  syncedAt: null,
};

const candidato1: CandidatoCargoRubi = {
  nomeCargoMercado: 'Analista de Sistemas Pleno',
  tabSalCodigo: '01',
  tabSalDescricao: '01 — Tabela Administrativa',
  faixaCodigo: 'A',
  faixaDescricao: 'A — Faixa Inicial',
  nivelCodigo: '03',
  nivelDescricao: '03 — Nível Sênior',
  salarioReal: new Prisma.Decimal(5300),
};

const candidato2: CandidatoCargoRubi = {
  nomeCargoMercado: 'Analista de Sistemas Sênior',
  tabSalCodigo: '02',
  tabSalDescricao: '02 — Tabela Técnica',
  faixaCodigo: 'B',
  faixaDescricao: 'B — Faixa Intermediária',
  nivelCodigo: '02',
  nivelDescricao: '02 — Nível Pleno',
  salarioReal: new Prisma.Decimal(7200),
};

describe('ImportarCargoRubiUseCase [ADR-045, US-132]', () => {
  it('importa os 5 campos de uma vez e grava auditoria CARGO_IMPORTADO_RUBI [Cenário 1]', async () => {
    const { base } = criarPrismaMock(cargoNovo);
    const useCase = new ImportarCargoRubiUseCase(base as never);

    const cargo = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', cargoId: 'c1', candidato: candidato1 });

    expect(cargo.nomeCargoMercado).toBe('Analista de Sistemas Pleno');
    expect(cargo.tabSalCodigo).toBe('01');
    expect(cargo.faixaCodigo).toBe('A');
    expect(cargo.nivelCodigo).toBe('03');
    expect(cargo.salarioReal?.toString()).toBe('5300');
    expect(cargo.statusSyncSalario).toBe('SINCRONIZADO');
    expect(cargo.syncedAt).toBeInstanceOf(Date);

    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'CARGO_IMPORTADO_RUBI',
          dadosSerializados: expect.objectContaining({
            cargoId: 'c1',
            anterior: expect.objectContaining({ nomeCargoMercado: 'Cargo Rascunho', salarioReal: null }),
            novo: expect.objectContaining({ nomeCargoMercado: 'Analista de Sistemas Pleno', salarioReal: '5300' }),
          }),
        }),
      }),
    );
  });

  it('reimportação substitui os 5 campos juntos, nunca parcialmente [Cenário 4]', async () => {
    const cargoJaImportado: CargoMock = {
      ...cargoNovo,
      nomeCargoMercado: candidato1.nomeCargoMercado,
      tabSalCodigo: candidato1.tabSalCodigo,
      tabSalDescricao: candidato1.tabSalDescricao,
      faixaCodigo: candidato1.faixaCodigo,
      faixaDescricao: candidato1.faixaDescricao,
      nivelCodigo: candidato1.nivelCodigo,
      nivelDescricao: candidato1.nivelDescricao,
      salarioReal: candidato1.salarioReal,
      statusSyncSalario: 'SINCRONIZADO',
      syncedAt: new Date('2026-08-01'),
    };
    const { base } = criarPrismaMock(cargoJaImportado);
    const useCase = new ImportarCargoRubiUseCase(base as never);

    const cargo = await useCase.execute({ tenantId: 't1', usuarioId: 'u1', cargoId: 'c1', candidato: candidato2 });

    // Todos os 5 campos vieram do candidato2 — nenhum resquício do candidato1.
    expect(cargo.nomeCargoMercado).toBe(candidato2.nomeCargoMercado);
    expect(cargo.tabSalCodigo).toBe(candidato2.tabSalCodigo);
    expect(cargo.faixaCodigo).toBe(candidato2.faixaCodigo);
    expect(cargo.nivelCodigo).toBe(candidato2.nivelCodigo);
    expect(cargo.salarioReal?.toString()).toBe('7200');

    expect(base.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dadosSerializados: expect.objectContaining({
            anterior: expect.objectContaining({ nomeCargoMercado: candidato1.nomeCargoMercado, salarioReal: '5300' }),
            novo: expect.objectContaining({ nomeCargoMercado: candidato2.nomeCargoMercado, salarioReal: '7200' }),
          }),
        }),
      }),
    );
  });

  it('bloqueia importação quando o Cargo não existe ou não pertence ao tenant', async () => {
    const { base } = criarPrismaMock(cargoNovo);
    const useCase = new ImportarCargoRubiUseCase(base as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', cargoId: 'inexistente', candidato: candidato1 }),
    ).rejects.toThrow(CargoNaoEncontradoError);

    await expect(
      useCase.execute({ tenantId: 'outro-tenant', usuarioId: 'u1', cargoId: 'c1', candidato: candidato1 }),
    ).rejects.toThrow(CargoNaoEncontradoError);
  });
});
