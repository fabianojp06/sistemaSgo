## [US-108] — Register and Maintain Empregados (Headcount)

**Module:** Registrations — Employees / HR
**Epic:** EP118/24
**Priority:** High
**Estimate:** G

**As an** HR Manager (GRH) or Budget Analyst,
**I want** to register, edit, and delete employees/planned positions of a Proposal, with the cost automatically inherited from the selected Cargo,
**So that** the Proposal's headcount always reflects a real, auditable cost, never manually typed in.

### Context and Business Rules

This US covers UC03.24 (Maintain Empregados), UC03.25 (Register Empregado), UC03.26 (Edit Empregado), and UC03.27 (Delete Empregados) of Draft Spec V5 — **restricted to the headcount CRUD (`EmpregadoHeadcount`) with cost inheritance from the Cargo**. Three scope cuts explicitly out of this US, decisions confirmed with the user:

1. **Meta is not supported in this US.** `Meta` (UC03.13-17) does not exist in the schema yet — it is the next item in the queue, after this US. `EmpregadoHeadcount` is only accepted for Proposals with `categoria = CONSOLIDADA`. An attempt to register in a Proposal with `categoria = POR_META` is blocked in this US (not because the business rule doesn't exist, but because its foundation — `Meta` — doesn't exist yet). RN0242 (Order reset by Meta) is documented but not implemented.
2. **Individual Empregado Benefit Eligibility (individual modal of UC03.24) becomes US-108a.** It logically depends on US-107a (Benefits/Master Table of the Cargo) existing first — it makes no sense for the employee to "opt into" a benefit whose master parameter table hasn't been modeled yet.
3. **Overtime, Hazard Pay, Range, and Level are left out.** There is no data type definition, cost-impact formula, or indication of whether they affect the Totalizer anywhere in the Draft Spec or the data dictionary — recorded as documentation debt, not as a schema field.

Documentation quality findings (the same care already recorded for UC03.07/09/10 and UC03.19):
- **UC03.27 asks for a physical delete** ("physically removed from the database"), contradicting the [SOFT DELETE] guideline that the rest of the project follows. Decision confirmed with the user: **soft delete via the `ativo` field**, consistent with `Cargo`, `UnidadeFuncional`, `VersaoProposta`. This diverges from the UC's literal text — a deviation to be formalized by the Tech Lead (ADR).
- UC03.24 and UC03.25 use "Cargo CTCEA" and "Vínculo Funcional" as UI terms for the same fields that in the schema are `Cargo.nomeCargoMercado`/`Cargo.unidadeFuncional` — screen naming, not data naming.
- REQ_EMP_003 ("Contingency Tag") and RN0249: empty name = "TO BE HIRED" position — implementable independently of Meta, kept in this US.

**Reactive Cargo Inheritance (REQ_EMP_004):** upon selecting a `Cargo`, the system copies (not a simple join reference) the following values into the Empregado record at the time of registration/Cargo change: Functional Assignment (via Cargo), Total Salary, and its component parts. Unlike `ValorOrcadoConta` (computed on the fly), the decision here follows the same pattern adopted for `Cargo.salarioTotal` (US-107, ADR-016): **persist a snapshot of the cost at the time of the assignment**, recalculated every time the Empregado's Cargo is changed — never accepted as a direct user input [SHIELDED ORIGIN].

### Acceptance Criteria

**Scenario 1 — Successfully register an Empregado (named headcount)**
```gherkin
Given Proposal "PROP-2026-001" has category CONSOLIDADA
And Cargo "CARGO-2026-0001 — Analista de Compras Pleno" exists with Total Salary = 6200.00
When the user registers an Empregado with:
  | Cargo               | CARGO-2026-0001           |
  | Name                | Maria da Silva            |
  | Start Period        | 2026-02-01                |
  | Category            | EMPREGADO                 |
  | Number of Dependents| 2                         |
Then the Empregado is persisted with "Total Monthly Cost" = 6200.00 (inherited from the Cargo, read-only)
And the displayed "Functional Assignment" is inherited from the Cargo, not typed in
And an `EMPREGADO_CRIADO` audit record is written to HistoricoOperacao
```

**Scenario 2 — Register a planned position with no name (RN0249, Contingency Tag)**
```gherkin
Given Proposal "PROP-2026-001" has category CONSOLIDADA
And Cargo "CARGO-2026-0002" exists
When the user registers an Empregado with Cargo="CARGO-2026-0002" and Name left blank
Then the system writes the record with the default text "TO BE HIRED" in place of the Name
And the record is treated as a contingency planned position
```

**Scenario 3 — Blocked: Proposal with category POR_META [out of scope of this US]**
```gherkin
Given Proposal "PROP-2026-002" has category POR_META
When the user tries to register an Empregado for that Proposal
Then the system blocks the registration
And displays the message "Employees for Meta-based Proposals are not yet supported — wait for the Meta module to be implemented"
```

**Scenario 4 — Blocked: missing required fields (RN0248)**
```gherkin
Given the user is registering an Empregado
When they try to save without selecting a Cargo
Then the system blocks the save
And displays the message "Select a Cargo before saving the employee"
And no record is persisted
```

