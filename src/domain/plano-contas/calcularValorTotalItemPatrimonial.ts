import { Prisma } from '@prisma/client';

/**
 * US-110 [ORIGEM BLINDADA] — Valor Total do Item Patrimonial = Quantidade ×
 * Valor Unitário. Sempre calculado pelo backend, nunca aceito como input direto.
 */
export function calcularValorTotalItemPatrimonial(quantidade: number, valorUnitario: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(quantidade).times(valorUnitario);
}
