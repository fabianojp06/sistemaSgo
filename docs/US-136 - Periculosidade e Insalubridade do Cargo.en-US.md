## [US-136] — Position Hazard and Unhealthy-Work Pay

**Module:** Registrations — Positions and Salaries (Benefits and Payroll Charges Master Table)
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As an** HR Manager (GRH),
**I want** to record Hazard Pay and Unhealthy-Work Pay for a Position, each as either a percentage of the salary or a fixed R$ amount,
**So that** the headcount's real cost reflects these add-ons without requiring a parallel spreadsheet outside the system.

### Context and Business Rules

User request on 2026-08-14: two new fields in the Position's Payroll Charges and Benefits block
(`CargoPanel.tsx`), alongside Food Voucher/Meal Voucher/Health Plan/Dental Plan/Life Insurance/Daycare
Assistance/Transportation Voucher (US-107a, ADR-019/020).

**Decision already closed with the user (via a clarifying question):** each field — Hazard Pay
and Unhealthy-Work Pay — has a **single choice of input type per entry**: percentage (applied
to the salary) OR a fixed R$ amount, never both at once for the same field. Same pattern
already used in `Cargo.origemSalarioMinimo`/`origemSalarioMaximo` (enum `OrigemSalarioMercado`:
`MANUAL` vs. `TABELA_SALARIAL`) — here the enum would be something like `TipoValorAdicional`:
`PERCENTUAL` vs. `VALOR_FIXO`.

**Deliberate note on legal context (not locked into the code):** under Brazilian labor law (CLT),
Hazard Pay is typically 30% of the base salary and Unhealthy-Work Pay is 10/20/40% of the
minimum wage (low/medium/high grade), depending on a technical report (NR-15/16). SGO 2.0 also
serves OSCIPs with a Partnership Agreement, which may have their own personnel policy not
identical to the CLT — for this reason, this document **does not assume these percentages as a
system rule**; the user types whatever percentage or amount they judge applicable to the
Position. If it becomes necessary in the future to lock in the legal percentages as a suggestion
or validation, that is a separate US.

**Decisions that have NOT yet been made and need to go to the Tech Lead (`techlead-fsg`) before
implementation — this document intentionally does not resolve them on its own, since they touch
the Position's cost calculation, which is already audited and tested (US-107a):**

1. **Calculation base for the percentage.** Applied over `salarioTotal` (salary + gratified
   function allowance, ADR-016) or over a stricter "base salary"? Today the Position does not
   distinguish the two — `salarioTotal` is the only calculated salary field.
2. **Do they enter `custoTotalCargo`?** US-107a defined `custoTotalCargo = salarioTotal +
   Payroll Charges + Benefits`. Are Hazard Pay/Unhealthy-Work Pay a salary add-on (which should
   compose `salarioTotal` before Payroll Charges are applied on top of it) or an additional
   benefit (added afterward, like Food/Meal Voucher)? This changes the calculated Payroll Charges
   value, because today it is levied on `salarioTotal`.
3. **Its own analytical accounting account**, like the 9 existing cost components (ADR-029:
   `contaGratificacaoId`, `contaEncargosSociaisId`, etc.) — or do they go without their own
   account?
4. **Cumulativeness.** Can the same Position have both Hazard Pay AND Unhealthy-Work Pay active
   at the same time (legally the CLT usually forbids cumulation, requiring the choice of the more
   favorable one), or does the system allow both active simultaneously with no cross-validation?
   The user's request does not mention exclusivity between the two fields, only the input type
   within each field.
5. **Exact field names in the schema** — suggestion: `periculosidadeAtivo`/`periculosidadeTipo`
   (enum)/`periculosidadeValor` (Decimal, percentage OR R$ depending on the type), and the same
   pattern for `insalubridade*`, following the `*Ativo`/`*Valor` convention already used for
   Food/Meal Voucher/etc.
6. **Retroactivity over existing Positions.** Positions already registered are left with both
   fields inactive by default (with no impact on the already-calculated `custoTotalCargo`),
   correct?

### Acceptance Criteria

