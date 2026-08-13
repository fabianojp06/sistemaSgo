## ADR-016: Cargo vinculado 1:1 a Unidade Funcional Analítica

**Status**: Superseded por [[ADR-026]] (2026-08-06 — migrado para N:M com rateio percentual via `CargoAlocacaoPercentual`)
**Data**: 2026-08-03
**Módulo SGO**: Cadastros — Cargos e Salários (US-107)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir do registro de sessão e da memória do projeto — a decisão já estava implementada em produção antes deste arquivo existir.

### Contexto

US-107 (Cargos e Salários, UC03.19) precisava decidir como `Cargo` se relaciona com `UnidadeFuncional` (US-106, organograma de 2 níveis: Sintético→Analítico).

### Decisão

`Cargo` ganhou FK direta e obrigatória para `UnidadeFuncional` (nível Analítico apenas, RN_EST_02) — vínculo 1:1 fixo, sem tabela de junção. `salarioReal` populado via fixture determinística (`CargoRubiFixtureProvider`, hash do nome do cargo — interface pronta para troca por integração Rubi real futura).

### Consequências

- ✅ Modelagem simples, suficiente para o escopo inicial de US-107.
- ⚠️ Não suportava um Cargo ratear seu custo entre múltiplas Unidades Funcionais — limitação identificada em 2026-08-06 (RN_EST_03, "regra dos 100%") e resolvida pela [[ADR-026]], que substituiu este vínculo por `CargoAlocacaoPercentual` (N:M com soma sempre 100%).
