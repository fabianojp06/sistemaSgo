import { Prisma } from '@prisma/client';

type EmpregadoParaConsolidacao = {
  periodoInicio: Date;
  periodoFim: Date | null;
  custoTotalMensal: Prisma.Decimal.Value;
};

/** Conta meses cheios (calendário, inclusivo) entre duas datas — mínimo 1. */
function contarMesesInclusivo(inicio: Date, fim: Date): number {
  const meses = (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (fim.getUTCMonth() - inicio.getUTCMonth()) + 1;
  return Math.max(meses, 1);
}

/**
 * US-113b — valor total do período consolidado: soma, para cada Empregado do
 * escopo, custoTotalMensal × meses de sobreposição entre o período do
 * Empregado ([periodoInicio, periodoFim ?? dataFimProposta]) e o período do
 * próprio documento de consolidação ([documentoInicio, documentoFim]).
 * Empregado sem sobreposição não contribui.
 */
export function calcularValorTotalConsolidado(
  empregados: EmpregadoParaConsolidacao[],
  documentoInicio: Date,
  documentoFim: Date,
  dataFimProposta: Date,
): Prisma.Decimal {
  let total = new Prisma.Decimal(0);

  for (const empregado of empregados) {
    const fimEmpregado = empregado.periodoFim ?? dataFimProposta;
    const inicioOverlap = empregado.periodoInicio.getTime() > documentoInicio.getTime() ? empregado.periodoInicio : documentoInicio;
    const fimOverlap = fimEmpregado.getTime() < documentoFim.getTime() ? fimEmpregado : documentoFim;

    if (fimOverlap.getTime() < inicioOverlap.getTime()) continue;

    const meses = contarMesesInclusivo(inicioOverlap, fimOverlap);
    total = total.plus(new Prisma.Decimal(empregado.custoTotalMensal).times(meses));
  }

  return total;
}
