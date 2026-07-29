import { describe, expect, it, vi } from 'vitest';
import { CriarAgrupadorUseCase } from './CriarAgrupadorUseCase';
import { AgrupadorInvalidoError, AgrupadorNomeDuplicadoError } from '@/domain/plano-contas/errors';

function criarPrismaMock({ contasAnaliticasEncontradas = 2 } = {}) {
  const tx = {
    contaAgrupadora: { create: vi.fn().mockResolvedValue({ id: 'agrupador-1' }) },
    contaAgrupadoraItem: { createMany: vi.fn().mockResolvedValue({}) },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
  };
  type Tx = typeof tx;

  return {
    contaContabil: { count: vi.fn().mockResolvedValue(contasAnaliticasEncontradas) },
    tx,
    $transaction: vi.fn((callback: (tx: Tx) => Promise<unknown>) => callback(tx)),
  };
}

describe('CriarAgrupadorUseCase [UC03.00 / A2]', () => {
  it('bloqueia nome em branco [RN_PLA_008, E3]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new CriarAgrupadorUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', nome: '   ', contaIds: ['c1', 'c2'] }),
    ).rejects.toThrow(AgrupadorInvalidoError);
  });

  it('bloqueia menos de 2 contas analíticas selecionadas [RN_PLA_008, E3]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new CriarAgrupadorUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', nome: 'Passagens', contaIds: ['c1'] }),
    ).rejects.toThrow(AgrupadorInvalidoError);
  });

  it('bloqueia quando alguma conta selecionada não é analítica', async () => {
    const prisma = criarPrismaMock({ contasAnaliticasEncontradas: 1 });
    const useCase = new CriarAgrupadorUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', nome: 'Passagens', contaIds: ['c1', 'c2'] }),
    ).rejects.toThrow(AgrupadorInvalidoError);
  });

  it('cria o agrupador, os itens e grava auditoria AGRUPADOR_CRIADO [RN_PLA_004]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new CriarAgrupadorUseCase(prisma as never);

    const resultado = await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      nome: 'Passagens aéreas',
      contaIds: ['c1', 'c2'],
    });

    expect(resultado.id).toBe('agrupador-1');
    expect(prisma.tx.contaAgrupadora.create).toHaveBeenCalledWith({ data: { tenantId: 't1', nome: 'Passagens aéreas' } });
    expect(prisma.tx.contaAgrupadoraItem.createMany).toHaveBeenCalledWith({
      data: [
        { agrupadoraId: 'agrupador-1', contaId: 'c1' },
        { agrupadoraId: 'agrupador-1', contaId: 'c2' },
      ],
    });
    expect(prisma.tx.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipoOperacao: 'AGRUPADOR_CRIADO' }) }),
    );
  });

  it('traduz violação de unique constraint em AgrupadorNomeDuplicadoError [RN_PLA_008(a), E4]', async () => {
    const prisma = criarPrismaMock();
    prisma.tx.contaAgrupadora.create.mockRejectedValue({ code: 'P2002' });
    const useCase = new CriarAgrupadorUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', nome: 'Passagens aéreas', contaIds: ['c1', 'c2'] }),
    ).rejects.toThrow(AgrupadorNomeDuplicadoError);
  });
});
