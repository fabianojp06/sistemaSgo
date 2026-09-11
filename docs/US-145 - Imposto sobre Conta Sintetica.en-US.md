# US-145 — Tax on a Synthetic Account

**Module:** Budget / Registrations — Tax Allocation
**Epic:** Automatic Application of Taxes on Accounts
**Priority:** High
**Estimate:** M
**Status:** 🔜 Depends on US-144 (engine on analytical accounts) being delivered
**ADR:** ADR-050 (Front B)

**As a** Budget Analyst or Financial Manager (GFIN),
**I want** to be able to apply a tax **directly on a synthetic account** (which consolidates
several analytical accounts), not only on the leaves,
**So that** I can represent taxes that apply to an expense group as a whole, without having to
post a row on each child analytical account one by one.

---

## Context and Business Rules

Today `RateioImpostoGrade.contaId` is **mandatorily analytical** (ADR-027,
`ContaRateioImpostoNaoAnaliticaError`). The user wants to also be able to choose a **synthetic**
account. `CalcularValorRealizadoUseCase` aggregates **bottom-up**: it sums the analytical
accounts' cost and propagates it to the synthetic accounts, assuming the invariant **"synthetic =
pure sum of the children."**

### RN_TAX_14 — Synthetic account as a tax target (ADR-050 Front B / C1)

- `RateioImpostoGrade.contaId` now accepts an **analytical or synthetic** account (existing,
  active, belonging to the tenant). The `ContaRateioImpostoNaoAnaliticaError` error is replaced
  by `ContaRateioImpostoInvalidaError` ("account not found or inactive").
- In the actual-amount calculation, **after** the bottom-up aggregation (analytical →
  synthetic), the system sums the `RateioImpostoGrade` rows whose `contaId` is **synthetic**
  **directly into that synthetic account's aggregated amount** (decision C1 — "the synthetic
  account's own adjustment").
- **Accepted consequence:** for a synthetic account with a direct tax, the total **stops being
  the pure sum of the child analytical accounts** — it becomes `Σ children + direct taxes on it`.

### RN_TAX_15 — Base of the tax on a synthetic account (US-144, when `categoria=TRIBUTO` and automatic calculation)

When the pair `(rate TRIBUTO × synthetic account)` enters "Generate Taxes for the Version":
- **Base** = the synthetic account's aggregated gross cost = the sum of the gross cost
  (Employee+Trip+Asset) of **all its descendant analytical accounts**, excluding any
  `RateioImpostoGrade`.
- `imposto = base × rate%`, recorded as 1 `CALCULADO` row with `contaId` = the synthetic account.

### RN_TAX_16 — Flagging the broken invariant

When an account (synthetic) has at least one active `RateioImpostoGrade` row with `contaId` =
itself:
- That account's `BadgeSemaforoConta` gains the flag **`temImpostoDireto = true`**.
- The screen / dashboard display, next to the account's amount, the note: **"This account has a
  tax applied directly on it — the total is not the pure sum of the analytical accounts."**
- This is **distinct** from the `parcial` flag (which signals incomplete cost-source coverage,
  US-008a) — the two can coexist and have different meanings.

### Rules inherited from US-144

Freezing after OFICIALIZADO (RN_TAX_03/06), Partnership Agreement immunity (RN_PRO_010), no
cascading (RN_TAX_11), only `categoria = TRIBUTO` — **all apply equally** to a tax on a
synthetic account.

---

## Acceptance Criteria

**Scenario 1 — Apply an automatic tax on a synthetic account**
```gherkin
Given the synthetic account "3.1 - Operating Costs" consolidates the analytical accounts "3.1.01 - Personnel" (R$ 200,000.00) and "3.1.02 - Services" (R$ 100,000.00)
And the rate "ISS" (categoria TRIBUTO, 3.00%) applies to "3.1 - Operating Costs"
And the Version is in RASCUNHO status
When the user triggers [Generate Taxes for the Version]
Then 1 RateioImpostoGrade row is created with contaId = "3.1 - Operating Costs" (synthetic), modoValor = CALCULADO, valorBaseSnapshot = 300,000.00 and valorDeclarado = 9,000.00
And the actual amount of "3.1 - Operating Costs" becomes R$ 309,000.00 (sum of the children + the direct tax)
And the BadgeSemaforoConta of "3.1 - Operating Costs" has temImpostoDireto = true
And the screen displays the note "This account has a tax applied directly on it — the total is not the pure sum of the analytical accounts."
```

