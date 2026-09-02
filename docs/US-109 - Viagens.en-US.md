## [US-109] — Maintain Viagens (Trips)

**Module:** Registrations — Trips (UC03.29-33 of Draft Spec V5)
**Epic:** EP118/24
**Priority:** High
**Estimate:** M
**Provenance note:** document reconstructed retroactively on 2026-08-13 — this US was implemented on 2026-08-04 (commit `5ee2def`) and fixed on 2026-08-07 (commit `16a7c2b`), but never got its own file in `docs/`. Reconstructed from `prisma/schema.prisma` (`model Viagem`), the use cases, and `CONTEXTO_SESSOES.md`.

**As a** Regular User (GFIN),
**I want** to register, edit, and delete Trips linked to a Proposal (and, when the Proposal is Meta-based, to a Meta), with the Estimated Cost always calculated from 3 components,
**So that** trip costs (fare, per diem, transportation) make up the analytical account's Budgeted Value with full auditability.

### Context and Business Rules

Same account-based entry pattern already validated in US-007/US-101/US-110 (ADR-022). Each Viagem has 3 cost components, each with its own analytical account — there is no single "Viagem account":

| Component | Formula | Account |
|---|---|---|
| Fare (Passagem) | Number of People × Unit Fare Cost | `contaPassagemId` |
| Per Diem (Diária) | Number of People × Average Days × Unit Per Diem Cost | `contaDiariaId` |
| Transportation | Number of People × Unit Transportation Cost | `contaTransporteId` |

`Estimated Cost` = sum of the 3 components — **always calculated server-side** (`calcularCustoEstimadoViagem`), never accepted as direct input [SHIELDED ORIGIN]. All 3 accounts must be analytical (`isAnalitica=true`, RN_PLA_003).

**Scope correction (2026-08-07, commit `16a7c2b`):** in the first version, Viagem was exclusive to `POR_META` Proposals (Meta was always required). The user tested registering a Viagem on a `CONSOLIDADA` Proposal and got wrongly blocked — the business rule was corrected: Viagem exists in **both** categories, with `metaId` optional (required only when `Proposta.categoria=POR_META`), the same pattern as `ItemPatrimonial` (US-110/ADR-023). Confirmed 0 `Viagem` records in production at the time of the fix — safe migration, no backfill.

Deletion is always a soft delete (`ativo` boolean), with no pessimistic lock — same transactional simplicity as `Cargo`/`Meta`, no critical concurrency identified.

### Acceptance Criteria

**Scenario 1 — Register a Viagem on a CONSOLIDADA Proposal (no Meta)**
```gherkin
Given Proposal "PROP-2026-0001" has its Version in RASCUNHO or EM_ELABORACAO and category = CONSOLIDADA
And the 3 Analytical Accounts for Fare/Per Diem/Transportation exist (isAnalitica=true)
When the user registers a Viagem with:
  | Description             | Technical mission to Brasília |
  | Number of People         | 2                            |
  | Average Days             | 3                            |
  | Unit Fare Cost            | 1200.00                      |
  | Unit Per Diem Cost        | 350.00                       |
  | Unit Transportation Cost  | 150.00                       |
Then the system calculates:
  | Fare           | 2 × 1200.00 = 2400.00              |
  | Per Diem       | 2 × 3 × 350.00 = 2100.00           |
  | Transportation | 2 × 150.00 = 300.00                |
  | Estimated Cost | 2400.00 + 2100.00 + 300.00 = 4800.00 |
And persists the Viagem with metaId = null
And a `VIAGEM_CRIADA` audit record is written to HistoricoOperacao
```

**Scenario 2 — Register a Viagem on a POR_META Proposal (Meta required)**
```gherkin
Given Proposal "PROP-2026-0002" is POR_META and has no active Meta registered on the Version
When the user tries to register a Viagem
Then the system blocks the save
And displays the message "Meta not found."
```

**Scenario 3 — Estimated Cost is always calculated, never accepted as input**
```gherkin
Given the user is registering a Viagem with valid cost fields
When they try to submit a custoEstimado different from the one computed by the formula
Then the system ignores the received value for that field
And persists the server-calculated custoEstimado [SHIELDED ORIGIN]
```

**Scenario 4 — Blocked: required fields blank or non-analytical accounts**
```gherkin
Given the user is registering a Viagem with no Description, or with Number of People <= 0, or with one of the 3 accounts pointing to a Synthetic Account
When they try to save
Then the system blocks the save and displays the corresponding message (CamposObrigatoriosViagemError or ContaViagemNaoAnaliticaError)
```

**Scenario 5 — An approved Version is immutable**
```gherkin
Given the associated VersaoProposta is no longer in RASCUNHO or EM_ELABORACAO
When the user tries to register, edit, or delete a Viagem
Then the system blocks with "Maintenance Rejected: this snapshot is approved and has become permanently immutable by lifecycle rule."
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `Viagem` |
| Calculated fields | `custoEstimado` (sum of the 3 components) — never direct input |
| Transaction? | Yes — create/update + `HistoricoOperacao` in the same `$transaction` |
| Requires lock? | No — no critical concurrency identified, same pattern as Cargo/Meta |
| Audit | `HistoricoOperacao`: `VIAGEM_CRIADA`, with `viagemId`/`versaoId`/`custoEstimado` serialized |
| Business rule | `calcularComponentesCustoViagem`/`calcularCustoEstimadoViagem` (`src/domain/plano-contas/calcularCustoEstimadoViagem.ts`) are the single source of truth for the math — reused by the insights dashboard (ADR-036) |

### Dependencies

- US-007/US-101 (analytical account pattern), ADR-023 (optional `metaId` pattern)

### Definition of Done

- [x] Acceptance criteria implemented (`CadastrarViagemUseCase`, `EditarViagemUseCase`, `ExcluirViagemUseCase`)
- [x] Estimated Cost always calculated server-side, never accepted as input
- [x] Audit log written to `HistoricoOperacao`
- [x] Tested with CONSOLIDADA and POR_META Proposals (2026-08-07 scope correction)
- [x] Tested with non-analytical accounts (must block)
- [ ] UI test in a real browser (development environment has no Clerk/Supabase `.env` in this Codespace — UI validation was left to the user)
