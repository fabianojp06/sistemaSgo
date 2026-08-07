/** Conta meses cheios (calendário, inclusivo) entre duas datas — mínimo 1. */
export function contarMesesInclusivo(inicio: Date, fim: Date): number {
  const meses = (fim.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (fim.getUTCMonth() - inicio.getUTCMonth()) + 1;
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
