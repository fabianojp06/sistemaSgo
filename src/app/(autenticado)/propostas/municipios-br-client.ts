'use client';

import type { MunicipioBrRaw } from '@/infrastructure/integrations/municipios-br/types';

/**
 * US-141 / ADR-048 — carregamento client-side do catálogo de municípios (IBGE).
 * O módulo raw (~200 KB) entra por `import()` dinâmico, fora do bundle crítico, e
 * fica em cache de módulo para não ser reprocessado a cada montagem de formulário.
 */

export type MunicipioOpcao = MunicipioBrRaw & { rotulo: string };

let cache: MunicipioOpcao[] | null = null;
let carregando: Promise<MunicipioOpcao[]> | null = null;

const DIACRITICOS = /[\u0300-\u036f]/g;

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().trim();
}

export async function carregarMunicipiosBr(): Promise<MunicipioOpcao[]> {
  if (cache) return cache;
  if (!carregando) {
    carregando = import('@/infrastructure/integrations/municipios-br/municipios-brasileiros-raw').then((mod) => {
      cache = mod.MUNICIPIOS_BR_RAW.map((m) => ({ ...m, rotulo: `${m.nome} — ${m.uf}` }));
      return cache;
    });
  }
  return carregando;
}

/** Filtro por nome, acento- e caixa-insensível. Retorna no máximo `limite` resultados. */
export function filtrarMunicipios(catalogo: MunicipioOpcao[], termo: string, limite = 20): MunicipioOpcao[] {
  const alvo = normalizar(termo);
  if (alvo.length < 2) return [];
  const resultado: MunicipioOpcao[] = [];
  for (const municipio of catalogo) {
    if (normalizar(municipio.nome).includes(alvo)) {
      resultado.push(municipio);
      if (resultado.length >= limite) break;
    }
  }
  return resultado;
}
