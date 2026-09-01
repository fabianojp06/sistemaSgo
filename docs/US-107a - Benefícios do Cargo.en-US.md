## [US-107a] — Cargo Benefits and Payroll Charges Master Table

**Module:** Registrations — Cargo and Salary (Master Table)
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As an** HR Manager (GRH),
**I want** to configure a Cargo's Payroll Charges and Benefits checklist (VA, VR, Health, Dental, Life, Daycare), with the total cost calculated automatically,
**So that** the real cost of a headcount (salary + payroll charges + benefits) is always auditable and never entered as a loose number.

### Context and Business Rules

This US covers block C ("Subscreen: Benefits and Payroll Charges Management") of UC03.19 in Draft Spec V5 — the part left out of scope when US-107 was refined.

**Documentation quality finding (correction of an earlier mistake of mine):** I had associated this US with UC03.28 in the Draft Spec. That is wrong — **UC03.28 ("Benefits") describes the Employee's Individual Eligibility** (the same content as the UC03.24 modal, Alternative Flow A1), which is the scope of **US-108a**, not this one. The Cargo Benefits Master Table (what this US actually covers) **has no numbered UC of its own in Draft Spec V5** — it is embedded as an unnumbered block inside UC03.19 itself. Recorded so as not to confuse this again: UC03.28 = US-108a; block C of UC03.19 (unnumbered) = US-107a.

Decisions closed with the user for this US:

1. **New field `Cargo.custoTotalCargo`**, calculated = `salarioTotal` (already existing, US-107) + Payroll Charges + sum of active Benefits. `Cargo.salarioTotal` **does not change meaning** — it remains just salary + gratified function, as defined in ADR-016. `custoTotalCargo` is the Cargo's new "full cost".
2. **`EmpregadoHeadcount.custoTotalMensal` (US-108, ADR-018) now inherits `custoTotalCargo` instead of `salarioTotal`**, starting with this US — a targeted adjustment in the Cargo→Empregado use case, without changing the frozen-snapshot design already decided in ADR-018.
3. **No global Benefits/Payroll Charges parameter table.** The Payroll Charges percentage and the VA/VR/Health/Dental/Life/Daycare values are **entered directly on each Cargo** — there is no central "Parameters Master Table" from which values are inherited. This diverges from a literal reading of the Draft Spec ("default percentage configured in Parameters"), but avoids building an entire Parameters module for this US.
4. **Exception: "Business Days" is parameterized per tenant**, not entered per Cargo — it reuses the already-existing `ParametroSistema` model (`tenantId @id, limiteTentativasLogin, flagManutencao`), adding a `diasUteisPadrao` field (Int, default 22). Used in the VA/VR formula (`valorUnitario × diasUteisPadrao`).
5. **RN_CAR_06 (retroactive-change alert when a benefit is deactivated) is out of scope** — it requires a cross-module notification mechanism that does not exist yet. Revisit when there is a real use case for changing a Cargo already linked to Empregados.

### Acceptance Criteria

**Scenario 1 — Configure a Cargo's Payroll Charges and Benefits, with total cost calculated**
```gherkin
Given Cargo "CARGO-2026-0001" has salarioTotal = 6200.00 (already existing)
And the tenant's diasUteisPadrao parameter is 22
When the user configures on the Cargo:
  | Payroll Charges (%) | 68.00                  |
  | Food Voucher (VA)    | active, unitValue=30.00 |
  | Meal Voucher (VR)     | active, unitValue=25.00 |
  | Health Plan          | active, tier=INTERMEDIARIO, value=450.00 |
  | Dental Plan          | inactive                |
  | Life Insurance       | active, value=40.00     |
  | Daycare Assistance   | inactive                |
Then the system calculates:
  - Payroll Charges = 6200.00 × 68% = 4216.00
  - VA = 30.00 × 22 = 660.00
  - VR = 25.00 × 22 = 550.00
  - Total Benefits = 660.00 + 550.00 + 450.00 + 40.00 = 1700.00
  - custoTotalCargo = 6200.00 + 4216.00 + 1700.00 = 12116.00
And custoTotalCargo is persisted as read-only (calculated, never entered directly) [SHIELDED ORIGIN]
And a `CARGO_BENEFICIOS_CONFIGURADOS` audit record is written to HistoricoOperacao
```

