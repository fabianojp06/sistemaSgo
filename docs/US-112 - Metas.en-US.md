## [US-112] — Maintain Goal (Create, Update, Delete — single record per Version)

**Module:** Registrations — Goals and Physical Allotments
**Epic:** EP118/24
**Priority:** High
**Estimate:** S

**As a** Budget Analyst or Financial Manager (GFIN),
**I want** a Proposal with category `POR_META` to have a single Goal record, with the Global Value always mirroring the total already budgeted across the analytical accounts,
**So that** I can identify/name the physical grouping of the budget without the risk of the value diverging from what was actually parameterized in the Chart of Accounts.

### Context and Business Rules

This US covers UC03.14 (Maintain Goal), UC03.15 (Create Goal), UC03.16 (Update Goal), and UC03.17 (Delete Goal) of Draft Spec V5.

**Modeling revision from this session (replaces the previous version of this document):** the initial understanding — that a `POR_META` Proposal would have several Goals (physical installments summed against a ceiling) — was **wrong**. The user clarified: **within a Proposal/project, when the category is `POR_META`, there is exactly 1 (one) Goal.** When it is not `POR_META`, it is `CONSOLIDADA` — and there is no Goal at all. There is no "sum of several Goals against a ceiling" — there is, at most, a single complementary record per Version.

This drastically simplifies the US compared to the previous design:
- **Cardinality: optional 1:1 between `VersaoProposta` and `Meta`** (zero or one record, never more than one). `@@unique([tenantId, versaoId])`, not `@@unique([tenantId, versaoId, numero])` — there is no sequential Goal "number", because there is no list.
- **`Meta.valorGlobal` is not typed by the user.** It is always a read-only mirror of `SUM(ValorOrcadoConta.valor) WHERE tenantId, versaoId` — the same total that motivated the previous decision, but now without "sum vs. ceiling" validation: it is direct assignment, [SHIELDED ORIGIN]. RN0141/150 (overflow lock by summation) no longer exists — there is nothing to overflow when the value is always equal to the total, not a sum of parts.
- **RN0242 (incremental order reset per Goal) no longer exists** — there is no longer more than one Goal to order.
- **The concurrency race condition that motivated the pessimistic-lock proposal in the previous ADR also no longer exists** — there is no longer "two Goals written at the same time overflowing a summed ceiling"; there is just 1 record whose value is always recalculated from the current total.
- The fields editable by the user remain: Type, Name, Status, Notes — except that now they always live on a single record per Version, created from the moment the Proposal is set to `POR_META` (or registered on demand when the user first accesses the Goal sub-tab).
- **Soft delete** retained (same deviation already formalized in US-108) — the Draft Spec calls for physical deletion.
- Documentation quality finding (still valid): REQ0130 (link between Goal and Chart of Accounts accounts) remains without a clear specification in the flows — out of scope.
- RN0136/E1 (UC03.17): deletion blocked if the Goal has linked headcounts/per diems/apportionments — check always returns "no link" in this US, same situation as US-108.

### Acceptance Criteria

**Scenario 1 — Create the single Goal of a Version, with Global Value mirrored from the budgeted total**
```gherkin
Given VersaoProposta "v1" of Proposal "PROP-2026-003" (category POR_META) has SUM(ValorOrcadoConta.valor) = 1,000,000.00
And "v1" does not yet have any Goal registered
When the user creates the Goal with Type="Training", Name="Regional Training", Status=ACTIVE
Then the Goal is persisted linked to "v1"
And the "Global Value" field is automatically filled with 1,000,000.00 (Read-only, mirror of the budgeted total)
And a `META_CRIADA` audit record is written to HistoricoOperacao
```

**Scenario 2 — Block: attempting to create a second Goal on the same Version [HARD ERROR]**
```gherkin
Given VersaoProposta "v1" already has an active Goal registered
When the user tries to create a new Goal for "v1"
Then the system blocks the creation
And displays the message "This Version already has a registered Goal. Update the existing record instead of creating a new one."
```

**Scenario 3 — Block: creating a Goal on a Proposal with category CONSOLIDADA**
```gherkin
Given Proposal "PROP-2026-004" has category CONSOLIDADA
When the user tries to create a Goal for a Version of that Proposal
Then the system blocks the creation
And displays the message "Goals only apply to Proposals with category 'By Goal'."
```

**Scenario 4 — Block: missing required fields (RN0139)**
```gherkin
Given the user is creating the Goal of a POR_META Version
When they try to save without filling in Status
Then the system blocks the save
And displays the message "Fill in Type and Status before saving."
```

