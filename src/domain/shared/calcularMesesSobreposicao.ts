/**
 * Conta meses entre duas datas, sensível ao dia — não só ano/mês. Meses
 * cheios entre `inicio` e `fim` (contados por aniversário: ex. 01/09/2026 →
 * 01/09/2027 = 12 meses cheios, não 13), mais 1 mês extra se sobrar
 * qualquer fração de dia além dos meses cheios. Mínimo 1 (mesmo início e
 * fim no mesmo dia conta como 1 mês).
 *
 * Corrige o bug anterior (ano×12 + mês + 1), que superestimava em 1 mês
 * sempre que o dia de `fim` fosse >= dia de `inicio` — ex.: um contrato de
 * exatamente 1 ano (mesmo dia em início e fim) contava 13 meses, não 12.
 */
export function contarMesesInclusivo(inicio: Date, fim: Date): number {
  let meses = (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (fim.getUTCMonth() - inicio.getUTCMonth());
  if (fim.getUTCDate() < inicio.getUTCDate()) meses -= 1;

  const baseMesesCheios = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + meses, inicio.getUTCDate()));
  if (fim.getTime() > baseMesesCheios.getTime()) meses += 1;

  return Math.max(meses, 1);
}

/**
 * Meses de sobreposição entre dois intervalos de datas ([aInicio, aFim] e
 * [bInicio, bFim]), contados via contarMesesInclusivo. Retorna 0 quando os
 * intervalos não se sobrepõem (em vez do mínimo 1 de contarMesesInclusivo,
 * que assume que os dois extremos já se sobrepõem).
 */
export function calcularMesesSobreposicao(aInicio: Date, aFim: Date, bInicio: Date, bFim: Date): number {
  const inicioOverlap = aInicio.getTime() > bInicio.getTime() ? aInicio : bInicio;
  const fimOverlap = aFim.getTime() < bFim.getTime() ? aFim : bFim;

  if (fimOverlap.getTime() < inicioOverlap.getTime()) return 0;

  return contarMesesInclusivo(inicioOverlap, fimOverlap);
}
