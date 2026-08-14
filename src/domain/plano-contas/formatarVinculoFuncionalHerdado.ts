// ADR-043 — reverte ADR-026: gera o snapshot de texto herdado
// (EmpregadoHeadcount.vinculoFuncionalHerdado, ADR-018) a partir do vínculo 1:1 do Cargo
// (RN_CAR_08, custo integral ao setor). Sem rateio percentual — devolve o nome da Unidade
// Funcional diretamente. Snapshots já gravados (congelados, ADR-027/029) não são alterados
// retroativamente; só o código de novos cadastros/edições usa esta assinatura.
export function formatarVinculoFuncionalHerdado(unidadeFuncional: { nome: string }): string {
  return unidadeFuncional.nome;
}
