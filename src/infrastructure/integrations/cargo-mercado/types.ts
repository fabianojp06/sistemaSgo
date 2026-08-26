/** ADR-047 (US-139) — payload de uma linha do Catálogo de Cargo de Mercado vinda da fonte externa. */
export type CargoMercadoPayload = {
  codigoOrigem: string;
  nome: string;
};

export interface CargoMercadoProvider {
  buscarCatalogoAtivo(): Promise<CargoMercadoPayload[]>;
}
