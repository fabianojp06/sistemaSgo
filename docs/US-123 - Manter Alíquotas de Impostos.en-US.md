## [US-123] — Maintain Tax Rates (Query and Listing)

**Module:** Registrations — Tax Rates
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As an** Administrator, Budget Analyst, or Financial Manager,
**I want** to query, filter, and list the tax rates registered in the fiscal parameters base,
**So that** I have centralized visibility into what is available for allocation in Proposals, without depending directly on the seed/database.

### Context and Business Rules

Covers UC03.39 from the `Especificacao_UC03.39_a_UC03.42_Aliquotas_Impostos.md` specification (a formalized gap, with no prior UC — `AliquotaImpostoParametro` is currently only populated via `prisma/seed.mjs`; no administration screen exists). Source menu: **Registrations > Tax Rates** (new menu item, `Funcionalidade` of type NAVEGAVEL — same pattern as US-114/US-116).

This US covers **read-only** operations (list/filter/export). Creation, editing, and deletion are covered by US-124/125/126.

Schema prerequisite (see ADR-038, [[adr038_aliquota_imposto_vinculo_conta]]): `AliquotaImpostoParametro` needs to gain the fields `ativo`, `dataFimVigencia`, `limiteMinimoPct`, `limiteMaximoPct`, `observacao`, `contaSinteticaId` (nullable), and `version` (Optimistic Locking) before this US can be coded — the migration is shared with US-124/125/126, not repeated in each one.

### Acceptance Criteria

**Scenario 1 — Listing without filter**
```gherkin
Given there are 3 registered tax rates (PIS, COFINS, ISS)
When the user accesses Registrations > Tax Rates and clicks [Search] without filling in any filters
Then the grid displays the 3 tax rates with the columns: Name, Rate (%), Incidence Type, Start Date, End Date, Status, Actions
And the [New] button is displayed for profiles with write permission
```

**Scenario 2 — Combined filter**
```gherkin
Given there are tax rates with incidence types CONTRATO and TERMO_DE_PARCERIA
When the user filters by Incidence Type = "Partnership Agreement" and Status = "Active"
Then the grid displays only active tax rates with tipoIncidencia = TERMO_DE_PARCERIA or AMBOS
```

**Scenario 3 — Search with no results**
```gherkin
Given no tax rate matches the informed filters
When the user clicks [Search]
Then the system displays "No tax rate found for the informed filters."
And the grid is rendered empty
And the [New] button remains active
```

**Scenario 4 — Calculated "Expired" status**
```gherkin
Given a tax rate has dataFimVigencia < the server's current date
When the grid is rendered
Then that tax rate is displayed with Status "Expired" (a badge visually distinct from Active/Inactive), even if ativo = TRUE
```

**Scenario 5 — Row-level conditional actions**
```gherkin
Given the "ISS" tax rate is referenced in RateioImpostoGrade with ativo = TRUE in a non-frozen Proposal
And the "COFINS" tax rate has no active reference
When the grid is rendered
Then the [Delete] button on the "ISS" row is displayed disabled
And the [Delete] button on the "COFINS" row is displayed enabled
And the [Edit] button is displayed enabled on both rows
```

**Scenario 6 — Export listing**
```gherkin
Given the grid is rendered with the filter Incidence Type = "Contract" applied
When the user clicks [Export]
Then the system generates PDF and XLSX with the applied filters stamped in the document header [RN0011]
And reuses the `src/lib/export/exportarRelatorio.ts` utility (ADR-037), without introducing a new export library
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | Reads `AliquotaImpostoParametro` and `RateioImpostoGrade` (to compute the availability of the Delete button); no writes |
| Fields changed | None (read-only US) |
| Transaction? | No |
| Requires lock? | No |
| Audit trail | RN0232 — every filtered listing writes an asynchronous log entry in `HistoricoOperacao` with a snapshot of the filters |
| Business rule | RN_IMP_001 (2-decimal-place formatting), RN_IMP_002 (status badge), RN_IMP_003 (calculated Expired status), RN_IMP_004 (Delete conditional) |

### Dependencies

- **ADR-038**: the new schema fields (`ativo`, `dataFimVigencia`, `limiteMinimoPct`, `limiteMaximoPct`, `observacao`, `contaSinteticaId`, `version`) must exist before this US.
- **US-124 (Register)**: provides the [New] button referenced in Scenario 1.
- New NAVEGAVEL `Funcionalidade` `cadastros.aliquotas-impostos.visualizar` to be seeded.

### Definition of Done

- [ ] Acceptance criteria 1 to 6 implemented and tested
- [ ] Schema migration (ADR-038) applied before this US's code
- [ ] Audit log (RN0232) generated on every filtered search
- [ ] Tested with an empty database (Scenario 3)
- [ ] Tested with an expired tax rate (Scenario 4)
- [ ] PDF/XLSX export reusing `exportarRelatorio.ts`, with no new library
