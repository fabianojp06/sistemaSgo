## [US-116] — Organizational Structure Screen (Org Chart)

**Module:** Registrations — Organizational Structure (UC03.18)
**Epic:** EP118/24
**Priority:** High
**Estimate:** M
**Provenance note:** document reconstructed retroactively on 2026-08-13 — implemented on 2026-08-06 (commit `347b7ef`) as part of the "US-116/US-117 (Org Chart+Roles), ADR-028" session, but never got its own file in `docs/`. Reconstructed from `CONTEXTO_SESSOES.md` (2026-08-06 section, 14:18–21:11 UTC).

**As a** Regular User (GFIN),
**I want** a dedicated screen to create and deactivate Functional Units (org chart) within a Proposal,
**So that** the organizational structure (US-106, which had existed only as a use case since 2026-07-31) finally has a user interface.

### Context and Business Rules

US-106 (`UnidadeFuncional`, ADR-015) had existed since 2026-07-31 only as a use case + domain, with no screen — a known, documented gap (see `us106_estrutura_funcional.md`). This US closes that gap.

New route `/propostas/{id}/estrutura`, outside the catch-all of US-115's tabs (`/propostas/{id}/[[...guia]]`) — the same Proposal-scoped (not Version-scoped) lifecycle pattern already decided for Cargo/UnidadeFuncional. "Org Chart" sub-tab (`OrganogramaPanel.tsx`): creates/deactivates `UnidadeFuncional`, respecting US-106's 2 fixed levels (root Synthetic → Analytical).

**Bug found in passing, fixed:** `InativarUnidadeFuncionalUseCase.contarCargosVinculados()` always returned `0`, with a comment saying "replace once Cargo exists" — but `Cargo` had already existed since US-107, so the RN_EST_04 check (block deactivation with a linked role) never actually worked. Fixed to query `CargoAlocacaoPercentual` for real, in the same delivery.

New CONTEXTUAL `Funcionalidade` `propostas.gerenciar-estrutura` (ADR-021 — an explicit decision not to turn it into its own menu item, it lives inside the Proposal screen).

### Acceptance Criteria

**Scenario 1 — Create a Synthetic (root) Functional Unit**
```gherkin
Given the user is on the "Structure" screen of a Proposal with a Version in RASCUNHO or EM_ELABORACAO
When they create a Functional Unit of type SINTETICO_DIRETORIA
Then the unit is created as the root of the tree
And it appears in the Org Chart with no parent
```

**Scenario 2 — Create an Analytical Functional Unit linked to a Synthetic one**
```gherkin
Given a SINTETICO_GERENCIA Unit exists
When the user creates an ANALITICO_COORDENADORIA Unit linked to it
Then the unit is created with the correct parent
And it appears as a child in the Org Chart tree
```

**Scenario 3 — Block: deactivating a Unit with a linked Role**
```gherkin
Given an Analytical Functional Unit has at least 1 Role with an active CargoAlocacaoPercentual
When the user tries to deactivate that Unit
Then the system blocks it with InativacaoUnidadeFuncionalBloqueadaError
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `UnidadeFuncional` (no schema change — only UI on top of use cases already existing from US-106) |
| New components | `src/app/propostas/[id]/estrutura/page.tsx`, `OrganogramaPanel.tsx` |
| Bug fixed in passing | `InativarUnidadeFuncionalUseCase.contarCargosVinculados()` — no longer always returns 0 |
| New Functionality | `propostas.gerenciar-estrutura` (CONTEXTUAL, ADR-021) |

### Dependencies

- US-106 (Organizational Structure, backend)
- US-117 (Roles Screen, same route `/propostas/{id}/estrutura`, sibling sub-tab)

### Definition of Done

- [x] Org Chart sub-tab implemented and live
- [x] `contarCargosVinculados` bug fixed
- [x] CONTEXTUAL `Funcionalidade` seeded and applied in production
- [ ] Dedicated UI test in a real browser (indirectly validated by the 3 rounds of manual test feedback from the HR session, focused on Employees/Roles, not the Org Chart in isolation)
