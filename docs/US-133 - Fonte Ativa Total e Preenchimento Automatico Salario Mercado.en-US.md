## [US-133] — Expanded Active Source (Total) + Auto-fill via Salary Table

**Module:** Registrations — Positions and Salaries (UC03.19, Block B/section 5.2 of the Jun/2026 Rev.)
**Epic:** EP118/24
**Priority:** High
**Estimate:** P

**As a** GRH User,
**I want** to choose "Total" as Active Source (in addition to Minimum/Maximum/Actual) and auto-fill the Position's Min/Max Salary from a Salary Table range (US-131),
**So that** I have more flexibility in the budgetary calculation base and don't need to type from memory values that already exist in the registered market research.

### Context and Business Rules

Source document: section 4.2 (Active Source), section 5.2 (Lookup Behavior), RN_TAB_04/05. The
current `FonteAtivaSalario` enum only has `MERCADO_MINIMO`/`MERCADO_MAXIMO`/`RUBI` — it is missing the
`TOTAL` value (Min or Max Salary + Gratified Position Allowance) that the document requests as a 4th
option.

**Auto-fill (RN_TAB_04):** when selecting a range in the Salary Table (US-131, Scenario 5), the
system copies `salarioMinimo`/`salarioMaximo` into `Cargo.salarioMercadoMinimo`/`salarioMercadoMaximo`
and records the origin as `TABELA_SALARIAL`. The fields remain editable afterward — a manual edit
changes the origin to `MANUAL` (RN_TAB_05). The origin is recorded in the Official Snapshot (see
US-134).

### Acceptance Criteria

**Scenario 1 — Fill Min/Max Salary from the Salary Table**
```gherkin
Given the user is on the Positions screen, registering "Systems Analyst"
And the Salary Table has a Senior record with Min=6500.00/Max=9200.00
When the user opens "Salary Table" and selects the Senior record
Then the system copies salarioMercadoMinimo=6500.00 and salarioMercadoMaximo=9200.00 to the Position
And displays the indicator "Filled via Salary Table — Systems Analyst / Senior"
And records origemSalarioMin=TABELA_SALARIAL, origemSalarioMax=TABELA_SALARIAL
```

**Scenario 2 — Manual edit after auto-fill changes the origin**
```gherkin
Given the Position had its Minimum Salary filled via the Salary Table (Scenario 1)
When the user manually edits the Minimum Salary field to a different value
Then the system updates the indicator to "Manually edited"
And records origemSalarioMin=MANUAL
And origemSalarioMax remains TABELA_SALARIAL (independent per field)
```

**Scenario 3 — Select Active Source = Total**
```gherkin
Given the Position has Minimum Salary=6500.00, Gratified Position Allowance=800.00
When the user selects Active Source = "Total"
Then the system calculates Total Salary = Min or Max Salary (as already configured) + Gratified Position Allowance
And uses that value as the base for the charges calculation (see GAP-CAR-004, US not yet written)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `Cargo` — new enum value `FonteAtivaSalario.TOTAL`; 2 new fields `origemSalarioMin`/`origemSalarioMax` (enum `TABELA_SALARIAL`\|`MANUAL`) |
| Migration | `ALTER TYPE "FonteAtivaSalario" ADD VALUE 'TOTAL'` — apply **before** any code deploy that writes this value (same risk ordering already recorded in ADR-034); + new origin columns |
| Transaction? | No — auto-fill is just a copy of 2 numeric fields + 2 origin fields, in the same Position update |
| Audit trail | Origin recorded in the Position's own fields; reflected in the Official Snapshot (US-134) |
| Business rule | `calcularSalarioTotalCargo` (already exists, US-107) needs to accept the new `FonteAtivaSalario.TOTAL` case |

### Dependencies

- US-131 (Salary Table) — source of the copied data
- US-134 (Snapshot) — persists the origin in the cost DNA

### Definition of Done

- [ ] Active Source = Total implemented and calculating correctly
- [ ] Auto-fill with origin indicator tested
- [ ] Manual edit after auto-fill correctly changes the origin, field by field (Min and Max are independent)
- [ ] Enum migration applied before deploying the consumer code
