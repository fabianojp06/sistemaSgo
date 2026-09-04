// Estrutura mensal — ainda usada pelo Relatório oficial de Cronograma de
// Desembolso (US-138, tela /orcamentario/cronograma-desembolso-relatorio).
export type LinhaCronogramaSerializada = {
  mes: number;
  competencia: string; // ISO date, primeiro dia do mês
  desembolsoMensal: string;
  desembolsoAcumulado: string;
  percentualFinanceiroAcumulado: string;
  valorRepassado12Meses: string | null;
};

// US-142 / ADR-049 — Cronograma de Desembolso por parcelas (layout ANEXO 9).
// Estrutura serializada (Decimais -> string) que atravessa a fronteira
// Server Component -> Client Component.

export type SubLinhaParcelaSerializada = {
  rotulo: string;
  valor: string;
};

export type ParcelaCronogramaSerializada = {
  numero: number;
  data: string; // ISO date, primeiro dia do mês (UTC)
  descricao: string;
  desembolso: string;
  desembolsoAcumulado: string;
  percentualFinanceiroAcumulado: string;
  subLinhas: SubLinhaParcelaSerializada[];
};

export type SubtotalAnualSerializado = {
  ano: number;
  totalDoAno: string;
  desembolsoAcumulado: string;
  percentualFinanceiroAcumulado: string;
  valorAcumuladoPorAnoDoTP: string;
};

export type CronogramaParceladoSerializado = {
  parcelas: ParcelaCronogramaSerializada[];
  subtotaisAnuais: SubtotalAnualSerializado[];
  totalGeral: string;
  valorGlobal: string;
};
