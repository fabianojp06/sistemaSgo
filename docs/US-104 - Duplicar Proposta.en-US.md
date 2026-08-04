## [US-104] — Duplicate Proposal

**Module:** Registrations — Proposals / Partnership Agreements
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As a** Budget Analyst or Financial Manager (GFIN),
**I want** to duplicate an existing Proposal (in any status), generating a new, independent Proposal with the analytical data already configured in the source,
**So that** I can reuse the budget planning of a previous project as a starting point for a new one, without manual rework of reconfiguration.

### Context and Business Rules

This US covers UC03.08 of Draft Spec V5. Unlike `CriarVersaoPropostaUseCase` (US-007) — which creates a **new version of the same Proposal**, inheriting `propostaId` — this operation creates an **entirely new and independent Proposal** (new `id`, new `codigo`), with its own Version 1, copying the analytical data from the source Proposal as a starting point.

Cloning scope in this first version: today the only real analytical data linked to a `VersaoProposta` are `ValorOrcadoConta` (US-007) and `RateioImpostoGrade` (US-101) — both linked to the **current** version of the source Proposal. This US clones these two data sets into Version 1 of the new Proposal. When the Goals, Employees/Headcount, Travel, and Assets/Services modules exist, cloning must be **extended** to include those structures — not rewritten from scratch. Not copied: audit logs from the source, nor any Amendment linked to the source (RN_DUP_003).

The source Proposal remains 100% unchanged by the duplication (RN_DUP_006) — the operation is read-only on the source. The new Proposal is always born in `RASCUNHO` status, with Version 1 (`numeroVersao=1`, `vigente=true`), **regardless of the source Proposal's status** (RN_DUP_005) — even a Proposal in `OFICIALIZADO` or `ENCERRADO` status can be duplicated, and the copy is born editable.

The Global Value of the new Proposal is never copied directly from the source's calculated value — it is always recalculated from the cloned data (RN_DUP_007), consistent with the rule that the Global Value is always derived, never a stored/copied value.

**RN_DUP_008 (extra periods)**: if, when duplicating, the user expands the validity period (End Date further out than the source's), the months/fiscal years that did not exist in the source are born with no value entered — they are not automatically filled with zero or any inherited value. This is consistent with the already-implemented model: `ValorOrcadoConta` is always one row per (version, account, fiscal year), and not having a row for a given fiscal year simply means "no value entered yet", with no need for an explicit zero record.

### Acceptance Criteria

**Scenario 1 — Successful duplication with cloned analytical data**
```gherkin
Given the source Proposal "PROP-2025-0010" has status OFICIALIZADO
And its current Version has 2 rows in ValorOrcadoConta (fiscal year 2025) and 1 row in RateioImpostoGrade
When the user triggers [Duplicate] on this Proposal, keeping the same validity dates
Then the system creates a new Proposal with an automatically generated codigo (PROP-{year}-{sequential}), name = "Copy of PROP-2025-0010" (or of the proposal's name, per the available field), status = RASCUNHO
And creates Version 1 of this new Proposal (numeroVersao=1, vigente=true, status=RASCUNHO)
And copies the 2 ValorOrcadoConta rows and the 1 RateioImpostoGrade row from the source's current version into Version 1 of the new Proposal, with the same values and fiscal years/periods
And the Global Value of the new Proposal is recalculated from the copied data — never copied directly from the source's value
And an audit log entry is recorded with tipoOperacao=PROPOSTA_DUPLICADA, containing propostaOrigemId and propostaNovaId
And the source Proposal keeps its data and status unchanged
```

**Scenario 2 — Duplication with expanded validity does not fill in new periods**
```gherkin
Given the source Proposal has validity 01/2025 to 12/2025, with ValorOrcadoConta entered for fiscal year 2025
When the user duplicates the Proposal, changing the End Date to 12/2026
Then the new Proposal is born with validity through 12/2026
And the 2025 values are copied normally
And no value is automatically entered for fiscal year 2026 — the new version simply has no ValorOrcadoConta rows for 2026 until the user configures them manually (US-007)
```

**Scenario 3 — Required name with automatic prefix**
```gherkin
Given the user is duplicating a Proposal
When the system pre-populates the Name field of the new Proposal
Then the suggested value is "Copy of {source Proposal's name}"
And the field remains editable, but cannot be saved blank
```

**Scenario 4 — Cloning failure reverts the entire operation [HARD ERROR]**
```gherkin
Given the new Proposal's data and the copy of ValorOrcadoConta/RateioImpostoGrade are being processed
When a failure occurs at any step of the transaction (e.g., failure writing the audit log)
Then the entire operation is rolled back — no partially-created new Proposal remains
And the source Proposal remains intact
And the system displays: "Transaction Error [HARD ERROR]: Duplication failed and all operations were reverted to guarantee database integrity. Please try again."
```

### Technical Impact (guidance for dev)

| Aspect             | Detail                                                  |
|---------------------|------------------------------------------------------------|
| Tables affected  | `Proposta` (INSERT), `VersaoProposta` (INSERT — Version 1 of the new Proposal), `ValorOrcadoConta` (bulk INSERT, copied from the source's current version), `RateioImpostoGrade` (bulk INSERT, same), `HistoricoOperacao` (INSERT) |
| Transaction?        | Yes — creation of the Proposal + Version 1 + bulk copy of both analytical tables + log, all in a single transaction. Full rollback on any failure |
| Requires lock?      | Not on the source (it is read-only) — same `codigo` generation-with-retry strategy already used in `CadastrarPropostaUseCase` (US-102) for the new Proposal |
| Audit         | Record in `HistoricoOperacao`: tenantId, usuarioId, propostaOrigemId, propostaNovaId, versaoOrigemId, versaoNovaId, row count copied per table |
| Business rule  | New Proposal always born RASCUNHO/Version 1, regardless of source status; Global Value never copied, always recalculated; name required with suggested prefix; no value automatically entered for periods/fiscal years that did not exist in the source |

### Dependencies

- US-102 (`CadastrarPropostaUseCase` — reuse the same `codigo` generation-with-retry strategy)
- US-007 and US-101 (provide the data to clone: `ValorOrcadoConta`, `RateioImpostoGrade`)
- When Goals/Employees/Travel/Assets exist: extend the cloning (do not replace it)

### Definition of Done

- [ ] Scenarios 1 to 4 implemented and approved in homologation
- [ ] Duplication works from a source Proposal in any status (RASCUNHO, EM_ELABORACAO, OFICIALIZADO, ENCERRADO)
- [ ] New Proposal always born RASCUNHO/Version 1, even when duplicating an Officialized source
- [ ] Global Value of the new Proposal is recalculated, never copied directly
- [ ] Failure at any step rolls back the entire transaction (test simulated failure during RateioImpostoGrade copy)
- [ ] Audit log recorded with source→destination traceability
- [ ] Operation tested with a user lacking permission (must be blocked on the backend)
