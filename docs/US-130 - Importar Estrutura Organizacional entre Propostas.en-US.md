## [US-130] — Import Organizational Structure (Org Chart) from another Proposal

**Module:** Registrations — Employees / Functional Structure
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As a** Budget Analyst or HR Manager (GRH),
**I want** to import the org chart (`UnidadeFuncional` tree) already registered in an existing Proposal into a new Proposal (Contract or Partnership Agreement),
**So that** I don't have to manually recreate, unit by unit, an organizational structure that already exists in another equivalent or earlier Proposal.

### Context and Business Rules

Today (US-106, `docs/US-106 - Estrutura Funcional.pt-BR.md`) each Proposal has its own org chart (`UnidadeFuncional`, scoped by the entire `Proposta` — not by Version), registered from scratch via `CriarUnidadeFuncionalUseCase`. There is no mechanism to reuse it between different Proposals: not even `DuplicarPropostaUseCase` (US-104) copies the org chart — it only duplicates `ValorOrcadoConta` and `RateioImpostoGrade` from the source Proposal into a new Proposal created from scratch.

This US covers a different case from `DuplicarPropostaUseCase`: the **destination** Proposal **already exists** (was created normally via US-102, with or without its own org chart) and the user wants to bring in the tree from a different **source** Proposal, on demand, at any time while the destination is still editable.

4 business decisions were made with the user to close the design (2026-08-11):

1. **Frozen copy, not a live link.** The import creates new, independent units in the destination Proposal (same pattern as `DuplicarPropostaUseCase`: the copied records do not reference the originals). Editing, renaming, or deactivating a unit in the source Proposal **after** the import has no effect whatsoever on the destination Proposal.
2. **No restriction by Proposal `tipo`.** Importing from a `CONTRATO` Proposal into a `TERMO_DE_PARCERIA` one is allowed, and vice versa — the org chart is conceptually the same in both types, and there is currently no business rule that differentiates them in this respect.
3. **Replace everything, don't merge.** If the destination Proposal already has some `UnidadeFuncional` registered (partial or complete org chart), the import **deactivates** the existing units and inserts the imported tree in their place. There is no attempt to merge or deduplicate by name.
4. **`UnidadeFuncional` scope confirmed as the entire `Proposta`** (not per Version) — a decision that also closes the open technical note left by the original US-106. No scope migration needed for this US.

**Point this US needs to resolve that was not covered by the 4 decisions above — conflict between "replace everything" and the existing deactivation guard:** `InativarUnidadeFuncionalUseCase` (US-106, RN_EST_04) **blocks** deactivating a unit that has a `CargoAlocacaoPercentual` linked to it. If the destination Proposal already has Positions allocated to existing units, "replace everything" would collide with that guard. See Scenario 4 below — the import must **block with an explicit error** in that case (same "Lock the Error" philosophy as the rest of the system), rather than silencing the guard or forcing deactivation past it.

**2026-08-11 correction (same refinement session)**: this US was originally refined assuming the Functional Structure UI (US-116) did not yet exist — a wrong premise. **US-116/US-117 have already been implemented in production since 2026-08-08** (`/propostas/{id}/estrutura`, `EstruturaFuncionalPanel.tsx`/`OrganogramaPanel.tsx`/`CargoPanel.tsx`), it was only left out of the Kanban backlog by mistake. There is no longer a sequencing dependency to wait on — the "Import from another Proposal" action is a new button/flow within that already-existing screen. The technical design of [ADR-041](ADR-041%20-%20Sequenciamento%20US-116-US-130%20e%20Remapeamento%20de%20Hierarquia.pt-BR.md) (self-relation hierarchy remapping, batch linked-Position guard) remains valid — only the sequencing premise changed.

### Acceptance Criteria

**Scenario 1 — Successful import into a destination Proposal with no prior org chart**
```gherkin
Given Proposal A (source) has a complete org chart: 1 Directorate with 2 child Advisory units
And Proposal B (destination) is in DRAFT or IN_PROGRESS status, with no UnidadeFuncional registered
And the user is authenticated with write permission on the Employees module for Proposal B
When they select Proposal A as the source and confirm the import
Then the system creates an independent copy of the tree in Proposal B: 1 Directorate + 2 Advisory units, preserving the hierarchy (idPai remapped to the new IDs)
And the names and tipoNivel of the copied units are identical to the source
And the audit log is written with: actor, date, propostaOrigemId, propostaDestinoId, number of units imported
```

**Scenario 2 — Import replaces a partial org chart already existing in the destination**
```gherkin
Given Proposal B (destination) already has 1 Synthetic unit "Finance Department" registered, with no Position linked to it
When the user imports the org chart from Proposal A
Then the "Finance Department" unit (and any other pre-existing unit in the destination) is deactivated
And the imported tree from Proposal A is inserted as the only active units of Proposal B
And the audit log records both the deactivation of the old units and the creation of the new ones, in the same operation
```

