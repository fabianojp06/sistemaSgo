const FUSO_SISTEMA = 'America/Sao_Paulo';

/**
 * Decodifica um `Date` vindo de `<input type="date">` (via `z.coerce.date()` de uma string
 * "YYYY-MM-DD") de volta para calendário puro. Esse `Date` sempre representa meia-noite UTC
 * daquele calendário — extrair os componentes UTC aqui não é "comparar em UTC", é só ler de
 * volta o calendário que já estava codificado na string original, sem envolver fuso nenhum.
 */
export function paraDataCalendario(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * "Hoje" é um conceito real, não um calendário codificado — precisa de um fuso de referência.
 * Diferente de `paraDataCalendario`, aqui NÃO dá para usar UTC: entre ~21h e 23h59 em Brasília
 * (UTC-3), o calendário UTC já virou o dia seguinte, o que foi exatamente a causa do bug (form
 * mandava "amanhã" e o backend concordava). Fuso fixo em `America/Sao_Paulo` por decisão do
 * usuário — sistema é mono-região Brasil, sem previsão de operar em outros fusos.
 */
export function hojeNoFusoDoSistema(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_SISTEMA }).format(agora);
}

export function ehDataAnteriorAHoje(data: Date, agora: Date = new Date()): boolean {
  return paraDataCalendario(data) < hojeNoFusoDoSistema(agora);
}
