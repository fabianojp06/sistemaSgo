export type LinhaCronogramaSerializada = {
  mes: number;
  competencia: string; // ISO date, primeiro dia do mês
  desembolsoMensal: string;
  desembolsoAcumulado: string;
  percentualFinanceiroAcumulado: string;
  valorRepassado12Meses: string | null;
};
