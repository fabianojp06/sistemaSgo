import { Prisma } from '@prisma/client';
import { calcularMesesSobreposicao } from '@/domain/shared/calcularMesesSobreposicao';

type EmpregadoParaConsolidacao = {
  periodoInicio: Date;
  periodoFim: Date | null;
  custoTotalMensal: Prisma.Decimal.Value;
};

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
    const meses = calcularMesesSobreposicao(empregado.periodoInicio, fimEmpregado, documentoInicio, documentoFim);
    if (meses === 0) continue;

    total = total.plus(new Prisma.Decimal(empregado.custoTotalMensal).times(meses));
  }

  return total;
}
