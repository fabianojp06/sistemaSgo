## ADR-018: EmpregadoHeadcount herda Custo/Vínculo do Cargo como snapshot congelado

**Status**: Aceito
**Data**: 2026-08-03
**Módulo SGO**: Cadastros — Empregados (US-108, UC03.24-27)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`us108_empregados_refinamento.md`) — a decisão já estava implementada em produção antes deste arquivo existir.

### Contexto

REQ_EMP_004 pede que Custo Total Mensal e Vínculo Funcional do Empregado reflitam o Cargo no momento do vínculo. Era preciso decidir entre recalcular sempre ao vivo (acoplado ao Cargo atual) ou congelar no momento do cadastro.

### Decisão

`EmpregadoHeadcount` herda `custoTotalMensal`/`vinculoFuncionalHerdado` do `Cargo` como **snapshot congelado** — persistido no momento do vínculo, não recalculado automaticamente se o Cargo mudar depois. Decisão explícita para preservar imutabilidade histórica de custo, diferente de `Meta.valorGlobal` (ADR-017, sempre recalculado). Sem lock pessimista — mesma simplicidade transacional de Cargo.

Também decidido nesta ADR: soft delete (não exclusão física, apesar de UC03.27 pedir DELETE físico) — desvio consciente para manter consistência com o padrão de `ativo` já usado em Cargo/UnidadeFuncional/VersaoProposta.

### Consequências

- ✅ Custo histórico do Empregado nunca "muda sozinho" quando o Cargo é editado — auditável e previsível.
- ⚠️ Editar benefícios/salário do Cargo depois do cadastro do Empregado **não** propaga automaticamente — exigiu ação explícita de ressincronização, resolvida depois pela [[ADR-030]].
- ⚠️ `POR_META` foi bloqueado nesta US (Meta ainda não existia) — liberado depois em [[ADR-024]] (US-113).
