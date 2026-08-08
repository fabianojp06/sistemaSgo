import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ExcluirAliquotaImpostoUseCase } from './ExcluirAliquotaImpostoUseCase';
import { AliquotaImpostoParametroNaoEncontradaError, AliquotaImpostoReferenciadaError } from '@/domain/plano-contas/errors';

type RateioMock = { tenantId: string; aliquotaParametroId: string; ativo: boolean; versaoStatus: string };

function criarPrismaMock(existeAliquota: boolean, rateios: RateioMock[]) {
  const base = {
    aliquotaImpostoParametro: {
      findFirst: vi.fn(() =>
        Promise.resolve(
          existeAliquota
            ? { id: 'a1', tenantId: 't1', nome: 'ISS', ativo: true, aliquotaPct: new Prisma.Decimal('3.00'), tipoIncidencia: 'AMBOS' }
            : null,
        ),
      ),
      update: vi.fn(() => Promise.resolve({})),
    },
    rateioImpostoGrade: {
      findFirst: vi.fn(({ where }: { where: { ativo: boolean; versao: { status: { in: string[] } } } }) => {
        const encontrado = rateios.find(
          (r) => r.ativo === where.ativo && where.versao.status.in.includes(r.versaoStatus),
        );
        return Promise.resolve(encontrado ? { id: 'rat-1' } : null);
      }),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return base;
}

const inputBase = { tenantId: 't1', usuarioId: 'u1', aliquotaImpostoParametroId: 'a1' };

describe('ExcluirAliquotaImpostoUseCase', () => {
  it('inativa (soft delete) quando não há referência ativa', async () => {
    const base = criarPrismaMock(true, []);
    const useCase = new ExcluirAliquotaImpostoUseCase(base as never);

    const resultado = await useCase.execute(inputBase);

    expect(resultado.id).toBe('a1');
    expect(base.aliquotaImpostoParametro.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { ativo: false, version: { increment: 1 } },
    });
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('bloqueia exclusão com referência ativa em Proposta EM_ELABORACAO [RN_IMP_009]', async () => {
    const base = criarPrismaMock(true, [{ tenantId: 't1', aliquotaParametroId: 'a1', ativo: true, versaoStatus: 'EM_ELABORACAO' }]);
    const useCase = new ExcluirAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(AliquotaImpostoReferenciadaError);
    expect(base.aliquotaImpostoParametro.update).not.toHaveBeenCalled();
  });

  it('lança erro se a alíquota não existir', async () => {
    const base = criarPrismaMock(false, []);
    const useCase = new ExcluirAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(AliquotaImpostoParametroNaoEncontradaError);
  });
});
