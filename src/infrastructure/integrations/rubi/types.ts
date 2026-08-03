import type { Prisma } from '@prisma/client';

export interface CargoRubiProvider {
  /** Busca o "Salário Real" soberano do ERP Rubi para um cargo, por nome de cargo de mercado. */
  buscarSalarioReal(nomeCargoMercado: string): Promise<Prisma.Decimal | null>;
}
