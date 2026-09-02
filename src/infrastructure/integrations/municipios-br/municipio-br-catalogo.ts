import { MUNICIPIOS_BR_RAW } from './municipios-brasileiros-raw';
import type { MunicipioBr } from './types';

/**
 * ADR-048 / US-141 — acesso ao catálogo embutido de municípios brasileiros (IBGE).
 * Dado de referência global (sem tenantId), somente leitura, resolvido em memória —
 * nenhuma consulta ao banco. O índice é construído uma única vez (lazy).
 */

let indicePorCodigo: Map<string, MunicipioBr> | null = null;

function getIndice(): Map<string, MunicipioBr> {
  if (indicePorCodigo === null) {
    indicePorCodigo = new Map(MUNICIPIOS_BR_RAW.map((m) => [m.codigoIbge, m]));
  }
  return indicePorCodigo;
}

/**
 * Resolve um código IBGE (7 dígitos) para o município do catálogo.
 * Retorna `null` quando o código não existe no catálogo embutido.
 */
export function resolverMunicipioBr(codigoIbge: string): MunicipioBr | null {
  return getIndice().get(codigoIbge) ?? null;
}
