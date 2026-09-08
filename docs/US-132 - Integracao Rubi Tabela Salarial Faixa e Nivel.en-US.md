## [US-132] — Import Position from Rubi (Name, Actual Salary, Range and Level)

**Module:** Registrations — Positions and Salaries (UC03.19, Block A/B of the Jun/2026 Rev.)
**Epic:** EP118/24
**Priority:** High
**Estimate:** M

**As a** GRH User,
**I want** to search for a Position in Rubi and import Position Name, Actual Salary, Range and Level
(code + description) all at once, with those fields becoming Read-only after import,
**So that** I can register a Position with full traceability of the salary source (RN_CAR_09/REQ_CAR_007)
without manually typing data that already exists in the ERP, and without risk of divergence between
what was typed and what is in Rubi.

### Context and Business Rules

**History:** this US had been blocked since its creation (2 architecture gaps). Both were decided by
the user on 2026-08-14:

1. **No real HTTP integration with Rubi yet.** `CargoRubiFixtureProvider` remains the data source —
   the same decision already used for the Chart of Accounts/Senior. Today it only generates
   `salarioReal` (a deterministic hash of the name typed by the user); it now also generates
   Position Name, Range and Level deterministically. The data remains simulated until a real
   integration is prioritized — that is not in scope for this US.
2. **`Cargo.codigoCargo` continues to be generated internally by SGO** (`CARGO-{year}-{seq}`), it
   does not start coming from Rubi. No change of source of truth, no risk of collision with already
   registered Positions.

**Scope change requested by the user on 2026-08-14:** the original US only covered Salary
Table/Range/Level/Actual Salary, assuming the Position Name had already been typed before
synchronization. Now the Position Name also comes from Rubi — which requires an **explicit search**
flow, because it makes no sense to use the Position Name as the search criterion for itself.

**Import search criterion (a UX decision for this US, not a new database column):** the user types a
**free-text search term** (a partial position name or a Rubi external code, e.g. "analyst" or
"AN-SIS-003") into a search field inside the "Import from Rubi" modal. The system queries the
provider (`buscarCargosPorTermo`, a new method on `CargoRubiProvider`) and returns a list of
candidates (Name, Salary Table, Range, Level, Actual Salary). The user picks one from the list and
all 4 fields are filled at once. **No new persisted field is created** for this search criterion — the
term is only a transient query parameter, never written to `Cargo`. This choice avoids inventing a
"Rubi Code" that does not exist in the current schema and that would only be used in this flow. **I'm
flagging this as a Tech Lead decision to confirm before coding** — it is a UX/API choice, not a closed
business rule, and the Tech Lead may prefer a different approach (e.g. a dropdown with a preloaded
list instead of free-text search).

The 6 Salary Table/Range/Level fields + `salarioReal` **and now also `nomeCargoMercado`** become
[SHIELDED ORIGIN] — absolute Read-only in the UI once imported, never directly editable via
`CadastrarCargoUseCase`/`EditarCargoUseCase` (RN_CAR_03). Before the 1st import, `nomeCargoMercado`
remains normally editable (a "Draft" Position, ADR-042, can be born with only a manually typed name
and be imported from Rubi later — or already be born via import).

### Acceptance Criteria

**Scenario 1 — Search for and import a Position from Rubi**
```gherkin
Given the user opens the "Import from Rubi" modal while registering or editing a Position
When they type the search term "Systems Analyst"
And the system queries the Rubi provider (fixture, deterministic) and returns candidates
Then the system displays a list with at least 1 candidate:
  | Position Name | Salary Table | Range | Level | Actual Salary |
When the user selects a candidate from the list
Then the system fills, Read-only:
  | Position Name  | "Mid-Level Systems Analyst"   |
  | Salary Table    | "01 — Administrative Table"   |
  | Range           | "A — Starting Range"          |
  | Level           | "03 — Senior Level"            |
  | Actual Salary   | R$ (deterministic value)       |
And an audit record `CARGO_IMPORTADO_RUBI` is written to HistoricoOperacao
```