**Scenario 5 — Blocked: Start Period earlier than the Proposal's (RN0252)**
```gherkin
Given Proposal "PROP-2026-001" has dataInicio = 2026-01-01
When the user tries to register an Empregado with Start Period = 2025-12-01
Then the system blocks the save
And displays the message "Start Period cannot be earlier than the Proposal's start date"
```

**Scenario 6 — Edit Empregado: changing the Cargo recalculates the inherited cost [SHIELDED ORIGIN]**
```gherkin
Given Empregado "Maria da Silva" is linked to Cargo "CARGO-2026-0001" (Total Salary 6200.00)
And Cargo "CARGO-2026-0003" exists with Total Salary = 7100.00
When the user edits the Empregado, changing the Cargo to "CARGO-2026-0003"
Then the Empregado's "Total Monthly Cost" becomes 7100.00
And the "Functional Assignment" is updated to that of the new Cargo
And an `EMPREGADO_EDITADO` audit record is written with the previous and the new cost
```

**Scenario 7 — Blocked: attempt to manually edit the Total Monthly Cost [HARD ERROR]**
```gherkin
Given an Empregado has already been registered with Total Monthly Cost = 6200.00 (inherited from the Cargo)
When the user tries to submit a change sending a different value for "Total Monthly Cost"
Then the system ignores the received value for that field
And keeps the value inherited from the linked Cargo
And the rest of the request's editable fields are processed normally
```

**Scenario 8 — Successfully delete an Empregado (soft delete)**
```gherkin
Given Empregado "João Souza" has no operational entries linked to them (per diems, trips, advances)
And the Proposal is in DRAFT status
When the user confirms the deletion of the Empregado
Then the record is marked as `ativo = false` (soft delete — never a physical DELETE)
And it stops appearing in the standard Empregados listing
And an `EMPREGADO_EXCLUIDO` audit record is written with a snapshot of the removed state
```

**Scenario 9 — Blocked: deleting an Empregado with an active operational link [HARD ERROR, E1 of UC03.27]**
```gherkin
Given Empregado "João Souza" has a per diem or an approved trip linked to them
When the user tries to delete them
Then the system blocks the deletion
And displays the message "Deletion Rejected: this employee has linked operational entries (per diems, trips, or advances)"
```
*(Note: this scenario depends on the Trips/Assets modules, not yet implemented — kept as a specification; the link check always returns "no link" until those modules exist.)*

**Scenario 10 — Blocked: deletion outside the Proposal's editable statuses**
```gherkin
Given the Empregado's Proposal is in OFICIALIZADO status
When the user tries to delete the Empregado
Then the system blocks the deletion
And displays the message "Action Denied [HARD ERROR]: this Proposal is officialized and its data is frozen"
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | New table `EmpregadoHeadcount` (final name at the Tech Lead's discretion) |
| Fields changed | tenantId, propostaId (FK, CONSOLIDADA only), cargoId (FK Cargo), nome (nullable → "TO BE HIRED"), categoria (enum, e.g. EMPREGADO/ESTAGIARIO/JOVEM_APRENDIZ), periodoInicio, periodoFim (nullable), numeroDependentes, vinculoFuncionalHerdado (snapshot, text or FK), custoTotalMensal (Decimal, snapshot inherited from the Cargo), ativo (soft delete) |
| Transaction? | Yes — creating/editing/deleting the Empregado is atomic; the cost snapshot is recalculated in the same transaction as the Cargo assignment |
| Requires lock? | Not at this time — same reasoning as `Cargo` (US-107): no motivating concurrent-edit scenario yet |
| Audit | `EMPREGADO_CRIADO`, `EMPREGADO_EDITADO`, `EMPREGADO_EXCLUIDO` in HistoricoOperacao |
| Business rule | RN0248 (Cargo required), RN0249 (Contingency Tag), RN0252 (not backdated), REQ_EMP_004 (reactive Cargo inheritance), blocking of category POR_META |

### Dependencies

- **US-107 (Cargo)**: satisfied — Empregado inherits cost and functional assignment from the Cargo.
- **US-108a (to be created) — Individual Empregado Benefit Eligibility**: out of scope here; depends on US-107a existing first.
- **Meta (item 6 in the queue, not yet started)**: blocks support for Proposal `categoria=POR_META` — Scenario 3 documents the block, does not implement the full rule.
- **Trips/Assets (not yet started)**: Scenario 9 (blocking deletion due to an operational link) has an always-negative check until those modules exist.
- **Qtde. Empregado (item 7 in the queue)**: consumes the aggregated data from `EmpregadoHeadcount` — this US partially unblocks it.

### Definition of Done

- [ ] Acceptance criteria 1, 2, 4, 5, 6, 7, 8, 10 implemented and tested
- [ ] Scenario 3 (POR_META block) implemented as a simple block (category ≠ CONSOLIDADA always rejected for now)
- [ ] Scenario 9 documented, not implemented (always returns "no link" until Trips/Assets exist)
- [ ] Total Monthly Cost and Functional Assignment are always inherited from the Cargo, never accepted as direct input
- [ ] Deletion is always a soft delete (`ativo=false`), never a physical DELETE
- [ ] Audit log generated for creation/edit/deletion, including a snapshot of the previous state
- [ ] Tested with an Officialized Proposal (deletion/edit must block)
- [ ] Tested with an attempted manual edit of the Total Monthly Cost (must be ignored, the rest of the update goes through)
