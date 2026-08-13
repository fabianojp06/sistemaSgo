## ADR-032: Valor Realizado do Semáforo passa a refletir o total do prazo do contrato

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Semáforo Orçamentário (US-008)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-07 14:06 UTC) — a decisão já estava implementada em produção (commit `8c55809`, correção `b332ad3`) antes deste arquivo existir.

### Contexto

Usuário pediu que "Valor Realizado" comparado com o Orçado no Semáforo passasse a refletir o total do período da Proposta, não o valor mensal corrente.

### Decisão

Viagem/ItemPatrimonial/RateioImpostoGrade já são valor total (não mexer); só os componentes de Empregado (único custo mensal recorrente) passam a ser multiplicados pelos meses de sobreposição entre o período do Empregado e o período da Proposta, reaproveitando a lógica de overlap de `calcularValorTotalConsolidado.ts` (US-113b), extraída para `domain/shared/calcularMesesSobreposicao.ts`.

**Bug real encontrado ao validar com dado real:** usuário calculou manualmente o Vale Transporte esperado (R$ 15.840 para 2 estagiários × 12 meses) e o sistema mostrava R$ 17.160. Causa raiz: `contarMesesInclusivo` contava 13 meses para um contrato de exatamente 1 ano com o mesmo dia em início e fim — fórmula antiga (`ano×12 + mês + 1`) não era sensível ao dia. Corrigida para contar meses cheios por aniversário de dia, com +1 só se sobrar fração.

### Consequências

- ✅ Semáforo passa a comparar total-contra-total, coerente com o Valor Orçado (também total).
- ✅ `calcularMesesSobreposicao.ts` vira função compartilhada, reaproveitada depois por US-118 (dashboard) via `ValorRealizadoService`.
- 5 testes novos dedicados ao bug de contagem de meses.