**Scenario 3 — Editing the source after the import does not propagate to the destination [frozen copy]**
```gherkin
Given the import from Proposal A into Proposal B has already been completed
When the user renames a unit in Proposal A (source) or deactivates a unit there
Then the corresponding unit already copied into Proposal B remains unchanged, with the name and status it had at the time of import
```

**Scenario 4 — Import blocked when the destination has a Position linked to the existing org chart [LOCK THE ERROR]**
```gherkin
Given Proposal B (destination) already has an Analytical unit "Purchasing Sector" with at least 1 CargoAlocacaoPercentual linked to it
When the user tries to import the org chart from another Proposal into Proposal B
Then the system blocks the entire operation before any write, with an explicit message stating which units have a linked Position and prevent the replacement
And no unit is created, deactivated, or changed in either Proposal
And no import audit log is written (the operation never occurred)
```

**Scenario 5 — Import allowed between different Proposal types**
```gherkin
Given Proposal A (source) is of type CONTRATO
And Proposal B (destination) is of type TERMO_DE_PARCERIA
When the user imports the org chart from A into B
Then the import proceeds normally, with no restriction related to Proposal type
```

**Scenario 6 — Blocked due to non-editable destination Proposal status [LOCK THE ERROR]**
```gherkin
Given Proposal B (destination) is in OFICIALIZADO or ENCERRADO status
When the user tries to import an org chart into it
Then the system blocks the operation with a message stating that the destination Proposal is not in edit mode
And no data is changed
```

**Scenario 7 — Source with no org chart registered**
```gherkin
Given Proposal A (source) has no active UnidadeFuncional registered
When the user tries to import the org chart from A into any destination Proposal
Then the system blocks with a message stating that the source Proposal has no organizational structure to import
And no data is changed
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `UnidadeFuncional` (read on the source, write — create + deactivation — on the destination) |
| New Use Case | `ImportarEstruturaOrganizacionalUseCase` — not an extension of `DuplicarPropostaUseCase` (that one creates a new Proposal from scratch; this one imports into an already-existing destination Proposal) |
| Remapping pattern | Designed in ADR-041 — 2 deterministic steps (Synthetic units first with `Map<idOrigem, idNovoDestino>`, then Analytical units resolving `idPai` via the map), leveraging the fact that the tree is always 2 fixed levels (ADR-015), with no need for generic recursion |
| Batch linked-Position guard | New read-only check before the transaction (`findMany` of active destination units with `alocacoesCargo: { some: {} }`) — does not reuse `InativarUnidadeFuncionalUseCase` directly (that one is per-unit). Dedicated error listing the blocking units (see ADR-041) |
| Transaction? | Yes — the entire operation (linked-Position validation + deactivation of the destination's old units + creation of the new tree) in a single atomic `$transaction` |
| Requires lock? | No — no balance concurrency; but the `CargoAlocacaoPercentual` linkage validation must occur within the same transaction to avoid a race with a concurrent Position registration |
| Audit trail | Record in `HistoricoOperacao`: tenantId, usuarioId, propostaOrigemId, propostaDestinoId, number of deactivated units + number of created units |
| Business rule | RN_EST_04 (already existing, US-106) reused as a full-import blocking guard, not as a unit-by-unit block — see Scenario 4 |
| Status validation | Reuses the same DRAFT/IN_PROGRESS check already used by `CriarUnidadeFuncionalUseCase` (US-106), applied to the **destination** Proposal |

### Dependencies

- **US-106** (`UnidadeFuncional`, RN_EST_04) — underlying data and reused linked-Position guard
- **US-116** (Manage Functional Structure — UI, not yet implemented) — this US depends on a screen existing where the import button/flow is exposed; assess with the Tech Lead whether they land in the same PR or in sequence
- **US-107/US-107a** (`Cargo`, `CargoAlocacaoPercentual`) — needed for Scenario 4 (linked-Position guard) to make sense; already implemented

### Definition of Done

- [ ] Scenarios 1 to 7 implemented and approved in staging
- [ ] Hierarchy remapping (idPai) verified with a full 2-level tree (Synthetic + Analytical)
- [ ] Import is atomic — failure at any point does not leave the destination Proposal with a partially replaced org chart
- [ ] Linked-Position guard (Scenario 4) tested with an explicit message listing the blocking units
- [ ] Import tested between Proposals of different types (Contract ↔ Partnership Agreement)
- [ ] Audit log written with the count of deactivated and created units
- [ ] Operation tested with a user without permission (must block)
- [ ] Operation correctly blocked when the destination Proposal is Officialized/Closed
- [ ] US-106's technical note on Proposal vs. Version scope closed and propagated to the original file (done in this session)

### Note on external validation notices

Like US-128/US-129 (Assumptions and Adjustments), this US has no acceptance criteria signed by Rafael Guerra/GIA or validated by André/SCOR — it is a demand raised directly by the user in this session, outside the formal flow of externally sourced acceptance criteria. There is no divergence to flag (there is no prior acceptance criteria document for this US), but it is worth recording the same practice of keeping traceability in case a formal acceptance criteria document later appears covering the same scope.
