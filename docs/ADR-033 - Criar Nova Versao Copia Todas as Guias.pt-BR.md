## ADR-033: CriarVersaoPropostaUseCase estendido para copiar todas as guias analíticas

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Propostas, Criar Nova Versão (US-119)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-07 16:51 UTC) — a decisão já estava implementada em produção (commit `babd7bb`) antes deste arquivo existir.

### Contexto

Tela `/propostas` só tinha "Excluir Versão", faltava "Criar Nova Versão" + histórico de versões antigas. Achado antes de decidir: já existia `CriarVersaoPropostaUseCase.ts` (nascido em US-007, cenário 4), wireado no `container.ts` mas nunca exposto em `actions.ts`/UI, e só copiava `ValorOrcadoConta`.

### Decisão

Estender o use case existente (não recriar do zero) para copiar também `RateioImpostoGrade`, `Meta`, `Viagem`, `ItemPatrimonial`, `TermoAjuste`, tudo na mesma `$transaction`. Duas regras de negócio explícitas:
- `Meta.valorGlobal` **nunca** é copiado literal — é recalculado como `SUM` dos `ValorOrcadoConta` recém-copiados (mesmo espelho da ADR-017).
- `TermoAjuste` só copia se `status=HOMOLOGADO` — pendente de aprovação fica só na versão antiga (aprovação não "herda" para uma versão que não existia quando foi solicitada).

Reaproveitada a tela `/propostas` com painel expansível ("Histórico de Versões"), em vez de rota nova (`/propostas/[id]/versoes`) — não há caso de uso de deep-link para versão isolada.

### Consequências

- ✅ Uma única fonte de verdade para "duplicação de conteúdo entre versões", coerente com `Meta.valorGlobal` sempre recalculado (ADR-017).
- ⚠️ Escopo não implementado (declarado, não esquecido): modo leitura (`readOnly`) nos componentes de detalhe ao abrir uma versão antiga a partir do histórico — o painel lista/mostra metadados, mas não abre drill-down em modo consulta.
