## [US-129] — Simulate and Apply Batch Adjustment (Descending Cascade Effect)

**Module:** Budgetary — Assumptions / Adjustments
**Epic:** EP48/26 — Budgetary Module
**Priority:** Medium
**Estimate:** G

**As a** Budget Analyst with write permission,
**I want** to simulate the impact of an adjustment index before confirming, and then apply it in batch over an Analytical Account, Grouper, or Category,
**So that** I can adjust planned appropriations in an auditable way, with no risk of irreversibly applying a wrong value.

### Context and Business Rules

Covers the **write** slice of UC04.02 (Scenarios 8-14 of `docs/CA_UC04.02_Premissas_Reajustes_Rev00.docx`). It is a **critical financial operation** — follows the project's mandatory Transactional Protocol (validate → transaction → lock record → execute → audit in the same transaction → never `Float`). Depends on **US-128** only for the shared read of `AliquotaImpostoParametro`/`RateioImpostoGrade`; the simulation/application screen is separate from the query screen.

**User decisions (2026-08-10):**

1. **"Formula" = Tax Allocation, already existing** (same decision as US-128) — `AliquotaImpostoParametro` (index/percentage + `tipoIncidencia`) and `RateioImpostoGrade` (application by analytical account + reference period). No new schema entity for the adjustment engine itself; this US's "batch application" is, in practice, creating/updating `RateioImpostoGrade` rows in cascade from an `AliquotaImpostoParametro`.
2. **The adjustment calculation must run in ALL Proposal statuses** — this **replaces RN_PR_003** from the original document (which blocked adjustment on "Closed/Inactive/Cancelled" Proposals). Explicit user decision, documented here because it diverges from the acceptance criteria signed by Rafael Guerra/GIA (`docs/CA_UC04.02_Premissas_Reajustes_Rev00.docx`, still with "pending André/SCOR validation" status — notify the validation chain about this change before formally closing the acceptance criteria). **Scenario 8 below was rewritten to reflect this** (no longer blocks by status).
3. **Overlap with ADR-039 (OPEN) — stays as is.** User confirmed keeping the current structure of the 2 US's (US-128/129) and revisiting the relationship with ADR-039 after it is updated/answered. Not a blocker for this US's technical refinement, but the cascade engine (RN_PR_001) must be designed with the possibility of later needing to converge with the ADR-039 engine in mind — avoid coupling that would make that future unification harder.

**[ADR-040] Retroactivity flow CLOSED.** RN_PR_002 never touches historical `RateioImpostoGrade` rows (preserves the already-tested immutability invariant, RN_TAX_03/06). When confirming a retroactive adjustment: (1) future months within the new validity window follow the normal `ConfigurarRateioImpostoUseCase` flow, creating/updating `RateioImpostoGrade` period by period; (2) past months within the retroactive range **are not changed** — instead, the system creates **a single new** `RateioImpostoGrade` row in the **current month's** reference period, with `valorDeclarado` = sum of the differences (new % − previous %) × base of each affected retroactive month; (3) no new field is needed in `RateioImpostoGrade` to mark "this is an adjustment" — the delta log's JSON payload (RN_PR_004) already records which months/accounts originated the row; (4) `ValorRealizadoService` needs no change at all — the adjustment row is dated in the current month and naturally enters that month's calculation.

**[ADR-040] `aliquotaPct` precision CLOSED.** `AliquotaImpostoParametro.aliquotaPct` is widened from `Decimal(5,2)` to `Decimal(9,4)` (safe migration, no data loss — scale expansion). Side effect to handle during implementation: `AliquotaImpostoListPanel.tsx:328` currently formats with a fixed `toFixed(2)` — adjust to display up to 4 places without unnecessary trailing zeros. After the migration, validate whether any test compares `aliquotaPct` as a 2-place string literal (e.g. `ConfigurarRateioImpostoUseCase.test.ts:123`).

Applicable business rules (mapped from the acceptance criteria, with the change from item 2 above):
- **RN_PR_001** — Descending Cascade Effect: an adjustment on a Grouper/Category (`ContaAgrupadora`/`ContaAgrupadoraItem`, already existing) replicates to all child Analytical Accounts.
- **RN_PR_002** — Controlled Retroactivity: retroactive validity recalculates only "Planned/Projection"; "Realized" (`ValorRealizadoService`) never changes.
- ~~RN_PR_003~~ — **Removed by user decision**: the calculation runs in any Proposal status, with no blocking.
- **RN_PR_004** — Delta Log: `HistoricoOperacao` with a JSON payload (account IDs, original value, new value).
- **RN_PR_005** — Null Category → applies globally, labeled "All".
- **RN_PR_006** — Half-Even rounding, 2 decimal places on the resulting monetary value (`Prisma.Decimal.ROUND_HALF_EVEN`, already used in `montarCronogramaDesembolso.ts`/US-122 — reuse the pattern).
- **RNF_PR_001/002** — Transactional isolation + full rollback on batch failure — `prisma.$transaction()` with an explicit `isolationLevel`, no exceptions.
- **RNF_PR_003** — Performance: a batch of up to 2,000 accounts in ≤5s; above 2s, display a progress bar.
- **RNF_PR_004** — Index with up to 4 decimal places — resolved in ADR-040 (widening `aliquotaPct` to `Decimal(9,4)`).

### Acceptance Criteria

**Scenario 8 — Adjustment calculation runs in any Proposal status**
```gherkin
Given the user selected a Proposal in any status (DRAFT, IN_PROGRESS, OFFICIALIZED, or CLOSED)
When the user applies an adjustment to that Proposal
Then the system processes the calculation normally, with no status blocking (user decision, replaces RN_PR_003 from the original acceptance criteria)
And the delta log records the Proposal's status at the time of application, for future traceability
```

