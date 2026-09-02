// @ts-check
/**
 * Gera src/infrastructure/integrations/municipios-br/municipios-brasileiros-raw.ts
 * a partir dos CSVs de https://github.com/kelvins/municipios-brasileiros (licença MIT).
 *
 * ADR-048 / US-141 — catálogo estático embutido, sem sync, sem job. Rodar de novo
 * (com um commit-fonte mais recente) só quando o IBGE criar/renomear município —
 * evento raro (moratória constitucional de criação desde 2013).
 *
 * Uso:
 *   node scripts/gerar-municipios-br-raw.mjs <caminho-do-clone-de-municipios-brasileiros>
 *
 * O <caminho-do-clone> deve conter csv/municipios.csv e csv/estados.csv.
 * O commit-fonte usado deve ser registrado no cabeçalho do .ts gerado (COMMIT_FONTE abaixo).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT_FONTE = '503e2f70bbf1b4b7ec0b1f68b09086ccc38fe861'; // kelvins/municipios-brasileiros @ 2025-12-10
const REPO_FONTE = 'https://github.com/kelvins/municipios-brasileiros';

const cloneDir = process.argv[2];
if (!cloneDir) {
  console.error('Uso: node scripts/gerar-municipios-br-raw.mjs <caminho-do-clone>');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const raizProjeto = join(__dirname, '..');
const destino = join(
  raizProjeto,
  'src',
  'infrastructure',
  'integrations',
  'municipios-br',
  'municipios-brasileiros-raw.ts',
);

/** @param {string} caminho @returns {string[][]} */
function lerCsv(caminho) {
  const texto = readFileSync(caminho, { encoding: 'utf8' }).replace(/^﻿/, '');
  return texto
    .split(/\r?\n/)
    .filter((linha) => linha.trim().length > 0)
    .map((linha) => linha.split(','));
}

// estados.csv: codigo_uf,uf,nome,latitude,longitude,regiao
const estadosLinhas = lerCsv(join(cloneDir, 'csv', 'estados.csv')).slice(1);
/** @type {Map<string, string>} */
const ufPorCodigo = new Map();
for (const [codigoUf, sigla] of estadosLinhas) {
  ufPorCodigo.set(codigoUf.trim(), sigla.trim());
}

// municipios.csv: codigo_ibge,nome,latitude,longitude,capital,codigo_uf,siafi_id,ddd,fuso_horario
const municipiosLinhas = lerCsv(join(cloneDir, 'csv', 'municipios.csv')).slice(1);

/** @type {{ codigoIbge: string; nome: string; uf: string; latitude: string; longitude: string }[]} */
const registros = municipiosLinhas.map((campos) => {
  const [codigoIbge, nome, latitude, longitude, , codigoUf] = campos.map((c) => c.trim());
  const uf = ufPorCodigo.get(codigoUf);
  if (!uf) {
    throw new Error(`UF não resolvida para o município ${codigoIbge} (${nome}), codigo_uf=${codigoUf}`);
  }
  if (!/^\d{7}$/.test(codigoIbge)) {
    throw new Error(`Código IBGE inesperado: "${codigoIbge}" (${nome})`);
  }
  return { codigoIbge, nome, uf, latitude, longitude };
});

const colador = new Intl.Collator('pt-BR', { sensitivity: 'base' });
registros.sort((a, b) => colador.compare(a.nome, b.nome) || a.uf.localeCompare(b.uf));

/** Aspas simples com escape de apóstrofo — casa com o prettier do projeto (singleQuote: true). */
const aspas = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const linhas = registros
  .map(
    (r) =>
      `  { codigoIbge: '${r.codigoIbge}', nome: ${aspas(r.nome)}, uf: '${r.uf}', latitude: '${r.latitude}', longitude: '${r.longitude}' },`,
  )
  .join('\n');

const conteudo = `import type { MunicipioBrRaw } from './types';

/**
 * Catálogo de municípios brasileiros — dado de referência GLOBAL (sem tenantId),
 * somente leitura, embutido no código (nunca fs.readFileSync em runtime — ENOENT
 * em serverless/Vercel). ADR-048 / US-141.
 *
 * Fonte: ${REPO_FONTE}
 * Licença: MIT (ver ./LICENSE)
 * Commit-fonte: ${COMMIT_FONTE}
 * Total: ${registros.length} municípios. Ordenados por nome (pt-BR).
 *
 * ARQUIVO GERADO por scripts/gerar-municipios-br-raw.mjs — não editar à mão.
 */
export const MUNICIPIOS_BR_RAW: MunicipioBrRaw[] = [
${linhas}
];
`;

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, conteudo, { encoding: 'utf8' });
console.log(`OK — ${registros.length} municípios escritos em ${destino}`);