The scenarios below assume the decisions above are **still not closed** — they serve to validate
the functional design with the user; the `custoTotalCargo` values in the examples are marked
`[TO BE DEFINED BY THE TECH LEAD]` where they depend on decision #2.

**Scenario 1 — Configure Hazard Pay as a percentage of the salary**
```gherkin
Given Position "CARGO-2026-0001" has salarioTotal = 6200.00
When the user activates Hazard Pay, chooses type "Percentage" and enters 30.00
Then the system calculates the Hazard Pay value = 6200.00 × 30% = 1860.00
And stores the chosen type (PERCENTUAL) and the entered percentage (30.00)
And [TO BE DEFINED BY THE TECH LEAD] whether this value is included in the custoTotalCargo recalculation
```

**Scenario 2 — Configure Unhealthy-Work Pay as a fixed R$ amount**
```gherkin
Given Position "CARGO-2026-0002" is being configured
When the user activates Unhealthy-Work Pay, chooses type "Fixed Amount" and enters 250.00
Then the system stores the Unhealthy-Work Pay value = 250.00, without applying a percentage over the salary
And stores the chosen type (VALOR_FIXO)
```

**Scenario 3 — Blocked: percentage outside the 0-100% range**
```gherkin
Given the user chose type "Percentage" for Hazard Pay
When they try to save with 150.00
Then the system blocks the save
And displays the message "The Hazard Pay percentage must be between 0 and 100."
```
(Same rule for Unhealthy-Work Pay, same message with the field name swapped.)

**Scenario 4 — Blocked: negative value on any type**
```gherkin
Given the user is configuring Hazard Pay or Unhealthy-Work Pay, in either type (% or R$)
When they try to save with a negative value
Then the system blocks the save
And displays the message "Hazard Pay/Unhealthy-Work Pay values cannot be negative."
```

**Scenario 5 — Switching the input type clears the previous value**
```gherkin
Given Hazard Pay is configured as Percentage = 30.00
When the user switches the type to "Fixed Amount"
Then the value field is reset (it does not mistakenly reinterpret 30.00 as R$ 30.00)
And the user must enter the new fixed amount before saving
```

**Scenario 6 — An inactive benefit does not enter any calculation**
```gherkin
Given Hazard Pay is deactivated on the Position
When the system calculates custoTotalCargo (or the equivalent field defined by the Tech Lead)
Then the Hazard Pay value is not summed, even if it still has a value/percentage filled in from a previous configuration
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables/fields affected | `Cargo`: new fields, naming and types **to be confirmed with the Tech Lead** (see decision #5) — provisionally `periculosidadeAtivo` (Boolean), `periculosidadeTipo` (enum `TipoValorAdicional`), `periculosidadeValor` (Decimal 15,2 — percentage 0-100 or R$ depending on the type), and the same trio for `insalubridade*` |
| Transaction? | Yes — same Position write transaction, same pattern as US-107a |
| Requires lock? | No — no relevant concurrency, same reasoning as US-107a |
| Audit | Reuse `CARGO_BENEFICIOS_CONFIGURADOS`/`CARGO_BENEFICIOS_EDITADOS` (HistoricoOperacao) or create a dedicated event — **Tech Lead's decision** |
| Business rule | Percentage between 0-100 when type=PERCENTUAL; non-negative value in any type; switching the type resets the value; see open decisions #1, #2, #4 before coding the calculation |

### Dependencies

- **US-107a (Position Benefits, ADR-019)**: this US extends the same block and reuses its
  `*Ativo`/`*Valor` field pattern.
- **Tech Lead ADR**: blocking — the 6 decisions above need an ADR before `fullstack-dev` starts
  implementation (same flow already used in this module's earlier US: refinement → ADR → code).

### Definition of Done

- [ ] Tech Lead ADR resolving the 6 open decisions
- [ ] Acceptance criteria 1 to 6 implemented and tested
- [ ] Tested with a percentage outside the 0-100 range (must block)
- [ ] Tested with a negative value in both types (must block)
- [ ] Tested with an input-type switch (must reset the value, not reinterpret it)
- [ ] Tested with the field inactive (must not enter any calculation)
- [ ] Safe migration (new fields, nullable or with a default, without breaking existing Positions)
