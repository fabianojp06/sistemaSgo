## [US-102] — Register Proposal

**Module:** Registrations — Proposals / Partnership Agreements
**Epic:** EP118/24
**Priority:** High
**Estimate:** M

**As a** Budget Analyst or Financial Manager (GFIN),
**I want to** register a new Proposal (Contract or Partnership Agreement), entering the cover data (Type, Name/Purpose, Term, Category),
**So that** I can start the budget planning of a project, with the guarantee that the Global Value is never manually entered — always calculated from later analytical entries.

### Context and Business Rules

This US covers UC03.05 (Register Proposal) of the V5 Specification Draft. It is the entry point of the entire budget module tree: Goals, Chart of Accounts, Employees, Travel and Apportionment/Tax (US-101, already implemented) only exist linked to a Proposal and its Version.

When saving the cover, the system creates **two things in the same transaction**: the `Proposta` record and its first `VersaoProposta` (numeroVersao=1, status=RASCUNHO, vigente=true) — no Proposal can exist without at least one Version, and no Version is born "orphaned" without a corresponding Proposal (RN_PROP_002). This follows the same pattern already used by `CriarVersaoPropostaUseCase` (US-007) for subsequent versions — the difference here is that there is no source version to copy values from: Version 1 is born empty.

The Global Value field is never a user input — it is always a calculated value (RN_PROP_001, [SHIELDED ORIGIN]), implicitly set to zero on creation because no cost entry is yet linked to this Proposal.

Naming note: the status enum used is the `StatusProposta` already implemented in the schema (RASCUNHO | EM_ELABORACAO | OFICIALIZADO | ENCERRADO — 4 values, confirmed with the user/PO in US-007/US-008). The original V5 Draft mentions an additional "Em Aprovação" (Under Approval) state in some parts of UC03.05 — not incorporated here since it is not part of the already-validated enum; if this state is needed in the future, it should be handled as a formal enum revision, not introduced laterally by this US.

### Acceptance Criteria

**Scenario 1 — Valid registration creates the Proposal and Version 1 in the same transaction**
```gherkin
Given the user is authenticated with write access to the budget module
When they fill in Type=CONTRATO, Name/Purpose="Project Alpha", Start Date=01/01/2026, End Date=12/31/2026, Category=CONSOLIDADA
And click [Save]
Then the system persists a new Proposta record with status=RASCUNHO and the entered data
And persists, in the same transaction, a VersaoProposta with numeroVersao=1, status=RASCUNHO, vigente=true, linked to the created Proposal
And the displayed Global Value is R$ 0.00, in a read-only field
And an audit log is written to HistoricoOperacao with usuarioId, timestamp and the created Proposal's data
And the user is redirected to the new Proposal's detail panel
```

**Scenario 2 — Required fields left blank [ERROR LOCK]**
```gherkin
Given the user is filling in the new Proposal form
When they leave any of the fields Type, Name/Purpose, Start Date, End Date or Category blank
And try to save
Then the system blocks the persistence and creates no record (neither Proposal nor Version)
And displays: "Operation Rejected [ERROR LOCK]: The fields Type, Name/Purpose, Start Date, End Date and Category are required and cannot be null."
And the form remains open with the already-entered data intact
```

**Scenario 3 — Chronological inconsistency in the term [ERROR LOCK]**
```gherkin
Given the user is filling in the new Proposal form
When they enter an End Date equal to or earlier than the Start Date
And try to save
Then the system blocks the persistence
And displays: "Validation Error [ERROR LOCK]: The End Date cannot be earlier than or equal to the Start Date configured for the Partnership Agreement."
And no data is changed in the database
```

**Scenario 4 — Audit log write failure reverts the creation**
```gherkin
Given the Proposal and Version 1 data are valid
When the system attempts to persist and the log write to HistoricoOperacao fails
Then the entire transaction is rolled back
And neither the Proposal nor the Version is left saved as orphaned or partial
```

**Scenario 5 — User without write permission [ERROR LOCK]**
```gherkin
Given the authenticated user does not have write access to Registrations > Proposals
When they try to access the registration form or send the request directly to the backend
Then the system blocks the operation, validated on the backend (not only by hiding the button in the UI)
And no data is created
```

### Technical Impact (guidance for dev)

| Aspect            | Detail                                                      |
|-------------------|--------------------------------------------------------------|
| Affected tables   | `Proposta` (INSERT), `VersaoProposta` (INSERT — numeroVersao=1), `HistoricoOperacao` (INSERT) |
| Transaction?      | Yes — creation of the Proposal + Version 1 + audit log in a single atomic transaction. Full rollback on any failure |
| Requires lock?    | No — this is a creation operation (INSERT), with no possible concurrency over a record that doesn't exist yet |
| Audit             | Record in `HistoricoOperacao`: tenantId, usuarioId, propostaId, versaoId, payload of the created cover data |
| Business rule     | Required fields not null (RN_PROP_003); End Date > Start Date (RN_PROP_004); Global Value is never an input, always 0.00 on creation (RN_PROP_001); initial status always RASCUNHO (RN_PROP_006) |

### Dependencies

- ADR-012 (`Proposta`/`VersaoProposta` already modeled — US-007/US-008/US-101 already implemented on top of this foundation)
- No other US blocks this one — it is the foundational US that the following ones (Edit, Delete, Duplicate Proposal) will depend on

### Definition of Done

- [ ] Scenarios 1 through 5 implemented and approved in UAT
- [ ] Proposal and Version 1 always created together, never one without the other (test with a simulated failure during version creation)
- [ ] Global Value always displayed as 0.00 and never accepted as user input
- [ ] Error messages displayed exactly as specified in Scenarios 2 and 3
- [ ] Audit log recorded with all required fields; a log failure reverts the entire operation
- [ ] Operation tested with a user lacking permission (must block on the backend, not just hide the button in the UI)
