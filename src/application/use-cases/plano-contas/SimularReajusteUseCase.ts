import type { PrismaClient } from '@prisma/client';
import { prepararPlanoReajuste, type PlanoReajusteLote, type PrepararPlanoReajusteInput } from './prepararPlanoReajuste';

/**
 * US-129, Cenário 9 — Simular (Preview), sem persistir. Reaproveita o mesmo motor
 * de cálculo de AplicarReajusteUseCase para que o preview mostrado ao usuário seja
 * exatamente o que seria gravado ao confirmar. [TRAVA O ERRO] nenhum log é
 * gravado em HistoricoOperacao durante a simulação — de propósito, não omissão.
 */
export class SimularReajusteUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: PrepararPlanoReajusteInput): Promise<PlanoReajusteLote> {
    return prepararPlanoReajuste(this.prisma, input);
  }
}