**Scenario 5 — Block: create/update on a non-editable VersaoProposta (RN0183)**
```gherkin
Given VersaoProposta "v1" has status OFICIALIZADO
When the user tries to create or update the Goal linked to it
Then the system blocks the operation
And displays the message "Action Denied: this snapshot has been approved and has become permanently immutable due to its lifecycle."
```

**Scenario 6 — Update Goal: Name/Type/Status/Notes are editable, Global Value remains mirrored**
```gherkin
Given the Goal of "v1" has Name="Regional Training" and Global Value=1,000,000.00 (current SUM ValorOrcadoConta)
When the user changes the Name to "Regional Training — Revision 1"
Then the Name is updated
And the Global Value remains equal to the current SUM(ValorOrcadoConta.valor), recalculated at the time of saving
And a `META_EDITADA` audit record is written
```

**Scenario 7 — Block: attempting to manually edit the Global Value [SHIELDED ORIGIN]**
```gherkin
Given the Goal of "v1" has Global Value = 1,000,000.00 (mirrored)
When the user tries to submit a change sending a different Global Value
Then the system ignores the received value for that field
And recalculates the Global Value from SUM(ValorOrcadoConta.valor) at the time of saving
And the rest of the change is processed normally
```

**Scenario 8 — Successfully delete the Goal (soft delete)**
```gherkin
Given the Goal of "v1" has no linked headcount, per diem, or apportionment
And VersaoProposta is in RASCUNHO status
When the user confirms the deletion of the Goal
Then the record is marked `ativo = false` (soft delete)
And the Version can once again receive the creation of a new Goal (Scenario 2 no longer blocks)
And a `META_EXCLUIDA` audit record is written with a snapshot of the removed state
```

**Scenario 9 — Block: deletion of a Goal with an operational link [E1 of UC03.17]**
```gherkin
Given the Goal has a linked headcount or travel expense
When the user tries to delete it
Then the system blocks the deletion
And displays the message "Deletion Denied: Operation blocked. The goal has linked operational records, or the project's current lifecycle stage does not allow changes."
```
*(Note: the operational-link check always returns "no link" until Travel/Assets/Employees-by-Goal exist — same situation documented in US-108, Scenario 9.)*

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | New table `Meta` |
| Fields changed | tenantId, versaoId (FK VersaoProposta, **unique** — `@@unique([tenantId, versaoId])`), tipo, nome, valorGlobal (Decimal 15,2, always recalculated in the backend), status (enum ATIVO/INATIVO), observacao (nullable), ativo (soft delete) |
| Transaction? | Yes — recalculating `valorGlobal` from `SUM(ValorOrcadoConta.valor)` must happen in the same transaction as the write |
| Requires lock? | **No** — decision revised: with no "sum of several Goals" concurrency, the race scenario from the previous ADR does not apply. Simple read+write within a standard transaction, the same level of protection as `Cargo` (US-107). |
| Audit | `META_CRIADA`, `META_EDITADA`, `META_EXCLUIDA` in HistoricoOperacao |
| Business rule | RN0139 (required fields), 1:1 uniqueness per Version, category=POR_META required, RN0183 (editable lifecycle), RN0136 (deletion block with link), SHIELDED ORIGIN (Global Value always mirrored) |

### Dependencies

- **US-007 (ValorOrcadoConta)**: source of the mirrored Global Value — satisfied.
- **US-102 (Proposal)** / category `POR_META`: satisfied.
- **US-108 (Employees)**: may be extended to accept `categoria=POR_META` referencing the Version's single Goal — a natural extension, not rework.
- **Travel/Assets (not yet started)**: Scenario 9 stays with an always-negative check until these modules exist.

### Definition of Done

- [ ] Acceptance criteria 1 to 8 implemented and tested
- [ ] Scenario 9 documented, not implemented (always returns "no link")
- [ ] Uniqueness constraint guarantees at most 1 active Goal per Version
- [ ] Global Value is always recalculated from SUM(ValorOrcadoConta.valor), never accepted as direct input
- [ ] Deletion is always a soft delete (`ativo=false`)
- [ ] Audit log generated for create/update/delete with snapshot of the prior state
- [ ] Tested with an Officialized VersaoProposta (must block create/update/delete)
- [ ] Tested with an attempt to create a second Goal on the same Version (must block)
- [ ] Tested with a CONSOLIDADA Proposal (must block Goal creation)
