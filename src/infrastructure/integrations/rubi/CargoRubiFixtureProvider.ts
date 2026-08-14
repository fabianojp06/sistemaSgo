import { Prisma } from '@prisma/client';
import type { CandidatoCargoRubi, CargoRubiProvider } from './types';

/**
 * ADR-045 (US-132) — mesma decisão já tomada para o Plano de Contas/Senior e para
 * o antigo "Salário Real" (US-107): não há integração HTTP real com o ERP Rubi
 * ainda, então a busca de Cargo é simulada por um provider fictício com a mesma
 * interface que a integração real assumirá depois (CargoRubiProvider) — trocar a
 * implementação não deve exigir mudança no use case.
 *
 * `buscarCargosPorTermo` é determinístico (hash simples do termo digitado) para
 * que o mesmo termo sempre produza os mesmos candidatos em teste e em ambiente
 * de demonstração, sem persistir estado externo. Gera de 1 a 3 candidatos.
 */
export class CargoRubiFixtureProvider implements CargoRubiProvider {
  async buscarCargosPorTermo(termo: string): Promise<CandidatoCargoRubi[]> {
    const termoNormalizado = termo.trim();
    if (termoNormalizado.length === 0) return [];

    const hashBase = hashDeterministico(termoNormalizado);
    const quantidade = 1 + (hashBase % 3); // 1 a 3 candidatos

    return Array.from({ length: quantidade }, (_, indice) => gerarCandidato(termoNormalizado, indice));
  }
}

const SENIORIDADES = ['Júnior', 'Pleno', 'Sênior', 'Especialista'];
const TABELAS = [
  { codigo: '01', descricao: '01 — Tabela Administrativa' },
  { codigo: '02', descricao: '02 — Tabela Técnica' },
  { codigo: '03', descricao: '03 — Tabela Operacional' },
];
const FAIXAS = [
  { codigo: 'A', descricao: 'A — Faixa Inicial' },
  { codigo: 'B', descricao: 'B — Faixa Intermediária' },
  { codigo: 'C', descricao: 'C — Faixa Avançada' },
];
const NIVEIS = [
  { codigo: '01', descricao: '01 — Nível Júnior' },
  { codigo: '02', descricao: '02 — Nível Pleno' },
  { codigo: '03', descricao: '03 — Nível Sênior' },
];

function gerarCandidato(termo: string, indice: number): CandidatoCargoRubi {
  const hash = hashDeterministico(`${termo}#${indice}`);

  const base = 3000;
  const variacao = 9000;
  const salario = base + (hash % variacao);

  const nomeBase = termo
    .trim()
    .split(/\s+/)
    .map((palavra) => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
    .join(' ');

  return {
    nomeCargoMercado: `${nomeBase} ${SENIORIDADES[hash % SENIORIDADES.length]}`,
    tabSalCodigo: TABELAS[hash % TABELAS.length].codigo,
    tabSalDescricao: TABELAS[hash % TABELAS.length].descricao,
    faixaCodigo: FAIXAS[(hash >> 2) % FAIXAS.length].codigo,
    faixaDescricao: FAIXAS[(hash >> 2) % FAIXAS.length].descricao,
    nivelCodigo: NIVEIS[(hash >> 4) % NIVEIS.length].codigo,
    nivelDescricao: NIVEIS[(hash >> 4) % NIVEIS.length].descricao,
    salarioReal: new Prisma.Decimal(salario.toFixed(2)),
  };
}

function hashDeterministico(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
}
