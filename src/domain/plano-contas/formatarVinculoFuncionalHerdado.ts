// ADR-026 — gera o snapshot de texto herdado (EmpregadoHeadcount.vinculoFuncionalHerdado,
// ADR-018) a partir do rateio percentual do Cargo. Uma única alocação não leva prefixo de
// %, para não poluir o caso comum; múltiplas alocações são ordenadas por percentual
// decrescente.
export function formatarVinculoFuncionalHerdado(
  alocacoes: { percentual: { toString(): string } | number; unidadeFuncional: { nome: string } }[],
): string {
  if (alocacoes.length === 1) {
    return alocacoes[0].unidadeFuncional.nome;
  }
  return [...alocacoes]
    .sort((a, b) => Number(b.percentual) - Number(a.percentual))
    .map((a) => `${Number(a.percentual)}% ${a.unidadeFuncional.nome}`)
    .join(' / ');
}
