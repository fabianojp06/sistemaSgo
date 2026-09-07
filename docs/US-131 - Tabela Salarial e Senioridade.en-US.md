## [US-131] — Maintain Market Salary Table (by Position and Seniority)

**Module:** Registrations — Positions and Salaries (UC03.19, section 5 of the Jun/2026 Rev. — Salary Table 🆕)
**Epic:** EP118/24
**Priority:** High
**Estimate:** M

**As a** GRH User,
**I want** to register market salary ranges by Position and Seniority, and look them up from the Positions screen,
**So that** filling in the Position's Minimum/Maximum Salary has an auditable market research source, instead of free-form typing with no reference.

### Context and Business Rules

Source document: `Tela-Cadastro-de-Cargos-Salarios-Rev-Jun2026.docx`, section 5 (GAP-CAR-001, ✅ resolved) and REQ_TAB_001-005/RN_TAB_01-05. It is a new screen, an **independent** market-table entity — with no link to the Salary Table/Range/Level fields that will come from Rubi (US-132), which are sovereign data from Senior.

**Seniority is a catalog extensible per tenant:** Junior/Mid/Senior are born as protected records (`isPadrao=true`, cannot be deleted); GRH can register custom levels, deletable only if they have no record linked in the Salary Table (RN_TAB_01).

**Position + Seniority is not a unique key** (RN_TAB_03) — there can be multiple records for the same pair (e.g. 2 market surveys on different dates); the lookup from the Positions screen displays all of them, grouped by seniority, and the user chooses which one to use.

When selecting a range in the Salary Table from the Positions screen, the system copies `salarioMinimo`/`salarioMaximo` into the corresponding Position fields and records the origin (`TABELA_SALARIAL`); a subsequent manual edit of those fields changes the origin to `MANUAL` (RN_TAB_04/05 — see US-133 for the behavior on the Positions screen).

### Acceptance Criteria

**Scenario 1 — Register a market salary range**
```gherkin
Given the Position "Systems Analyst" already exists in SGO
And the Seniority "Senior" exists (default, protected)
When the GRH user registers in the Salary Table:
  | Position     | Systems Analyst |
  | Seniority    | Senior           |
  | Min. Salary  | 6500.00          |
  | Max. Salary  | 9200.00          |
Then the system persists the record
And records `criadoPor`/`criadoEm` for audit purposes
```

**Scenario 2 — Blocked: Minimum Salary >= Maximum Salary [LOCK THE ERROR]**
```gherkin
Given the user is registering a range with Minimum Salary = 9000.00 and Maximum Salary = 8500.00
When they try to save
Then the system blocks with "Minimum Salary must be less than Maximum Salary." [LOCK THE ERROR]
And no record is persisted
```

**Scenario 3 — Register a custom Seniority**
```gherkin
Given the GRH user needs a "Specialist" level, not present in the default catalog
When they register the Seniority "Specialist" (isPadrao=false)
Then the system persists the new level
And it becomes available for selection in the Salary Table
```

**Scenario 4 — Blocked: deleting a default Seniority or one with linked records**
```gherkin
Given the user tries to delete the "Senior" Seniority (default) OR a custom Seniority with records in the Salary Table
When they trigger "Delete"
Then the system blocks with a message explaining the reason (protected default / has linked records) [LOCK THE ERROR]
```

**Scenario 5 — Look up the Salary Table from the Positions screen**
```gherkin
Given the Position "Systems Analyst" has 3 records in the Salary Table (Junior, Mid, Senior)
When the user triggers the "Salary Table" button on the Positions screen
Then the system opens the list filtered by the current Position, grouped by Seniority
And the user can select 1 record to copy Min/Max into the Position (see US-133, Scenario 1)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| New tables | `TabelaSalarial` (id, cargoId, senioridadeId, salarioMinimo, salarioMaximo, criadoPor, criadoEm), `Senioridade` (id, descricao, isPadrao, ativo) |
| Transaction? | No — simple CRUD, no atomic multi-table operation |
| Requires lock? | No |
| Audit trail | `criadoPor`/`criadoEm` on the table itself; Seniority deletion recorded in `HistoricoOperacao` |
| Seed | Default Seniority (Junior/Mid/Senior, `isPadrao=true`) seeded per tenant on the module's first run |
| Business rule | Min < Max validation in the use case; blocks deletion of a default or referenced Seniority |

### Dependencies

- None — independent screen and tables, but consumed by US-133 (auto-fill on the Positions screen)

### Definition of Done

- [ ] Acceptance criteria implemented and approved in staging
- [ ] Min >= Max block tested
- [ ] Deletion of default Seniority blocked
- [ ] Deletion of custom Seniority with linked records blocked
- [ ] Multiple records per Position+Seniority pair supported (no improper unique constraint)