**Scenario 2 — A tax on the synthetic account does NOT change the child analytical accounts**
```gherkin
Given there is a direct tax of R$ 9,000.00 on the synthetic account "3.1 - Operating Costs"
When the actual amount is calculated
Then "3.1.01 - Personnel" remains at R$ 200,000.00 and "3.1.02 - Services" at R$ 100,000.00 (unchanged)
And only the synthetic account "3.1 - Operating Costs" reflects the tax increase
```

**Scenario 3 — Synthetic account with a direct tax AND taxes on the children**
```gherkin
Given "3.1.01 - Personnel" has a PIS tax of R$ 18,500.00 (row on the analytical account)
And "3.1 - Operating Costs" has an ISS tax of R$ 9,000.00 (row on the synthetic account)
When the actual amount of "3.1 - Operating Costs" is calculated
Then the total is R$ 318,500.00 + R$ 9,000.00 = R$ 327,500.00
  (Σ children with their taxes = 200,000 + 18,500 + 100,000 = 318,500; + the synthetic account's direct tax = 9,000)
And temImpostoDireto = true for "3.1 - Operating Costs"
```

**Scenario 4 — Nonexistent or inactive account (ContaRateioImpostoInvalidaError)**
```gherkin
Given the user (or a direct backend call) provides an accountId that does not exist in the tenant or is inactive
When they try to configure/generate the tax allocation for that account
Then the system rejects it with "Account not found or inactive."
And no RateioImpostoGrade row is created
```

**Scenario 5 — Freezing after OFICIALIZADO (inherited)**
```gherkin
Given the Version is OFICIALIZADO and there are taxes on the synthetic account "3.1 - Operating Costs"
When the user tries to regenerate or change the synthetic account's tax
Then the backend rejects it with "Operation Denied [ERROR LOCK]: ... fiscal data is frozen ..."
And the CALCULADO rows on the synthetic account remain as a snapshot
```

**Scenario 6 — Rule from US-124 on accounting analysis (refinement note)**
```gherkin
Given decision C1 breaks the "synthetic = sum of the children" invariant
When the amount of a synthetic account with a direct tax is displayed in any report (Traffic Light, US-118 dashboard, Disbursement Schedule)
Then the displayed number is the adjusted amount (with the direct tax), always accompanied by the RN_TAX_16 note
```

---

## Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `RateioImpostoGrade` (`contaId` no longer requires `isAnalitica`); reads `ContaContabil` (hierarchy) |
| Migration | **None** beyond the one from US-144 — the analytical validation is application-level, not a database CHECK |
| Domain | `ValorRealizadoService` — new function `aplicarImpostosPorConta(mapaBruto, rateios, hierarquia)` called **after** the bottom-up pass; refactor `CalcularValorRealizadoUseCase` for the new phase |
| Errors | `ContaRateioImpostoNaoAnaliticaError` → `ContaRateioImpostoInvalidaError` (rename, update calls in `ConfigurarRateioImpostoUseCase` and `prepararPlanoReajuste` — note: **the adjustment flow still requires an analytical account**, so there the `isAnalitica` validation **remains**, only the name/usage changes in the tax flow) |
| Serialized type | `BadgeSemaforoConta` +`temImpostoDireto: boolean`; propagate through to the Traffic Light component and the dashboard |
| Business rule | Only a synthetic `contaId` changes the calculation phase; inherits all rules from US-144 |
| Audit | Same as US-144 (`IMPOSTOS_GERADOS`), with `contaTipo: 'SINTETICA' \| 'ANALITICA'` per row |

---

## Dependencies

- **US-144** — the automatic calculation engine (analytical) must be delivered.
- **ADR-050** Front B.
- **Attention:** `prepararPlanoReajuste` (US-128/129) validates `isAnalitica` for the
  **adjustment** flow — that validation **must not** be removed; only the tax flow now accepts a
  synthetic account.

## Definition of Done

- [ ] Scenarios 1 through 6 implemented and approved in staging
- [ ] `RateioImpostoGrade.contaId` accepts a synthetic account in the tax flow; the adjustment flow remains analytical-only
- [ ] Tax on a synthetic account applied **after** the bottom-up pass, directly on the aggregated amount (C1)
- [ ] Child analytical accounts demonstrably unchanged by a tax on the synthetic account — test
- [ ] `temImpostoDireto` on `BadgeSemaforoConta` + note displayed wherever the synthetic account's amount appears
- [ ] `parcial` and `temImpostoDireto` coexist without being confused — test
- [ ] Freezing and Partnership Agreement immunity inherited and tested for synthetic accounts too
- [ ] `HistoricoOperacao` distinguishes `contaTipo` SINTETICA/ANALITICA
- [ ] The adjustment engine does not regress
