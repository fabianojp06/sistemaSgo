import { describe, expect, it, vi } from 'vitest';
import { AtribuirNaturezaContaUseCase } from './AtribuirNaturezaContaUseCase';
import { ContaNaoAnaliticaError, NaturezaHierarquiaInvalidaError } from '@/domain/plano-contas/errors';

type ContaMock = {
  id: string;
  tenantId: string;
  codigoErp: string;
  nomeConta: string;
  idPai: string | null;
  isAnalitica: boolean;
  natureza: 'OPEX' | 'CAPEX' | null;
};

function criarPrismaMock(contas: ContaMock[]) {
  const porId = new Map(contas.map((c) => [c.id, c]));

  return {
    contaContabil: {
      findFirstOrThrow: vi.fn(({ where }: { where: { id: string; tenantId: string } }) => {
        const conta = porId.get(where.id);
        if (!conta || conta.tenantId !== where.tenantId) throw new Error('not found');
        return Promise.resolve(conta);
      }),
      findMany: vi.fn(() => Promise.resolve(contas.map((c) => ({ id: c.id, idPai: c.idPai, natureza: c.natureza })))),
      update: vi.fn(({ where, data }: { where: { id: string }; data: { natureza: string | null } }) =>
        Promise.resolve({ ...porId.get(where.id), natureza: data.natureza }),
      ),
    },
    historicoOperacao: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const analitica: ContaMock = {
  id: 'c1',
  tenantId: 't1',
  codigoErp: '1.9.11.001',
  nomeConta: 'Salários',
  idPai: 'sintetica',
  isAnalitica: true,
  natureza: null,
};

const sintetica: ContaMock = {
  id: 'sintetica',
  tenantId: 't1',
  codigoErp: '1.9.11',
  nomeConta: 'Despesas de Pessoal',
  idPai: null,
  isAnalitica: false,
  natureza: null,
};

describe('AtribuirNaturezaContaUseCase [US-003]', () => {
  it('atribui OPEX a conta analítica sem tag prévia e grava auditoria [Cenário 1]', async () => {
    const prisma = criarPrismaMock([analitica, sintetica]);
    const useCase = new AtribuirNaturezaContaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', natureza: 'OPEX' });

    expect(prisma.contaContabil.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { natureza: 'OPEX' } });
    expect(prisma.historicoOperacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipoOperacao: 'NATUREZA_ALTERADA',
          dadosSerializados: expect.objectContaining({ naturezaAnterior: null, naturezaNova: 'OPEX' }),
        }),
      }),
    );
  });

  it('bloqueia OPEX em conta filha de ancestral CAPEX [Cenário 2]', async () => {
    const prisma = criarPrismaMock([analitica, { ...sintetica, natureza: 'CAPEX' }]);
    const useCase = new AtribuirNaturezaContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', natureza: 'OPEX' }),
    ).rejects.toThrow(NaturezaHierarquiaInvalidaError);
    expect(prisma.contaContabil.update).not.toHaveBeenCalled();
  });

  it('bloqueia CAPEX em conta filha de ancestral OPEX (regra simétrica) [RN_PLA_005]', async () => {
    const prisma = criarPrismaMock([analitica, { ...sintetica, natureza: 'OPEX' }]);
    const useCase = new AtribuirNaturezaContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', natureza: 'CAPEX' }),
    ).rejects.toThrow(NaturezaHierarquiaInvalidaError);
  });

  it('remove a tag de natureza (null) sem validar hierarquia [Cenário 3]', async () => {
    const prisma = criarPrismaMock([{ ...analitica, natureza: 'OPEX' }, { ...sintetica, natureza: 'CAPEX' }]);
    const useCase = new AtribuirNaturezaContaUseCase(prisma as never);

    await useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'c1', natureza: null });

    expect(prisma.contaContabil.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { natureza: null } });
    expect(prisma.contaContabil.findMany).not.toHaveBeenCalled();
  });

  it('bloqueia atribuição de natureza a conta sintética [Cenário 4]', async () => {
    const prisma = criarPrismaMock([analitica, sintetica]);
    const useCase = new AtribuirNaturezaContaUseCase(prisma as never);

    await expect(
      useCase.execute({ tenantId: 't1', usuarioId: 'u1', contaId: 'sintetica', natureza: 'OPEX' }),
    ).rejects.toThrow(ContaNaoAnaliticaError);
    expect(prisma.contaContabil.update).not.toHaveBeenCalled();
  });
});