**Scenario 9 — Simulation (Preview), without persisting**
```gherkin
Given the user selected a Proposal and a reference AliquotaImpostoParametro
When the user chooses the scope (Account/Grouper/Category) and clicks [Simulate]
Then the system displays a preview of the resulting values, without writing anything to the database
And the values use Half-Even rounding, 2 decimal places (RN_PR_006)
And no log is written to HistoricoOperacao during the simulation
And the preview already reflects the cascade effect on the scope's child accounts (RN_PR_001)
```

**Scenario 10 — Confirm application with cascade effect**
```gherkin
Given the user simulated (Scenario 9) and clicks [Confirm Adjustment]
When the confirmation is processed
Then the system applies the percentage to all child Analytical Accounts of the Grouper/Category, within a single prisma.$transaction() (RN_PR_001)
And each resulting value uses Half-Even, 2 decimal places (RN_PR_006)
And the delta log is written in the same transaction to HistoricoOperacao with a JSON payload (IDs, original value, new value) (RN_PR_004)
And the grid is updated to reflect the new percentages
```

**Scenario 11 — Retroactive adjustment preserves the Realized value**
```gherkin
Given the user applies an adjustment with validity earlier than the current month
When the application is confirmed
Then the system recalculates only the "Planned/Projection" column for past months (RN_PR_002)
And no value computed by ValorRealizadoService is changed
And the delta log records the affected retroactive months
```

**Scenario 12 — Null Category applies globally**
```gherkin
Given the user keeps the "Expense Category" filter empty when applying the adjustment
When the operation is confirmed
Then the adjustment is applied across the project's entire cost base (RN_PR_005)
And the log and the generated report's header display "All" in the category field
```

**Scenario 13 — Performance in a batch of up to 2,000 accounts**
```gherkin
Given the Proposal's budgetary tree has up to 2,000 analytical accounts
When the user confirms the batch adjustment
Then processing and grid update occur within 5.0 seconds (RNF_PR_003)
And if it exceeds 2.0 seconds, a progress bar is displayed during asynchronous processing
```

**Scenario 14 — Full rollback on batch failure**
```gherkin
Given the system is processing an adjustment batch
When an error occurs midway through processing (e.g. constraint violation, timeout)
Then the entire transaction rolls back — no account is left partially updated (RNF_PR_002)
And the system displays "Error processing the adjustment. No changes were saved. Please try again."
And the modal remains open with the data preserved [LOCK THE ERROR]
And no delta log is written for the failed operation
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `AliquotaImpostoParametro` (read), `ContaContabil`/`ContaAgrupadora` (read), `RateioImpostoGrade` (write — batch creation for future reference periods; for retroactivity, only an **insert** of 1 new row in the current month, never an update of a past row), `HistoricoOperacao` (write) |
| Fields changed | New `RateioImpostoGrade` rows (`valorDeclarado`/`aliquotaAplicadaSnapshot`); no historical row is changed (ADR-040) |
| Transaction? | Yes — `prisma.$transaction()` with an explicit `isolationLevel`, the entire batch + audit log in the same transaction |
| Requires lock? | Transaction isolation (`REPEATABLE READ` or higher) is sufficient — since retroactivity never performs an `UPDATE` on an existing row (only `INSERT`), the dirty-read/race-condition risk is the same already mitigated by `RateioImpostoGrade`'s unique constraint `[tenantId, versaoId, aliquotaParametroId, competencia]`; no additional `SELECT FOR UPDATE` is needed |
| Audit trail | RN_PR_004 — new `TipoOperacao`: `REAJUSTE_APLICADO`, JSON payload with the list of affected accounts + value before/after + Proposal status at the time (Scenario 8) |
| Business rule | RN_PR_001, RN_PR_002, RN_PR_004, RN_PR_005, RN_PR_006, RNF_PR_001 to 004 (RN_PR_003 removed) |

### Dependencies

- **US-128**: shared read of `AliquotaImpostoParametro`/`RateioImpostoGrade`.
- **[ADR-040]** — single shared migration: widen `aliquotaPct` to `Decimal(9,4)` + formatting adjustment in `AliquotaImpostoListPanel.tsx:328`.
- New CONTEXTUAL `Funcionalidade` `orcamentario.premissas-reajustes.aplicar`.
- **ADR-039 (OPEN)** — does not block this US, but the cascade engine (RN_PR_001) must avoid coupling that would make it harder to converge with the ADR-039 engine once it is answered.

### Definition of Done

- [ ] Scenarios 8 to 14 implemented and tested
- [ ] Full Transactional Protocol: transaction with explicit isolation, rollback tested (Scenario 14)
- [ ] Cascade effect validated on a Grouper with multiple child accounts
- [ ] Controlled retroactivity: `ValorRealizadoService` value does not change after a retroactive adjustment (Scenario 11)
- [ ] Calculation confirmed working on a Proposal of any status (Scenario 8, no blocking)
- [ ] Half-Even rounding validated with cent edge cases
- [ ] Performance tested with a batch of up to 2,000 accounts (Scenario 13)
- [ ] Complete delta log (IDs, value before/after, Proposal status) on every confirmed application, never on simulation

**Status: ready for development** — [[adr040_premissas_reajustes_rateio_impostos]] closed the 2 pending design points (retroactivity and precision). This US's workflow, once coded: **branch + PR mandatory** (financial business rule), with `/code-review` before merge — no exception, per the risk-based hybrid Git flow already recorded for the project.
