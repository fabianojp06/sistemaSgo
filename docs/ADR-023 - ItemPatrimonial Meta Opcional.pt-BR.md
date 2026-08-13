## ADR-023: ItemPatrimonial com metaId opcional e conta sem filtro de grupo

**Status**: Aceito
**Data**: 2026-08-04
**Módulo SGO**: Cadastros — Bens, Serviços e Equipamentos (US-110, UC03.34-37)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `docs/US-110 - Bens, Serviços e Equipamentos.pt-BR.md` e `CONTEXTO_SESSOES.md` — a decisão já estava implementada em produção (commit `02c676a`) antes deste arquivo existir.

### Contexto

UC03.34-37 (Minuta V5) descreve `ItemPatrimonial`, com Valor Total calculado (Qtd × Valor Unitário), Meta associada "se houver", filtro de conta por grupo "Imobilizado/Intangível" formal e exclusão condicional física/lógica.

### Decisão

1. Novo model `ItemPatrimonial` — `valorTotal` sempre calculado, nunca input direto (mesmo padrão de `Cargo.custoTotalCargo`).
2. **`metaId` opcional** (nullable), diferente da modelagem original de Viagem (ADR-022 antes da correção de 2026-08-07) — item existe tanto em `CONSOLIDADA` quanto `POR_META`; só é vinculado a uma Meta quando a Proposta for `POR_META`. Este padrão de `metaId` opcional foi depois replicado em Viagem (ADR-022, Decisão 2).
3. **Sem filtro de grupo "Imobilizado/Intangível"** — não existe tag/grupo formal em `ContaContabil` hoje. Aceita qualquer conta `isAnalitica=true`, sem filtro de grupo (achado de qualidade documental, não implementado ainda em nenhuma US).
4. **Exclusão sempre soft delete** (`ativo` boolean), não a lógica híbrida física/lógica condicional da Minuta.
5. Sem `TotalizerService`/relatórios de exportação nesta US — só o CRUD do item.
6. Sem lock pessimista.

### Consequências

- ✅ `metaId` opcional se tornou o padrão de referência do projeto, replicado em Viagem depois.
- ⚠️ Filtro de conta por grupo CAPEX/OPEX permanece como dívida documental — revisitar se uma tag de natureza for cogitada no glossário da Minuta.
- ⚠️ Exportação/relatórios (RF_PAT_REQ_007) ficam fora de escopo, revisitar junto com UC03.38.
