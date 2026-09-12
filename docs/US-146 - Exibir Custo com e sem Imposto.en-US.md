# US-146 — Display "Cost" and "Cost with Taxes" Side by Side

**Module:** Budget — Budget Traffic Light / Proposal Dashboard
**Epic:** Automatic Application of Taxes on Accounts
**Priority:** Medium
**Estimate:** M
**Status:** 🔜 Depends on US-144
**ADR:** ADR-050 (Front F)

**As a** Budget Analyst, GFIN, or Auditor,
**I want** to see, for each account, the **gross cost** (personnel + trips + assets) and the
**cost with taxes** separately,
**So that** I can understand how much of the account's amount is direct expense and how much is
tax burden, without having to open the fiscal calculation memory.

---

## Context and Business Rules

Today `ValorRealizadoService` **already sums** `RateioImpostoGrade.valorDeclarado` together with
Employee/Trip/Asset — in other words, the `valorRealizado` that feeds the Traffic Light (US-008a),
the Budgeted Amount tab dashboard (US-118), and the "Disbursement" column of the Schedule
**already includes tax**. What's missing is **showing the number without tax alongside it**, to
give visibility into the tax burden.

### RN_TAX_17 — Two amounts per account (ADR-050 Front F)

For each account, the system now exposes:
- **Cost** (`valorRealizadoSemImposto`) = Employee + Trip + ItemPatrimonial assigned to the
  account (for a synthetic account: sum of the descendant analytical accounts). **Does not
  include** any `RateioImpostoGrade`.
- **Cost with Taxes** (`valorRealizado`, the number that already exists today) = Cost + all
  active `RateioImpostoGrade` rows for the account (`DECLARADO` + `CALCULADO`), including a
  direct tax on a synthetic account (US-145).

### RN_TAX_18 — What each amount drives (behavior preserved)

- The **Traffic Light's percentage and color** (RN0252 of the Traffic Light / ADR-032) continue
  to be calculated on **"Cost with Taxes"** vs. Budgeted Amount — **no rule change**. US-008a /
  ADR-032 are not reopened.
- The **Proposal's Global Amount** continues to be the total **with taxes** — tax is a real cost
  that goes into the Global Amount.
- **"Cost" (without tax)** is **purely informational** — it does not drive the Traffic Light, the
  Global Amount, or the Schedule.

### RN_TAX_19 — Where the two amounts appear

| Location | How |
|---|---|
| **Traffic Light Badge** (`/plano-contas/[versaoId]`, US-008a) | 2 numbers per account: "Cost" and "Cost w/ Taxes". The bar/color follows "w/ Taxes". |
| **"Budgeted Amount" tab / dashboard** (US-118) | 2 columns in the account tree: "Cost" and "Cost w/ Taxes". The synthetic totals show both. |
| **"Enter Budgeted Amount" tab** | No change — it's manual entry of the budgeted amount, not the actual amount. |
| **Disbursement Schedule** (US-142) | Out of scope for this US — the Schedule uses only the "with taxes" amount today; revisit if the user requests the separation there too. |

---

## Acceptance Criteria

**Scenario 1 — Traffic Light Badge shows both amounts**
```gherkin
Given the analytical account "3.1.01 - Personnel" has a gross cost of R$ 200,000.00
And it has taxes generated (PIS R$ 18,500.00) totaling R$ 218,500.00
And the account's budgeted amount is R$ 210,000.00
When the user opens the Version's Budget Traffic Light Badge
Then account "3.1.01" displays "Cost: R$ 200,000.00" and "Cost w/ Taxes: R$ 218,500.00"
And the Traffic Light percentage is calculated as 218,500 / 210,000 = 104.05% (with tax, RN_TAX_18)
And the color reflects that percentage (same rule as today)
```

**Scenario 2 — Budgeted Amount tab dashboard with two columns**
```gherkin
Given the Proposal has accounts with and without taxes generated
When the user opens the "Budgeted Amount" tab (summary dashboard, US-118)
Then the account tree shows, per row, the columns "Cost" and "Cost w/ Taxes"
And each synthetic account totals both columns (Σ of the children)
And the Global Amount shown at the top is the "w/ Taxes" total
```

**Scenario 3 — Account with no tax at all: both amounts are equal**
```gherkin
Given the account "3.1.09 - Reserve" has no active RateioImpostoGrade
When the amounts are displayed
Then "Cost" and "Cost w/ Taxes" show the same number
And no tax note or highlight appears for that account
```

**Scenario 4 — Synthetic account with a direct tax (integrates US-145)**
```gherkin
Given the synthetic account "3.1 - Operating Costs" has a direct tax of R$ 9,000.00 (US-145)
When the amounts are displayed
Then the synthetic account's "Cost" = gross sum of the children (without the direct tax)
And the synthetic account's "Cost w/ Taxes" = sum of the children + the children's taxes + the direct tax of R$ 9,000.00
And the RN_TAX_16 note ("tax applied directly...") appears alongside it
```

**Scenario 5 — The Traffic Light percentage rule does not change**
```gherkin
Given that before this US an account's Traffic Light showed 104.05% (it already included the manual tax allocation)
When this US goes to production without any new tax being generated
Then the account's percentage and color remain exactly 104.05% and the same color
And only the "Cost" number (without tax) starts being displayed in addition
```

---

## Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | None (read-only) |
| Migration | None |
| Domain | `ValorRealizadoService` — expose `somarCustoBrutoPorConta` (already created in US-144) + the current `somarPorContaAnalitica` (with tax). `CalcularValorRealizadoUseCase` returns both amounts per account. |
| Serialized type | `BadgeSemaforoConta` +`valorRealizadoSemImposto: string`; likewise for the US-118 dashboard's serialized type. Propagate through to the React components (`BadgeSemaforoPanel`, `ValorOrcadoResumoPanel`). |
| UI | Traffic Light Badge: 2 value lines per account. US-118 dashboard: 2 columns. No inline CSS — Tailwind. Empty/error states preserved. |
| Business rule | Traffic Light % and color and Global Amount **unchanged** (still follow "with tax"). "Cost" is display-only. |
| Audit | None (read operation) |

---

## Dependencies

- **US-144** — "Cost without tax" (`somarCustoBrutoPorConta`) originates there.
- **US-145** (optional for scenario 4) — direct tax on a synthetic account.
- **ADR-050** Front F.
- US-008a / US-118 / ADR-032 — consuming screens.

## Definition of Done

- [ ] Scenarios 1 through 5 implemented and approved in staging
- [ ] `BadgeSemaforoConta` exposes `valorRealizadoSemImposto`; propagated through to the UI
- [ ] Traffic Light Badge and US-118 dashboard show "Cost" and "Cost w/ Taxes"
- [ ] Traffic Light percentage, color, and Global Amount **unchanged** — regression test (Scenario 5)
- [ ] Account with no tax: both amounts equal, no visual noise
- [ ] Synthetic account with a direct tax integrates the US-145 note
- [ ] No schema change, no migration
