import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ListarAgrupadoresUseCase } from './ListarAgrupadoresUseCase';
import { TotalizerService, type ObtemSaldoContaAnalitica } from '@/domain/plano-contas/TotalizerService';

function criarPrismaMock(agrupadores: { id: string; nome: string; contaIds: string[] }[]) {
  return {
    contaAgrupadora: {
      findMany: async () =>
        agrupadores.map((a) => ({
          id: a.id,
          nome: a.nome,
          itens: a.contaIds.map((contaId) => ({ agrupadoraId: a.id, contaId })),
        })),
    },
  };
}

describe('ListarAgrupadoresUseCase [RF_PLA_REQ_006]', () => {
  it('calcula o total de cada agrupador de forma independente quando uma conta é compartilhada [Cenário 2, RN_PLA_011]', async () => {
    const saldosPorConta: Record<string, number> = { c1: 100, c2: 50, c3: 30 };
    const obterSaldo: ObtemSaldoContaAnalitica = async (contaId) =>
      new Prisma.Decimal(saldosPorConta[contaId] ?? 0);

    const prisma = criarPrismaMock([
      { id: 'agrupador-a', nome: 'Despesas com Passagens', contaIds: ['c1', 'c2'] },
      { id: 'agrupador-b', nome: 'Viagens Corporativas', contaIds: ['c1', 'c3'] },
    ]);

    const useCase = new ListarAgrupadoresUseCase(prisma as never, new TotalizerService(obterSaldo));

    const resultado = await useCase.execute('t1');

    const agrupadorA = resultado.find((a) => a.id === 'agrupador-a');
    const agrupadorB = resultado.find((a) => a.id === 'agrupador-b');

    expect(agrupadorA?.total.toNumber()).toBe(150);
    expect(agrupadorB?.total.toNumber()).toBe(130);
  });

  it('retorna lista vazia quando o tenant não possui agrupadores', async () => {
    const prisma = criarPrismaMock([]);
    const useCase = new ListarAgrupadoresUseCase(prisma as never);

    const resultado = await useCase.execute('t1');

    expect(resultado).toEqual([]);
  });
});