**Scenario 2 — An inactive benefit is not included in the calculation**
```gherkin
Given the Dental Plan and the Daycare Assistance are marked as inactive on the Cargo
When the system calculates the Total Benefits
Then the values of these two items are not summed, even if they have a unitValue filled in
```

**Scenario 3 — Blocked: Payroll Charges outside the 0-100% range**
```gherkin
Given the user is configuring a Cargo's Payroll Charges
When they try to save a percentage of 150%
Then the system blocks the save
And displays the message "The Payroll Charges percentage must be between 0 and 100."
```

**Scenario 4 — Blocked: negative value on any benefit**
```gherkin
Given the user is configuring a Cargo's Food Voucher
When they try to save with unitValue = -10.00
Then the system blocks the save
And displays the message "Benefit values cannot be negative."
```

**Scenario 5 — A change automatically recalculates custoTotalCargo**
```gherkin
Given the Cargo already has Payroll Charges/Benefits configured, with custoTotalCargo = 12116.00
When the user changes the Payroll Charges percentage to 70%
Then the system recalculates custoTotalCargo with the new percentage
And a `CARGO_BENEFICIOS_EDITADOS` audit record is written with the previous and new value
```

**Scenario 6 — Blocked: attempt to manually edit custoTotalCargo [HARD ERROR]**
```gherkin
Given a Cargo already has custoTotalCargo = 12116.00 (calculated)
When the user tries to submit a different value directly for custoTotalCargo
Then the system ignores the received value for that field
And recalculates custoTotalCargo from its components (salarioTotal + payroll charges + benefits)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables/fields affected | `Cargo`: new fields `encargosSociaisPct` (Decimal 5,2), `vaAtivo`/`vaValorUnitario`, `vrAtivo`/`vrValorUnitario`, `planoSaudeAtivo`/`planoSaudeFaixa`(enum)/`planoSaudeValor`, `planoOdontoAtivo`/`planoOdontoValor`, `seguroVidaAtivo`/`seguroVidaValor`, `auxilioCrecheAtivo`/`auxilioCrecheValor`, `custoTotalCargo` (Decimal 15,2, calculated). `ParametroSistema`: new field `diasUteisPadrao` (Int, default 22). |
| Transaction? | Yes — `custoTotalCargo` calculation in the same write transaction |
| Requires lock? | No — same transactional simplicity as Cargo/US-107, no relevant concurrency |
| Audit | `CARGO_BENEFICIOS_CONFIGURADOS`, `CARGO_BENEFICIOS_EDITADOS` in HistoricoOperacao |
| Business rule | Payroll Charges percentage between 0-100; benefit values non-negative; VA/VR = unitValue × tenant's diasUteisPadrao; custoTotalCargo always recalculated, never a direct input |

### Dependencies

- **US-107 (Cargo)**: satisfied — this US extends the existing model.
- **US-108 (Empregado)**: needs a targeted adjustment — `EditarEmpregadoUseCase`/`CadastrarEmpregadoUseCase` will now inherit `custoTotalCargo` instead of `salarioTotal`.
- **US-108a (Individual eligibility, UC03.28)**: will consume this Master Table's values as read-only in the Empregado modal — a natural dependency, not rework.

### Definition of Done

- [ ] Acceptance criteria 1 to 6 implemented and tested
- [ ] `custoTotalCargo` always calculated on the backend, never accepted as direct input
- [ ] `CadastrarEmpregadoUseCase`/`EditarEmpregadoUseCase` (US-108) updated to inherit `custoTotalCargo`
- [ ] `diasUteisPadrao` added to `ParametroSistema`, with default value 22
- [ ] Tested with an inactive benefit (must not enter the sum)
- [ ] Tested with a payroll-charges percentage outside the range (must block)
- [ ] Tested with an attempted manual edit of custoTotalCargo (must be ignored)