**Scenario 2 — Search with no results**
```gherkin
Given the user types a search term into the "Import from Rubi" modal
When the Rubi provider returns no candidate for that term
Then the system displays "No position found in Rubi for this term."
And no Position field is changed
```

**Scenario 3 — Blocked: attempt to edit a sovereign field after import**
```gherkin
Given the Position already has Name/Salary Table/Range/Level/Actual Salary filled in via import from Rubi
When the user (or a direct request to the Server Action) tries to send a different value for any of those 5 fields
Then the system ignores the received value for those fields [SHIELDED ORIGIN]
And persists only the value from the latest Rubi import
```

**Scenario 4 — Re-importing replaces all 5 fields at once**
```gherkin
Given the Position was already imported from Rubi previously
When the user opens "Import from Rubi" again and selects a different candidate
Then the 5 fields (Name, Salary Table, Range, Level, Actual Salary) are replaced together by the new candidate — never partially
And a new `CARGO_IMPORTADO_RUBI` record is written with the previous and the new value
```

**Scenario 5 — Market Deviation Alert (REQ_CAR_005 — already covered by the existing domain)**
```gherkin
Given the Position's Actual Salary is outside the range [Market Minimum Salary, Market Maximum Salary]
When the Positions screen displays the Position
Then the system visually flags the deviation (reuse `alertaDesvioMercado`, already implemented in `src/domain/plano-contas/calcularSalarioTotalCargo.ts` since US-107)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `Cargo` — 6 new fields: `tabSalCodigo`/`tabSalDescricao`/`faixaCodigo`/`faixaDescricao`/`nivelCodigo`/`nivelDescricao` (all `VARCHAR`, nullable until the 1st import). `nomeCargoMercado` already exists, no type change — it only becomes Read-only after the 1st import. |
| Calculated fields | None new — `alertaDesvioMercado` already exists and covers REQ_CAR_005 |
| Provider | `CargoRubiFixtureProvider` gains a new method `buscarCargosPorTermo(termo: string): Promise<CandidatoCargoRubi[]>`, deterministic (hash of the term), returning 1-3 fictitious candidates with Name/Table/Range/Level/Salary. The existing `buscarSalarioReal` may be deprecated in favor of the new method, or kept for compatibility — Tech Lead's decision. |
| Migration | New, 6 nullable columns on `Cargo` — no backfill of real data possible without a real integration |
| Business rule | The 5 fields (Name, Salary Table, Range, Level, Actual Salary) are never accepted as direct input in `CadastrarCargoUseCase`/`EditarCargoUseCase` after the 1st import; search term is never persisted |
| Audit trail | New `CARGO_IMPORTADO_RUBI` event in HistoricoOperacao (previous + new value, same pattern as other Position events) |

### Dependencies

- No remaining blocking dependency — the 2 architecture gaps have been decided.
- **UX/Tech Lead decision pending before coding:** confirm the design of the search criterion
  (free-text search vs. another approach) — see section above.

### Definition of Done

- [ ] Tech Lead ADR confirming the design of the search/import flow
- [ ] Acceptance criteria 1 to 5 implemented
- [ ] Sovereign fields (Name, Salary Table, Range, Level, Actual Salary) proven Read-only after the 1st import (test attempting to send a value via Server Action)
- [ ] Search with no results handled with a clear message, without changing the Position
- [ ] Re-import tested — replaces the 5 fields together, never partially
- [ ] `CARGO_IMPORTADO_RUBI` event written to HistoricoOperacao
- [ ] Market deviation alert reused without duplicating logic

---

### Gaps — history (resolved on 2026-08-14)

1. ~~`Position Code` as SHIELDED ORIGIN from Rubi vs. generated internally by SGO~~ —
   **resolved:** continues to be generated internally by SGO, no change of source of truth.
2. ~~Real integration with Rubi does not exist yet~~ — **resolved:** keeps the extended fixture for
   now; real HTTP integration is left for when it is prioritized, not in scope for this US.
