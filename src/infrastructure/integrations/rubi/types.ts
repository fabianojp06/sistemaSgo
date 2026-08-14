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

export type BuscarCandidatosCargoRubiInput = {
  tenantId: string;
  /** Busca exata — poucos valores discretos (F1-F7), melhor como <select>. */
  faixa?: string;
  /** Busca exata — poucos valores discretos (N1-N20), melhor como <select>. */
  nivel?: string;
  /**
   * ADR-046 — busca complementar por nome (ILIKE em cargoMercado/cargoCtcea).
   * Só retorna resultado quando esses campos estiverem preenchidos (2ª fonte,
   * fora do escopo da US-137) — não quebra enquanto null, apenas não filtra
   * nada até lá.
   */
  termo?: string;
};

export interface CargoRubiProvider {
  /**
   * ADR-046 (US-137) — substitui `buscarCargosPorTermo`: busca no catálogo
   * persistido (GradeSalarialCtcea) por Faixa/Nível (via principal) e/ou termo
   * livre (via complementar, útil só quando a 2ª fonte de nomes de cargo já
   * tiver sido carregada). Não é mais fixture-hash — consulta dado real
   * sincronizado.
   */
  buscarCandidatos(input: BuscarCandidatosCargoRubiInput): Promise<CandidatoCargoRubi[]>;
}
