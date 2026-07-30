import { describe, expect, it, vi } from 'vitest';
import { ExcluirAgrupadorUseCase } from './ExcluirAgrupadorUseCase';
import { AgrupadorReferenciadoError } from '@/domain/plano-contas/errors';

function criarPrismaMock() {
  const tx = {
    contaAgrupadora: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'agrupador-1',
        nome: 'Passagens aéreas',
        itens: [
          { agrupadoraId: 'agrupador-1', contaId: 'c1' },
          { agrupadoraId: 'agrupador-1', contaId: 'c2' },
        ],
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
  };
  type Tx = typeof tx;

  return { tx, $transaction: vi.fn((callback: (tx: Tx) => Promise<unknown>) => callback(tx)) };
}

describe('ExcluirAgrupadorUseCase [UC03.00 / A4]', () => {
  it('bloqueia exclusão quando há referência ativa [RN_PLA_010, E5]', async () => {
    const prisma = criarPrismaMock();
    const possuiReferenciaAtiva = vi.fn().mockResolvedValue(true);
    const useCase = new ExcluirAgrupadorUseCase(prisma as never, possuiReferenciaAtiva);

    await expect(useCase.execute({ tenantId: 't1', usuarioId: 'u1', agrupadorId: 'agrupador-1' })).rejects.toThrow(
      AgrupadorReferenciadoError,
    );
    expect(prisma.tx.contaAgrupadora.delete).not.toHaveBeenCalled();
  });

  it('exclui e grava auditoria AGRUPADOR_EXCLUIDO quando não há referência ativa', async () => {
    const prisma = criarPrismaMock();
    const useCase = new ExcluirAgrupadorUseCase(prisma as never, async () => false);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', agrupadorId: 'agrupador-1' });

    expect(prisma.tx.contaAgrupadora.delete).toHaveBeenCalledWith({ where: { id: 'agrupador-1' } });
    expect(prisma.tx.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'AGRUPADOR_EXCLUIDO',
          dadosSerializados: expect.objectContaining({ contaIds: ['c1', 'c2'] }),
        }),
      }),
    );
  });
});
