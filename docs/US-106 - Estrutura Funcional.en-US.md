## [US-106] — Manage the Proposal's Functional Structure (Org Chart)

**Module:** Registrations — Employees / Functional Structure
**Epic:** EP118/24
**Priority:** High
**Estimate:** M

**As a** Budget Analyst or HR Manager (GRH),
**I want** to build the org chart (unit tree) of a Proposal/Partnership Agreement, distinguishing consolidation units (Directorate/Management) from operational units (Advisory/Coordination/Sector),
**So that** I have a well-defined "internal geography" before allocating any Cargo — ensuring that no personnel cost is left orphaned or posted at a level meant only to consolidate.

### Context and Business Rules

This US covers UC03.18 (Functional Structure) of Draft Spec V5, in the slice that can already be implemented today: **the organizational tree itself** (creating, editing, deactivating units, and validating the parent-child hierarchy). The Draft Spec describes this screen as a prerequisite for UC03.19 (Cargo and Salary) and UC03.24-27 (Empregados) — neither of these modules exists yet in the project, so three UC03.18 rules that depend on them are **explicitly out of scope for this US**:

- **RN_EST_01** (every Cargo must be linked to an analytical node, blocking officialization if there is an orphan Cargo) — depends on `Cargo` existing.
- **RN_EST_03** (the 100% rule when apportioning a Cargo across multiple units) — depends on `CargoAlocacaoPercentual` existing.
- **RN_EST_05** (cleanup of Cargos imported from Rubi without a clear unit assignment) — depends on `Cargo` and the Rubi integration existing.

These three rules must be revisited when UC03.19/UC03.24-27 are implemented — not as rework of this US, but as its natural extension (the tree will already exist; only the `Cargo` side needs to point to it).

**Scope decision (closed, confirmed by the user on 2026-08-11 while refining [US-130](US-130%20-%20Importar%20Estrutura%20Organizacional%20entre%20Propostas.pt-BR.md))**: unlike this US's original assumption (scoped per `VersaoProposta`, following the pattern of `ValorOrcadoConta`/`RateioImpostoGrade`), `UnidadeFuncional` is scoped per **entire `Proposta`** — the org chart does not change across versions of the same Proposal, and `CriarVersaoPropostaUseCase` (US-007) does not need to clone the tree when creating a new version. This is how it is already implemented (`propostaId` directly on the schema, not `versaoId`) and it stays that way.

Hierarchical structure (fixed, 2 levels):
- **Level 1 — Synthetic** (`DIRETORIA` or `GERENCIA`): exists only to consolidate the costs of the units below it. Never receives a direct Cargo allocation (RN_EST_02).
- **Level 2 — Analytical**: subordinate to a specific Synthetic node, with a strict parent-child link by type:
  - `ASSESSOR` → can only have a Synthetic unit of type `DIRETORIA` as its parent.
  - `COORDENADORIA` or `SETOR` → can only have a Synthetic unit of type `GERENCIA` as its parent.

### Acceptance Criteria

**Scenario 1 — Valid creation of a Synthetic unit (root)**
```gherkin
Given the user is authenticated with write access to the Employees module
When they create a "Diretoria Executiva" unit, Level Type = Synthetic (Directorate), with no parent unit
Then the system persists the unit with no parent (root node)
And the audit log is recorded with the created data
```

**Scenario 2 — Valid creation of an Analytical unit under the correct parent**
```gherkin
Given the Synthetic unit "Diretoria Executiva" (type DIRETORIA) exists
When the user creates the unit "Assessoria de Planejamento", Level Type = Analytical (Advisory), with parent = "Diretoria Executiva"
Then the system persists the unit with the parent-child link
And the tree now shows "Assessoria de Planejamento" as a child of "Diretoria Executiva"
```

**Scenario 3 — Invalid hierarchical association [HARD ERROR]**
```gherkin
Given the Synthetic unit "Diretoria Executiva" (type DIRETORIA) exists
When the user tries to create an Analytical unit of type Coordination or Sector with "Diretoria Executiva" as its parent
Then the system blocks the creation
And displays: "Invalid Hierarchical Link [HARD ERROR]: Coordination/Sector can only be subordinate to a Management-type unit. Advisory can only be subordinate to a Directorate-type unit."
And no data is changed in the database
```

