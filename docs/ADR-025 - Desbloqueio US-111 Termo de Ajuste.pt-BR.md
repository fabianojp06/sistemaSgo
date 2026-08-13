## ADR-025: Desbloqueio de US-111 (Termo de Ajuste) — 2 dos 3 gaps eram falsos

**Status**: Aceito
**Data**: 2026-08-04
**Módulo SGO**: Cadastros — Termo de Ajuste entre Contas Analíticas (US-111, UC03.13)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`adr025_us111_desbloqueio.md`) — a decisão já estava registrada (commit `525ae3f`) antes deste arquivo existir.

### Contexto

US-111 estava bloqueada por 3 gaps registrados numa sessão anterior: nível 7 de conta, "Termo de Parceria" como entidade própria, e ausência de perfil "Gestor Master". Ao investigar via `techlead-fsg`, ficou claro que a memória estava desatualizada em relação ao schema real, não o código.

### Decisão

1. **Nível 7 de conta**: falso gap. O gate real de "conta analítica" já é `ContaContabil.isAnalitica: Boolean`, não `nivel` (que só vai até 4) — mapeamento já aplicado em US-110/ADR-023, só não tinha sido propagado para US-111.
2. **"Termo de Parceria" como entidade**: falso gap. Já existe como `enum TipoProposta { CONTRATO, TERMO_DE_PARCERIA }`, em uso desde US-101/US-102.
3. **Perfil "Gestor Master"**: único gap genuíno. Resolvido **sem migration em `Perfil`** (já é nome livre por tenant) — nasce como linha de dado. Nova tabela `TermoAjuste` com `status: PENDENTE_APROVACAO_N1 → PENDENTE_APROVACAO_GESTOR_MASTER → HOMOLOGADO | REJEITADO`, cada transição checando `PerfilFuncionalidade` de uma `Funcionalidade` própria por etapa.

### Consequências

- ✅ US-111 sai de "Bloqueado" para "Próximo da Fila" sem nenhuma mudança de schema além da nova tabela `TermoAjuste`.
- ⚠️ Lição registrada: antes de reportar um gap como bloqueio, checar contra o schema atual, não só contra a última memória registrada — memória pode ficar desatualizada em relação ao código.
- US-111 implementada em seguida (2026-08-06, commit `d2597b0`) seguindo exatamente este desenho.
