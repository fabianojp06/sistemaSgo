import { Prisma } from '@prisma/client';

/**
 * Fonte do saldo de uma conta analítica. Hoje não há módulo de execução
 * orçamentária (empenho/liquidação) implementado, então o valor é sempre zero —
 * ponto de extensão para quando esse módulo existir.
 */
export type ObtemSaldoContaAnalitica = (contaId: string) => Promise<Prisma.Decimal>;

export const semSaldoDisponivel: ObtemSaldoContaAnalitica = async () => new Prisma.Decimal(0);

/**
 * RN_PLA_009 — soma via BigDecimal, sem arredondamento, sempre Read-only.
 * Usado tanto pelos Agrupadores de Contas quanto (futuramente) por relatórios
 * de execução orçamentária.
 */
export class TotalizerService {
  constructor(private readonly obterSaldo: ObtemSaldoContaAnalitica = semSaldoDisponivel) {}

  async calcularTotal(contaIds: string[]): Promise<Prisma.Decimal> {
    const saldos = await Promise.all(contaIds.map((id) => this.obterSaldo(id)));
    return saldos.reduce((acc, saldo) => acc.plus(saldo), new Prisma.Decimal(0));
  }
}
