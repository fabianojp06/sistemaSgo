import { Prisma } from '@prisma/client';
import type { CargoRubiProvider } from './types';

/**
 * US-107 — mesma decisão já tomada para o Plano de Contas/Senior: não há
 * integração HTTP real com o ERP Rubi ainda, então o "Salário Real" soberano
 * é simulado por um provider fictício com a mesma interface que a integração
 * real assumirá depois (CargoRubiProvider) — trocar a implementação não deve
 * exigir mudança no use case [ADR-016].
 *
 * O valor é determinístico (hash simples do nome do cargo) para que os
 * mesmos dados de entrada sempre produzam o mesmo "Salário Real" em teste e
 * em ambiente de demonstração, sem persistir estado externo.
 */
export class CargoRubiFixtureProvider implements CargoRubiProvider {
  async buscarSalarioReal(nomeCargoMercado: string): Promise<Prisma.Decimal | null> {
    const base = 3000;
    const variacao = 9000;
    const hash = hashDeterministico(nomeCargoMercado);
    const valor = base + (hash % variacao);
    return new Prisma.Decimal(valor.toFixed(2));
  }
}

function hashDeterministico(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
}
