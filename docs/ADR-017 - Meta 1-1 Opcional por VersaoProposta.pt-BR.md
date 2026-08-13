## ADR-017: Meta como cardinalidade 1:1 opcional por VersaoProposta (não 1:N)

**Status**: Aceito
**Data**: 2026-08-03
**Módulo SGO**: Cadastros — Metas (US-112, UC03.14-17)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`us112_metas_refinamento.md`) — a decisão já estava implementada em produção antes deste arquivo existir.

### Contexto

Modelagem inicial assumiu que uma Proposta `POR_META` teria várias Metas somadas contra um teto (RN0141/150 da Minuta), o que motivaria lock pessimista (`SELECT FOR UPDATE`) para proteger a soma contra escrita concorrente. Usuário corrigiu o entendimento: dentro de uma Proposta `POR_META` existe **exatamente 1 Meta**; em `CONSOLIDADA` não há Meta nenhuma.

### Decisão

Cardinalidade **1:1 opcional** entre `VersaoProposta` e `Meta` (`@@unique([tenantId, versaoId])`, sem campo `numero` sequencial). `Meta.valorGlobal` nunca é digitado — é sempre um espelho de leitura de `SUM(ValorOrcadoConta.valor)` da versão, recalculado a cada leitura/escrita [ORIGEM BLINDADA]. A necessidade de lock pessimista original desaparece — sem "várias Metas concorrentes estourando teto", Meta ganha a mesma simplicidade transacional de `Cargo`.

### Consequências

- ✅ Elimina a complexidade de lock pessimista e validação de soma-contra-teto, que nunca faria sentido no domínio real.
- ✅ `Meta.valorGlobal` sempre consistente com o que foi de fato orçado, sem risco de divergência manual.
- ⚠️ Se um dia o domínio real precisar de múltiplas Metas por Versão, é uma mudança de cardinalidade que exige nova ADR — não reintroduzir "várias Metas" sem essa revisão formal.
