import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { EditarAliquotaImpostoUseCase } from './EditarAliquotaImpostoUseCase';
import {
  AliquotaImpostoNomeDuplicadoError,
  AliquotaImpostoParametroNaoEncontradaError,
  ConflitoConcorrenciaError,
} from '@/domain/plano-contas/errors';

type AliquotaMock = {
  id: string;
  tenantId: string;
  nome: string;
  nomeNormalizado: string;
  aliquotaPct: Prisma.Decimal;
  tipoIncidencia: string;
  dataInicioVigencia: Date;
  version: number;
};

function criarPrismaMock(existentes: AliquotaMock[]) {
  const registros = new Map(existentes.map((e) => [e.id, { ...e }]));
  const base = {
    aliquotaImpostoParametro: {
      findFirst: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const r = registros.get(where.id);
        return Promise.resolve(r && r.tenantId === where.tenantId ? r : null);
      }),
      findUnique: vi.fn(({ where }: { where: { tenantId_nomeNormalizado: { tenantId: string; nomeNormalizado: string } } }) => {
        const k = where.tenantId_nomeNormalizado;
        return Promise.resolve(
          [...registros.values()].find((r) => r.tenantId === k.tenantId && r.nomeNormalizado === k.nomeNormalizado) ?? null,
        );
      }),
      updateMany: vi.fn(({ where, data }: { where: { id: string; version: number }; data: Record<string, unknown> }) => {
        const r = registros.get(where.id);
        if (!r || r.version !== where.version) return Promise.resolve({ count: 0 });
        Object.assign(r, data, { version: r.version + 1 });
        return Promise.resolve({ count: 1 });
      }),
      findUniqueOrThrow: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(registros.get(where.id))),
    },
    contaContabil: { findFirst: vi.fn(() => Promise.resolve(null)) },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const registroBase: AliquotaMock = {
  id: 'a1',
  tenantId: 't1',
  nome: 'PIS',
  nomeNormalizado: 'pis',
  aliquotaPct: new Prisma.Decimal('0.65'),
  tipoIncidencia: 'AMBOS',
  dataInicioVigencia: new Date('2024-01-01T00:00:00.000Z'),
  version: 0,
};

// Ver comentário equivalente em CadastrarAliquotaImpostoUseCase.test.ts.
function dataCalendarioUTC(offsetDias: number): Date {
  const hoje = new Date();
  const isoHoje = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  isoHoje.setUTCDate(isoHoje.getUTCDate() + offsetDias);
  return new Date(isoHoje.toISOString().slice(0, 10));
}

const inputBase = {
  tenantId: 't1',
  usuarioId: 'u1',
  aliquotaImpostoParametroId: 'a1',
  version: 0,
  nome: 'PIS',
  aliquotaPct: '1.65',
  tipoIncidencia: 'AMBOS' as const,
  dataInicioVigencia: dataCalendarioUTC(0),
};

describe('EditarAliquotaImpostoUseCase', () => {
  it('edita com sucesso e incrementa version', async () => {
    const base = criarPrismaMock([registroBase]);
    const useCase = new EditarAliquotaImpostoUseCase(base as never);

    const resultado = await useCase.execute(inputBase);

    expect(resultado.version).toBe(1);
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('rejeita conflito de concorrência quando version diverge (Optimistic Locking)', async () => {
    const base = criarPrismaMock([{ ...registroBase, version: 5 }]);
    const useCase = new EditarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(ConflitoConcorrenciaError);
  });

  it('bloqueia renomear para nome já usado por outro registro', async () => {
    const base = criarPrismaMock([
      registroBase,
      {
        id: 'a2',
        tenantId: 't1',
        nome: 'COFINS',
        nomeNormalizado: 'cofins',
        aliquotaPct: new Prisma.Decimal('3'),
        tipoIncidencia: 'AMBOS',
        dataInicioVigencia: new Date('2024-01-01T00:00:00.000Z'),
        version: 0,
      },
    ]);
    const useCase = new EditarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, nome: 'COFINS' })).rejects.toThrow(AliquotaImpostoNomeDuplicadoError);
  });

  it('[ultrareview 2026-08-11] mantém a dataInicioVigencia retroativa já salva sem lançar erro, quando ela não muda', async () => {
    const base = criarPrismaMock([registroBase]);
    const useCase = new EditarAliquotaImpostoUseCase(base as never);

    const resultado = await useCase.execute({ ...inputBase, dataInicioVigencia: registroBase.dataInicioVigencia, periodicidadeReajuste: 'ANUAL' });

    expect(resultado.version).toBe(1);
  });

  it('lança erro se o registro não existir', async () => {
    const base = criarPrismaMock([]);
    const useCase = new EditarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(AliquotaImpostoParametroNaoEncontradaError);
  });
});
