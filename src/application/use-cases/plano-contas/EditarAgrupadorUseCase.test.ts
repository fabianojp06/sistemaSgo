import { describe, expect, it, vi } from 'vitest';
import { EditarAgrupadorUseCase } from './EditarAgrupadorUseCase';
import { AgrupadorInvalidoError, AgrupadorNomeDuplicadoError } from '@/domain/plano-contas/errors';

function criarPrismaMock({
  contasAnaliticasEncontradas = 2,
  itensAtuais = ['c1', 'c2'],
  nomeAtual = 'Despesas com Passagens',
} = {}) {
  const tx = {
    contaAgrupadora: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'agrupador-1',
        nome: nomeAtual,
        itens: itensAtuais.map((contaId) => ({ agrupadoraId: 'agrupador-1', contaId })),
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    contaAgrupadoraItem: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
    },
    historicoOperacao: { create: vi.fn().mockResolvedValue({}) },
  };
  type Tx = typeof tx;

  return {
    contaContabil: { count: vi.fn().mockResolvedValue(contasAnaliticasEncontradas) },
    tx,
    $transaction: vi.fn((callback: (tx: Tx) => Promise<unknown>) => callback(tx)),
  };
}

describe('EditarAgrupadorUseCase [UC03.00 / A3]', () => {
  it('edita nome e contas, persistindo o novo estado e o log com delta [Cenário 1, RN_PLA_004]', async () => {
    const prisma = criarPrismaMock({
      itensAtuais: ['c1', 'c2'],
      nomeAtual: 'Despesas com Passagens',
      contasAnaliticasEncontradas: 3,
    });
    const useCase = new EditarAgrupadorUseCase(prisma as never);

    await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      agrupadorId: 'agrupador-1',
      nome: 'Passagens e Diárias',
      contaIds: ['c1', 'c2', 'c3'],
    });

    expect(prisma.tx.contaAgrupadora.update).toHaveBeenCalledWith({
      where: { id: 'agrupador-1' },
      data: { nome: 'Passagens e Diárias' },
    });
    expect(prisma.tx.contaAgrupadoraItem.createMany).toHaveBeenCalledWith({
      data: [{ agrupadoraId: 'agrupador-1', contaId: 'c3' }],
    });
    expect(prisma.tx.contaAgrupadoraItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tx.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'AGRUPADOR_EDITADO',
          dadosSerializados: expect.objectContaining({
            estadoAnterior: { nome: 'Despesas com Passagens', contaIds: ['c1', 'c2'] },
            estadoAtual: { nome: 'Passagens e Diárias', contaIds: ['c1', 'c2', 'c3'] },
          }),
        }),
      }),
    );
  });

  it('reconcilia por diff: remove apenas a conta excluída e adiciona apenas a nova, sem tocar nas mantidas', async () => {
    const prisma = criarPrismaMock({ itensAtuais: ['c1', 'c2', 'c3'], contasAnaliticasEncontradas: 3 });
    const useCase = new EditarAgrupadorUseCase(prisma as never);

    await useCase.execute({
      tenantId: 't1',
      usuarioId: 'u1',
      agrupadorId: 'agrupador-1',
      nome: 'Despesas com Passagens',
      contaIds: ['c1', 'c2', 'c4'],
    });

    expect(prisma.tx.contaAgrupadoraItem.deleteMany).toHaveBeenCalledWith({
      where: { agrupadoraId: 'agrupador-1', contaId: { in: ['c3'] } },
    });
    expect(prisma.tx.contaAgrupadoraItem.createMany).toHaveBeenCalledWith({
      data: [{ agrupadoraId: 'agrupador-1', contaId: 'c4' }],
    });
  });

  it('bloqueia edição que resulta em menos de 2 contas vinculadas [Cenário 2, RN_PLA_008]', async () => {
    const prisma = criarPrismaMock();
    const useCase = new EditarAgrupadorUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        agrupadorId: 'agrupador-1',
        nome: 'Despesas com Passagens',
        contaIds: ['c1'],
      }),
    ).rejects.toThrow(AgrupadorInvalidoError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bloqueia novo nome que duplica outro Agrupador existente [Cenário 3]', async () => {
    const prisma = criarPrismaMock();
    prisma.tx.contaAgrupadora.update.mockRejectedValue({ code: 'P2002' });
    const useCase = new EditarAgrupadorUseCase(prisma as never);

    await expect(
      useCase.execute({
        tenantId: 't1',
        usuarioId: 'u1',
        agrupadorId: 'agrupador-1',
        nome: 'Viagens Corporativas',
        contaIds: ['c1', 'c2'],
      }),
    ).rejects.toThrow(AgrupadorNomeDuplicadoError);
  });
});