**Scenario 4 — Cargo allocation blocked at Synthetic level [HARD ERROR]**
```gherkin
Given the user is creating or editing a unit
When they try to set a Synthetic unit (Directorate/Management) as a Cargo allocation target
Then the system blocks it — Synthetic units never appear as an allocation-target option, only Analytical units do
```

**Scenario 5 — Deactivation blocked by an active link [HARD ERROR]**
```gherkin
Given a Functional Structure unit has at least one Cargo linked to it
When the user tries to deactivate this unit
Then the system blocks the deactivation
And displays: "Deactivation Blocked [HARD ERROR]: This unit has Cargos linked to it. Remove or reallocate the Cargos before deactivating it."
And the unit remains active
```

**Scenario 6 — Deactivation allowed with no links**
```gherkin
Given a Functional Structure unit has no Cargo linked to it
When the user deactivates it
Then the system marks the unit as inactive (soft delete)
And the audit log is recorded
```

**Scenario 7 — Write blocked on a non-editable Version [HARD ERROR]**
```gherkin
Given the Proposal Version to which the Functional Structure belongs is in OFICIALIZADO or ENCERRADO status
When the user tries to create, edit, or deactivate any unit
Then the system blocks the operation (same pattern already used in US-007/US-101)
And no data is changed in the database
```

### Technical Impact (guidance for dev)

| Aspect             | Detail                                                  |
|---------------------|------------------------------------------------------------|
| Tables affected  | New table `UnidadeFuncional` — FK to `VersaoProposta` (assumption to be confirmed by the Tech Lead), self-relationship `idPai` for the hierarchy |
| Suggested model   | `UnidadeFuncional { id, tenantId, versaoId (FK VersaoProposta), nome, tipoNivel enum(SINTETICO_DIRETORIA\|SINTETICO_GERENCIA\|ANALITICO_ASSESSOR\|ANALITICO_COORDENADORIA\|ANALITICO_SETOR), idPai (FK UnidadeFuncional, nullable), ativa Boolean, createdAt, updatedAt }` |
| Transaction?        | Yes — creation/editing/deactivation + audit log in a single transaction |
| Requires lock?      | No — no balance concurrency; hierarchy validation is a simple read-then-write |
| Audit         | Record in `HistoricoOperacao`: tenantId, usuarioId, versaoId, unidadeId, previous/new state |
| Business rule  | Parent-child link by type (Advisory↔Directorate, Coordination/Sector↔Management); allocation only at the Analytical level; deactivation blocked while a Cargo link exists (once Cargo exists — today the check always passes, since there is no Cargo to link) |

Technical note (for the Tech Lead to decide): confirm whether `UnidadeFuncional` is scoped per `VersaoProposta` (this US's assumption, following the US-007/101 pattern) or per `Proposta` directly (does the org chart stay unchanged across versions of the same Proposal?) — this decision also determines whether `CriarVersaoPropostaUseCase` (US-007) needs to be extended to clone the tree when creating a new version.

### Dependencies

- ADR-012 (`Proposta`/`VersaoProposta`) — basis for the scoping FK
- Partially unblocks UC03.19 (Cargo and Salary) and UC03.24-27 (Empregados) — which will need this tree to link Cargos
- RN_EST_01, RN_EST_03, RN_EST_05 remain pending until `Cargo`/`CargoAlocacaoPercentual` exist (not scenarios of this US)

### Definition of Done

- [ ] Scenarios 1 to 7 implemented and approved in homologation
- [ ] Parent-child link strictly validated by type (Advisory only under Directorate; Coordination/Sector only under Management)
- [ ] Synthetic unit never appears as a Cargo allocation target
- [ ] Deactivation correctly blocked when a Cargo link exists (revisit the test once Cargo exists)
- [ ] Audit log recorded on every write operation
- [ ] Operation tested with a user without permission (must block on the backend)
- [ ] Operation correctly blocked on an Officialized/Closed Version
