## [US-105] — Concurrency Control (Optimistic Locking) on Proposal Version Editing

**Module:** Registrations — Proposals / Partnership Agreements
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As a** Budget Analyst or Financial Manager (GFIN),
**I want** to be warned when I try to save a change that has already been overwritten by someone else editing the same version at the same time,
**So that** I do not silently lose my work, nor unknowingly overwrite another analyst's work.

### Context and Business Rules

This US covers the cross-cutting requirement RNF_EDV_REQ_002 of UC03.10 (Edit Proposal Version) of Draft Spec V5. Naming note: the "Business Rules" section of UC03.10, as it appears in the Draft Spec, mistakenly pasted rules `RN_VAL_001` through `RN_VAL_005` from a completely different UC (the HR/Travel entry validation workflow) — these rules are unrelated to this document and were ignored.

UC03.10 is not a new screen to build: it is the conceptual container that hosts the analytical tabs of a Proposal Version. Two of these tabs already exist and work today — "Unified Chart of Accounts" (`ValorOrcadoConta`, US-007) and "Tax Apportionment/ISS Matrix" (`RateioImpostoGrade`, US-101) — but neither implements the concurrency control that UC03.10 requires (RNF_EDV_REQ_002). Today, if two budget analysts edit the budgeted value of the same account+fiscal year (or the same tax in the same period) at the same time, the second `save` silently overwrites the first — with no conflict detection, no warning to the user, no log distinguishing "I changed a value I entered myself" from "I overwrote what someone else just entered".

The control mechanism is via an **optimistic concurrency token** based on `updatedAt`: the client reads the record (with its current `updatedAt`), and when saving, sends that value as "what I expected to find". If the record in the database already has a different `updatedAt` (meaning it was changed by another write between the read and the save), the commit is rejected with a conflict message — it is not silently applied on top.

This US also covers Exception Flow E2 of UC03.10 — a more specific variation of the immutable-version block already implemented (`VersaoOficializadaCongeladaError`, US-007/US-101): here, the user is **in the middle of an edit** when the version is officialized by someone else in parallel. The message needs to reflect that the state change happened *during* the user's edit, not merely that the version is already frozen — it is a different UX (the user did not know the version had changed status while they were typing).

### Acceptance Criteria

**Scenario 1 — Save with no conflict (token matches current state)**
```gherkin
Given user A read the budgeted value of the "Salaries" account (fiscal year 2026), obtaining updatedAt = T1
And no one else has changed that record since then
When user A saves a new value, informing updatedAtEsperado = T1
Then the system accepts the commit normally
And the record is updated with a new updatedAt (T2)
And the audit log is recorded normally
```

**Scenario 2 — Concurrency conflict detected [HARD ERROR]**
```gherkin
Given user A and user B both read the same budgeted value of the "Salaries" account (fiscal year 2026), both obtaining updatedAt = T1
When user B saves first, changing the value and updating the record to updatedAt = T2
And user A, unaware of this, tries to save their own change informing updatedAtEsperado = T1 (stale)
Then the system rejects user A's commit
And displays: "Concurrency Conflict: This record has been changed by another user since the last read. Reload the data before saving again."
And no data is overwritten — the value saved by user B remains intact
```

**Scenario 3 — Same behavior for Tax Apportionment (RateioImpostoGrade)**
```gherkin
Given two users read the same ISS apportionment for the same period, with the same initial updatedAt
When one of them saves first and the other then tries to save with the stale token
Then the system applies the same conflict rule as Scenario 2, with the same message
```

**Scenario 4 — Version became immutable during editing [HARD ERROR]**
```gherkin
Given the user is editing a budgeted value of a version in RASCUNHO or EM_ELABORACAO status
When, before the user saves, someone else officializes that same version (status changes to OFICIALIZADO)
And the user then tries to save their edit, unaware of the change
Then the system blocks the commit
And displays: "Action Denied [HARD ERROR]: This version has become immutable due to a change in its project lifecycle status. Local edits have been disabled."
And no data is changed in the database
```

### Technical Impact (guidance for dev)

| Aspect             | Detail                                                  |
|---------------------|------------------------------------------------------------|
| Tables affected  | `ValorOrcadoConta` and `RateioImpostoGrade` — no new column needed, `updatedAt` already exists on both and is already updated automatically by Prisma (`@updatedAt`) |
| Fields changed  | No new fields — the existing `updatedAt` starts being used also as a concurrency token, not just as metadata |
| Transaction?        | Yes — reading the current state + comparing `updatedAt` + conditional update, within the same transaction already used by `ConfigurarValorOrcadoContaUseCase`/`ConfigurarRateioImpostoUseCase` |
| Requires lock?      | Not a pessimistic lock — it is optimistic locking: `UPDATE ... WHERE id = ? AND updatedAt = ?`, checking the affected-row `count` (0 = conflict, someone changed it between the read and the write) |
| Audit         | No change to the log format — but a rejected conflict (Scenario 2) should not generate an audit entry, since nothing was actually changed |
| Business rule  | Commit is only accepted if the `updatedAtEsperado` informed by the client exactly matches the record's current `updatedAt` in the database at the moment of `UPDATE` |

### Dependencies

- US-007 (`ConfigurarValorOrcadoContaUseCase`) — receives the optional concurrency token parameter
- US-101 (`ConfigurarRateioImpostoUseCase`) — same
- Does not depend on any future cost module (Employees/Travel/Assets) — when those exist and have their own editing use cases, they must follow the same concurrency control pattern established here

### Definition of Done

- [ ] Scenarios 1 to 4 implemented and approved in homologation
- [ ] `ConfigurarValorOrcadoContaUseCase` and `ConfigurarRateioImpostoUseCase` accept the optional concurrency token and reject the commit on mismatch
- [ ] Conflict message displayed exactly as specified, without overwriting the value already saved by another user
- [ ] Tested with two "users" (two calls to the use case) simulating concurrent editing of the same row
- [ ] No audit entry is recorded when the commit is rejected due to conflict
