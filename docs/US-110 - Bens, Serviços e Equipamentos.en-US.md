## [US-110] — Manage Assets, Services and Equipment

**Module:** Registrations — Assets, Services and Equipment (CAPEX)
**Epic:** EP118/24
**Priority:** High
**Estimate:** M

**As a** Common User (GFIN),
**I want** to create, edit and delete Asset/Service/Equipment items linked to a Proposal (and, when applicable, to a Goal), with the Total Value always calculated,
**So that** the cost of capital investments (CAPEX) composes the Budgeted Value of the analytical account with full auditability.

### Context and Business Rules

Covers UC03.34 through UC03.37 of the V5 Draft Spec (Manage/Register/Edit/Delete Assets, Services and Equipment). Same account-based entry pattern already validated in US-007/US-101/US-109 (Travel).

**Terminology mapping (decision already recorded in [[decisao_layout_menu_vs_schema_docx]]):** "Termo de Parceria" (Partnership Agreement) in the Draft Spec = `Proposta`/`VersaoProposta` in the actual schema. "Level 7 Analytical Account" = `ContaContabil.isAnalitica=true`, without requiring an exact level — the current schema only syncs up to level 4 (same gap documented in US-111); treat "Level 7" as legacy jargon from the Draft Spec, not a literal requirement.

Decisions proposed for closure with the user/Tech Lead:

1. **New `ItemPatrimonial` model** (class name already cited in the Draft Spec itself, "Involved Classes" section), with fields `descricao`, `data`, `quantidade`, `valorUnitario`, `valorTotal` (calculated = `quantidade × valorUnitario`, never a direct input — same pattern as `Cargo.custoTotalCargo` and `Viagem.custoEstimado`).
2. **`metaId` optional (nullable)**, unlike `Viagem` (which always requires `metaId`). The Draft Spec describes "Associated Goal (if any)" — an item exists both in `CONSOLIDADA` and `POR_META` Proposals; it's only linked to a Goal when the Proposal is `POR_META` (RN0170/RN0179 of UC03.36, same conditional pattern already used in `Meta`/US-112).
3. **The linked account is not restricted to a formal "Fixed Assets group"** — there is no "Fixed Assets/Intangible" account tag or group in `ContaContabil` today (RN0411/RN0419 of the Draft Spec ask for this filter). Proposal: accept any `isAnalitica=true` account, with no group filter — same simplification already applied to `ValorOrcadoConta` and `Viagem`. If the user wants the real filter, it needs a CAPEX/OPEX nature tag already floated in the Draft Spec glossary (documentation quality finding, not implemented in any US yet).
4. **Deletion: always soft delete (`ativo` boolean)**, not the hybrid physical/logical conditional logic from the Draft Spec (UC03.37 proposes physical deletion "if there are no linked entries," otherwise soft delete). This is consistent with all previous US (`Cargo`, `Viagem`, `EmpregadoHeadcount`) — none of them implemented conditional physical deletion. Proposal: **do not implement hard delete** here either.
5. **No `TotalizerService`/export reports (PDF/CSV/XLSX) in this US** — RF_PAT_REQ_007, RN_LOG_AQUISICAO and RN0398 (export audit trail, timestamp on report) are out of scope. Only the item CRUD. Revisit alongside UC03.38 (Emit Preview), already listed as not-yet-refined in the backlog.
6. **No pessimistic locking** — same transactional simplicity as `Cargo`/`Viagem`/`Meta`, no critical concurrency identified.

### Acceptance Criteria

**Scenario 1 — Register an asset item in a CONSOLIDADA Proposal (no Goal)**
```gherkin
Given the Proposal "PROP-2026-0001" is OFFICIALIZED and category = CONSOLIDADA
And the Analytical Account "4.1.2.01 - IT Equipment" exists (isAnalitica=true)
When the user registers an item with:
  | Description | Dell Latitude Notebook |
  | Date         | 2026-08-10               |
  | Quantity     | 5                         |
  | Unit Value   | 4500.00                   |
Then the system calculates valorTotal = 5 × 4500.00 = 22500.00
And persists the item with metaId = null
And an audit record `ITEM_PATRIMONIAL_CADASTRADO` is written to HistoricoOperacao
```

