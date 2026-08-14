import type { Prisma } from '@prisma/client';

/**
 * ADR-045 (US-132) — candidato retornado pela busca de Cargo no Rubi. Todos os
 * campos vêm juntos, de um único candidato escolhido pelo usuário; nunca
 * combinados de fontes diferentes.
 */
export type CandidatoCargoRubi = {
  nomeCargoMercado: string;
  tabSalCodigo: string;
  tabSalDescricao: string;
  faixaCodigo: string;
  faixaDescricao: string;
  nivelCodigo: string;
  nivelDescricao: string;
  salarioReal: Prisma.Decimal;
};

export interface CargoRubiProvider {
  /**
   * ADR-045 — busca por termo livre (nome parcial de cargo ou código externo do
   * Rubi); retorna 1 a 3 candidatos fictícios (fixture). Não persiste o termo.
   */
  buscarCargosPorTermo(termo: string): Promise<CandidatoCargoRubi[]>;
}
