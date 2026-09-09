## [US-135] — Revert Position↔Functional Unit Link from N:M (Apportionment) to 1:1

**Module:** Registrations — Functional Structure / Positions and Salaries (UC03.18/03.19, RN_CAR_02/08 of the Jun/2026 Rev.)
**Epic:** EP118/24
**Priority:** High
**Estimate:** G
**Blocker:** requires a Tech Lead ADR (`techlead-fsg`) before any code — this reverts a migration already applied in production (ADR-026, 2026-08-06) over data that potentially already exists. Mandatory Git workflow: branch + PR (migration + financial business rule), per `CLAUDE.md`.

**As a** GRH User,
**I want** every Position to be linked to exactly 1 Functional Unit (no percentage apportionment across sectors),
**So that** the Position's cost is allocated in a simple, integral way to the selected sector, per the current specification of the Jun/2026 Rev. document (RN_CAR_08).

### Context and Business Rules

**User decision (2026-08-13):** the `Tela-Cadastro-de-Cargos-Salarios-Rev-Jun2026.docx` document states "RN_CAR_02 REVOKED — Apportionment Removed... the functional link is now 1:1... Full cost to the selected sector" (RN_CAR_08). When confronted with the conflict — the actual schema already migrated to N:M with percentage apportionment via `CargoAlocacaoPercentual` (ADR-026, in production since 2026-08-06, validated with a real manual test) — the user confirmed that the intent is to **revert to 1:1**, not keep the apportionment.

This is an architecture reversal, not a new feature US — it needs the same rigor that drove the creation of the apportionment in ADR-026: understanding what happens to Positions that **already have apportionment configured across more than 1 Functional Unit** (real data possibly in production) before any migration.

**Questions the Tech Lead must answer in the reversal ADR (not to be decided in the AN/PO skill):**
1. Are there, today in production, Positions with `CargoAlocacaoPercentual` pointing to more than 1 Functional Unit? If so, what criterion picks which of the Units "survives" in the new 1:1 link (highest percentage? most recent? manual decision per Position?).
2. Does `EmpregadoHeadcount.vinculoFuncionalHerdado` (which today reflects multiple allocations, ADR-026) need a read-side adjustment when going back to 1:1?
3. Does the reversal migration follow the same 2-step pattern already used in ADR-026 (recreate a direct FK column + backfill from the highest-percentage allocation, then drop `CargoAlocacaoPercentual`)?
4. RN_EST_03 (the "100% rule"), introduced precisely to validate the apportionment, ceases to exist — confirm that no other rule in the project depends on it before removing it.

### Acceptance Criteria (subject to adjustment after the Tech Lead's ADR)

**Scenario 1 — Register a Position with a single link**
```gherkin
Given there is 1 Analytical Functional Unit in the Proposal
When the user registers a Position by selecting that Unit via Tree Selection (single, not multiple, selection)
Then the system persists the 1:1 link
And the Position's total cost is allocated in full to that Unit (RN_CAR_08)
```

**Scenario 2 — Migration of existing data with apportionment**
```gherkin
Given a Position already has CargoAlocacaoPercentual with 2 Functional Units (e.g., 60%/40%)
When the reversal migration is run
Then the system applies the criterion defined by the Tech Lead in the ADR (e.g., highest percentage) to pick the single Unit
And it records the change in a log/audit trail to allow manual review after the migration
```

**Scenario 3 — Blocked: multiple selection of Functional Unit in the UI**
```gherkin
Given the user is registering or editing a Position
When they try to select more than 1 Functional Unit in the Tree Selection
Then the system allows only a single selection (RN_CAR_08)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `Cargo` (new direct FK `unidadeFuncionalId`), `CargoAlocacaoPercentual` (removed after backfill) |
| Migration | 2 steps — create the FK + backfill from the criterion defined in the ADR, then drop `CargoAlocacaoPercentual`. **Risk of data loss if there is real apportionment in production across more than 1 Unit** — check a real `prisma.count()` before writing the migration, the same caution pattern already used in ADR-027/ADR-034. |
| Transaction? | Yes — this is a data migration, not application code |
| Requires lock? | No |
| Audit | Record in `HistoricoOperacao` or a migration log which criterion was applied to each migrated Position, for manual review |
| Business rule | RN_EST_03 (the "100% rule") removed; `CargoPanel.tsx` goes back from multiple selection with percentage to single selection |

### Dependencies

- Tech Lead's reversal ADR (`techlead-fsg`) — **mandatory before coding**, answers the 4 questions above
- Git workflow: branch + PR (migration + financial business rule), `/code-review` before merge

### Definition of Done

- [ ] Tech Lead ADR produced and approved
- [ ] Real `prisma.count()` confirming (or ruling out) the existence of multi-unit apportionment in production before writing the migration
- [ ] Reversal migration tested with real apportionment data (not just the empty scenario)
- [ ] `CargoPanel.tsx` adjusted to single selection
- [ ] `/code-review` run on the branch before merge
