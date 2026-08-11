/** US-129 — escopo do reajuste em lote: 1 conta analítica, um Agrupador (RN_PR_001,
 * replica para as contas filhas), ou global (RN_PR_005, "Categoria" vazia = todas as
 * contas analíticas já parametrizadas no tenant). */
export type EscopoReajuste = { modo: 'CONTA'; contaId: string } | { modo: 'AGRUPADOR'; agrupadorId: string } | { modo: 'GLOBAL' };
