## [US-103] — Delete Proposal Version

**Module:** Registrations — Proposals / Partnership Agreements
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** S

**As a** Budget Analyst or Financial Manager (GFIN),
**I want** to (logically) delete a Proposal Version that is still in Draft or In Progress status,
**So that** I can remove a version created by mistake or abandoned, without losing the auditable history and without risk of deleting data already linked to real entries.

### Context and Business Rules

This US covers UC03.07 of Draft Spec V5. Naming note: the UC title in the Draft Spec says "Delete Proposal", but the entire body of the text (preconditions, flows, rules RN_EXC_001-004) deals with deleting a **Version/snapshot**, not the Proposal as a whole entity — the same title-vs-body inconsistency already observed in other documents of this epic. This US follows the body of the text: the deletion target is always a `VersaoProposta`, never the `Proposta` (which does not have, and does not need to have, its own deletion mechanism — it naturally stops appearing in listings once all its versions are inactive, but that is a screen-level behavior, out of scope for this US).

Deletion is always logical (`ativa = false` on `VersaoProposta`, already modeled since ADR-012) — never a physical `DELETE`. It is only allowed for versions in `RASCUNHO` or `EM_ELABORACAO` status. A version can never be the only active version of a Proposal — that would leave the Proposal with no current version, violating the invariant established since US-102 (every Proposal is born with at least one version and must keep at least one active).

Scope of "active operational links" in this first version: today the only real analytical data linked to a `VersaoProposta` are `ValorOrcadoConta` (US-007) and `RateioImpostoGrade` (US-101). The blocking check (RN_EXC_002) verifies the existence of records in these two tables for the target version. When the Goals, Employees/Headcount, Travel, and Assets/Services modules are implemented, this same check must be **extended** to include those tables — not rewritten from scratch.

### Acceptance Criteria

**Scenario 1 — Successful deletion of a version with no links**
```gherkin
Given Proposal "PROP-2026-0001" has two active versions: Version 1 (RASCUNHO) and Version 2 (RASCUNHO, current)
And Version 1 has no records in either ValorOrcadoConta or RateioImpostoGrade
When the user requests deletion of Version 1
Then the system sets VersaoProposta.ativa = false for Version 1
And an audit log entry is recorded in HistoricoOperacao with the full payload of the removed version
And Version 1 no longer appears in active listings, but remains in the database for history/audit purposes
```

**Scenario 2 — Blocked by active operational links [HARD ERROR]**
```gherkin
Given Version 1 of a Proposal has at least one record in ValorOrcadoConta or RateioImpostoGrade
When the user attempts to delete Version 1
Then the system blocks the deletion
And displays: "Deletion Rejected [HARD ERROR]: Operation blocked. The proposal version has active operational records or analytical calculation memories linked to it."
And no data is changed in the database
```

**Scenario 3 — Blocked by lifecycle status [HARD ERROR]**
```gherkin
Given the target version has status OFICIALIZADO or ENCERRADO
When the user attempts to delete it
Then the system blocks the operation
And displays: "Action Denied [HARD ERROR]: The project's current lifecycle status does not allow deletion. Official or closed documents are strictly immutable."
```

**Scenario 4 — Blocked for being the only active version [HARD ERROR]**
```gherkin
Given the Proposal has only one active version (Version 1, RASCUNHO)
When the user attempts to delete this single version
Then the system blocks the operation
And displays: "Deletion Rejected [HARD ERROR]: It is not possible to delete the only existing version of this Proposal."
And no data is changed in the database
```

### Technical Impact (guidance for dev)

| Aspect             | Detail                                                  |
|---------------------|------------------------------------------------------------|
| Tables affected  | `VersaoProposta` (UPDATE — `ativa = false`), read from `ValorOrcadoConta` and `RateioImpostoGrade` (link check), `HistoricoOperacao` (INSERT) |
| Transaction?        | Yes — link check + soft delete + audit log in a single transaction |
| Requires lock?      | No additional lock is needed — it is a read-then-write operation on a record where, if already inactive or officialized, the status condition itself already prevents problematic concurrent double execution |
| Audit         | Record in `HistoricoOperacao`: tenantId, usuarioId, versaoId, propostaId, full payload of the version at the moment of deletion |
| Business rule  | Only allows deletion in RASCUNHO/EM_ELABORACAO status; blocks if there are linked `ValorOrcadoConta` or `RateioImpostoGrade` records; blocks if it is the Proposal's only active version |

### Dependencies

- ADR-012 (`VersaoProposta.ativa` already modeled)
- US-007 and US-101 (provide the link tables to check: `ValorOrcadoConta`, `RateioImpostoGrade`)
- When Goals/Employees/Travel/Assets exist: extend the link check (do not replace it)

### Definition of Done

- [ ] Scenarios 1 to 4 implemented and approved in homologation
- [ ] No physical `DELETE` on `VersaoProposta` — always `ativa = false`
- [ ] Blocking tested with linked `ValorOrcadoConta` and with linked `RateioImpostoGrade`, separately
- [ ] Blocking tested with the version being the Proposal's only active version
- [ ] Audit log recorded with the full payload of the removed version
- [ ] Operation tested with a user lacking permission (must be blocked on the backend)
