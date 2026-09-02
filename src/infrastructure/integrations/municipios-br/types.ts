/**
 * ADR-048 / US-141 — tipos do catálogo de municípios brasileiros (IBGE).
 * Dado de referência global, embutido; ver municipios-brasileiros-raw.ts.
 */

/** Registro cru do catálogo embutido. Todos os campos são string (lat/long viram Prisma.Decimal na gravação). */
export type MunicipioBrRaw = {
  /** Código IBGE de 7 dígitos — chave canônica. */
  codigoIbge: string;
  nome: string;
  /** Sigla da UF, ex.: "SP", "DF". */
  uf: string;
  /** Latitude do centroide do município, ex.: "-23.5505". */
  latitude: string;
  /** Longitude do centroide do município, ex.: "-46.6333". */
  longitude: string;
};

/** Município resolvido do catálogo (mesma forma do registro cru). */
export type MunicipioBr = MunicipioBrRaw;