**Scenario 2 — Register an asset item in a POR_META Proposal (Goal required)**
```gherkin
Given the Proposal "PROP-2026-0002" is OFFICIALIZED and category = POR_META
And the single Goal of the current VersaoProposta exists
When the user registers an item without selecting a Goal
Then the system blocks the save
And displays the message "Goal is required for Goal-based Proposals."
```

**Scenario 3 — Total Value is always calculated, never accepted as input**
```gherkin
Given the user is registering an item with Quantity = 3 and Unit Value = 100.00
When they try to submit a valorTotal different from 300.00 directly in the payload
Then the system ignores the received value for that field
And persists valorTotal = 300.00 (Quantity × Unit Value) [SHIELDED ORIGIN]
```

**Scenario 4 — Block: required fields left blank [ERROR LOCK]**
```gherkin
Given the user is registering an asset item
When they try to save without filling in Description, Date, Quantity or Analytical Account
Then the system blocks the save
And displays the message "Description, Date, Quantity and Analytical Account are required."
```

**Scenario 5 — Block: negative or zero quantity/unit value**
```gherkin
Given the user is registering or editing an asset item
When they try to save with Quantity ≤ 0 or Unit Value < 0
Then the system blocks the save
And displays the message "Quantity must be greater than zero and Unit Value cannot be negative."
```

**Scenario 6 — Editing an asset item recalculates Total Value**
```gherkin
Given an asset item exists with Quantity = 5, Unit Value = 4500.00, valorTotal = 22500.00
When the user changes the Quantity to 6
Then the system recalculates valorTotal = 27000.00
And an audit record `ITEM_PATRIMONIAL_EDITADO` is written with the previous and new value
```

**Scenario 7 — Delete an asset item (soft delete)**
```gherkin
Given an active asset item exists
When the user clicks Delete and confirms
Then the system sets ativo = false (soft delete), without removing the row from the database
And the item stops appearing in active listings
And an audit record `ITEM_PATRIMONIAL_EXCLUIDO` is written to HistoricoOperacao
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Affected tables | New model `ItemPatrimonial`: `id`, `tenantId`, `versaoId` (FK `VersaoProposta`), `metaId` (FK `Meta`, nullable), `contaId` (FK `ContaContabil`), `descricao`, `data`, `quantidade` (Int), `valorUnitario` (Decimal 15,2), `valorTotal` (Decimal 15,2, calculated), `ativo` (Boolean, default true), `createdAt`, `updatedAt` |
| Transaction? | Yes — `valorTotal` calculation in the same write transaction, same pattern as `Viagem.custoEstimado` |
| Requires lock? | No |
| Audit | `ITEM_PATRIMONIAL_CADASTRADO`, `ITEM_PATRIMONIAL_EDITADO`, `ITEM_PATRIMONIAL_EXCLUIDO` in `HistoricoOperacao` |
| Business rule | `valorTotal` always recalculated, never a direct input; `metaId` required only if `Proposta.categoria = POR_META`; `contaId` must reference an `isAnalitica=true` account; deletion is always soft delete |

### Dependencies

- **US-102 (Proposta/VersaoProposta)**: satisfied.
- **US-112 (Meta)**: satisfied — reuses the same optional 1:1 Goal per version.
- **Chart of Accounts (US-001 through US-006)**: satisfied — uses `ContaContabil.isAnalitica`.

### Definition of Done

- [ ] Acceptance criteria 1 through 7 implemented and tested
- [ ] `valorTotal` always calculated on the backend, never accepted as direct input
- [ ] Tested with CONSOLIDADA Proposal (Goal optional/absent) and POR_META (Goal required)
- [ ] Tested with required fields blank (should block)
- [ ] Tested with invalid quantity/unit value (should block)
- [ ] Deletion tested as soft delete (record preserved, hidden from active listing)
