## ADR-024: EmpregadoHeadcount.metaId + novo model QtdeEmpregado

**Status**: Aceito
**Data**: 2026-08-04
**Módulo SGO**: Cadastros — Qtde. Empregado (US-113)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-04 10:25) — a decisão já estava implementada em produção (commit `3beb9fc`) antes deste arquivo existir.

### Contexto

Ao refinar US-113, achado estrutural: `EmpregadoHeadcount` só tinha `propostaId`, sem `metaId` — gap herdado de US-108/ADR-018, que bloqueava totalmente `Empregado` para Proposta `POR_META`. Usuário decidiu corrigir o gap em vez de simplificar a US, e liberar `Empregado` para `POR_META` na mesma rodada, para não deixar `metaId` como coluna morta.

### Decisão

1. `EmpregadoHeadcount.metaId` adicionado (sem backfill — confirmado 0 registros em produção antes de migrar).
2. Novo model `QtdeEmpregado` — snapshot de headcount por período e documento de respaldo; quantitativos sempre calculados por `COUNT`, nunca input direto [ORIGEM BLINDADA].
3. `CadastrarEmpregadoUseCase`, antes bloqueando totalmente Proposta `POR_META`, liberado.

### Consequências

- ✅ `Empregado` deixou de ser exclusivo de `CONSOLIDADA`, alinhado com o padrão já usado em Viagem/ItemPatrimonial.
- ✅ Migration segura (0 registros pré-existentes).
- Evoluiu depois em US-113b (2026-08-06, `calcularValorTotalConsolidado.ts` — overlap de período) e na correção de fuso/número de documento automático da mesma sessão. Ver [[US-117]].
