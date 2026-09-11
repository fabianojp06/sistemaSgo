# US-144 — Automatic Tax Calculation Engine (Analytical Account)

**Module:** Budget / Registrations — Tax Allocation
**Epic:** Automatic Application of Taxes on Accounts (`docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md`)
**Priority:** High
**Estimate:** L
**Status:** 🔜 Ready for `fullstack-dev` — **ADR-050 accepted** (all technical decisions closed)
**This is the epic's MVP.**

**As a** Budget Analyst or Financial Manager (GFIN),
**I want** the system to **automatically calculate** the amount of the taxes that apply to the
analytical accounts of a Proposal's Version (`tax = account cost × rate%`), instead of typing
each amount month by month,
**So that** I eliminate the rework and typing-error risk in the tax calculation record, while
keeping the base and the applied rate traceable. [RF_TAX_001, RF_TAX_002, ADR-050]

---

## Context and Business Rules

Today (US-101) Tax Allocation is a **manual declaration**: the user types
`RateioImpostoGrade.valorDeclarado` and the rate is only a historical record
(`aliquotaAplicadaSnapshot`, it never participates in a calculation). This US turns the piece
into a **calculation engine**: the user triggers **"Generate Taxes for the Version"** and the
system calculates and writes the amounts.

### Data model (ADR-050 Front A)

`RateioImpostoGrade` gains:
- `modoValor` enum `DECLARADO | CALCULADO` (default `DECLARADO`).
- `valorBaseSnapshot Decimal(15,2)?` — the base on which the `CALCULADO` tax was applied; `NULL`
  for `DECLARADO` rows.

`AliquotaImpostoParametro` gains:
- `categoria` enum `TRIBUTO | INDICE_REAJUSTE` (default `TRIBUTO`) — separates the catalog of
  taxes (PIS, COFINS, ISS...) from the catalog of adjustment indices (IPCA, collective bargaining
  index...) that share the same table (ADR-040). **Only `TRIBUTO` rates generate a tax.**

The migration is **additive and recalculates nothing** — the current rows become `DECLARADO` and
keep working (full grandfathering, ADR-050 Front E). The adjustment rows (US-128/129) also stay
`DECLARADO` and are **never** touched by the tax engine.

### RN_TAX_10 — Automatic tax calculation

When "Generate Taxes for the Version" is triggered, for **each pair (rate with
`categoria=TRIBUTO` × analytical account)** in scope:

1. **Base** = the account's total gross cost in the Version = the sum of Employee + Trip +
   Asset (`ItemPatrimonial`) assigned to that account, **excluding any `RateioImpostoGrade`**
   (avoids a circular reference — ADR-050 Front C, user decision A1).
2. **`imposto = base × (aliquotaPct / 100)`**, rounded to 2 decimal places (Half-Even).
3. **`competencia`** of the generated row = `Proposta.dataInicio` (consistent with US-101
   Scenario 2 — the applicable rate is the one in effect on the start date).
4. **`aliquotaAplicadaSnapshot`** = the `aliquotaPct` of the `AliquotaImpostoParametro` **in
   effect on `Proposta.dataInicio`**.
5. Writes **1 `RateioImpostoGrade` row** per `(version × rate × account)` with
   `modoValor = CALCULADO`, `valorBaseSnapshot = base`, `valorDeclarado = tax amount`.

### RN_TAX_11 — Two or more taxes on the same account

Each tax is applied to the **same gross base** — **there is no compounding/cascading**. If PIS
9.25% and ISS 3.00% apply to account X with a base of R$ 100,000.00: PIS = R$ 9,250.00, ISS =
R$ 3,000.00, the account's total tax = R$ 12,250.00 (two independent rows). No order of
application, no tie-break rule. [ADR-050 Front A; user decision 4]

### RN_TAX_12 — Replacement of CALCULADO rows, preservation of DECLARADO rows

When generating taxes, the system **soft-deletes** (`ativo = false`) the existing
`modoValor = CALCULADO` rows for the `(rate × account)` pairs being recalculated, and creates the
new ones. It **never** touches `modoValor = DECLARADO` rows — neither manual ones (US-101) nor
adjustment entries (US-128/129). A `(rate × account)` pair that has a manual `DECLARADO` row
**and** comes to have a `CALCULADO` row will have both summed in `ValorRealizadoService`
(accepted behavior — the user decides whether to remove the manual one if desired).

### RN_TAX_03/06 — Freezing (preserved, ADR-050 Front H)

"Generate Taxes" only runs on a Version in `RASCUNHO` or `EM_ELABORACAO` status. In
`OFICIALIZADO`/`ENCERRADO`, it is rejected — the `CALCULADO` rows already recorded become a
definitive snapshot and never recalculate.

### RN_PRO_010 — Partnership Agreement tax immunity (preserved)

When `Proposta.tipo = TERMO_DE_PARCERIA`, the engine **skips** the rates with
`tipoIncidencia = CONTRATO` (PIS, COFINS) — it does not generate a tax for them, either via
calculation or via a direct backend call. Only rates with `tipoIncidencia` `TERMO_DE_PARCERIA`
or `AMBOS` generate a tax (in practice: ISS).

### RN_TAX_13 — Stale-value warning

The screen compares the most recent `updatedAt` among Employee/Trip/Asset/Position of the
Version with the `updatedAt` of the existing `CALCULADO` rows. If the cost sources are more
recent, it displays a non-blocking warning: **"The costs of this Version have changed since the
last tax calculation. Click Generate Taxes to update."**

---

## Acceptance Criteria

**Scenario 1 — Successful automatic generation (Contract)**
```gherkin
Given the user is authenticated with write permission in the budget module
And the Proposal is of type CONTRATO and its current Version is in RASCUNHO status
And the analytical account "3.1.01 - Personnel" has a gross cost of R$ 200,000.00 (Employees + Trips + Assets)
And the tax rate "PIS" exists (categoria TRIBUTO, 9.25%, tipoIncidencia AMBOS) in effect on the Proposal's start date
And account "3.1.01" is linked to that rate in the allocation
When the user triggers [Generate Taxes for the Version]
Then the system creates a RateioImpostoGrade row for (version, PIS, 3.1.01, competencia = dataInicio) with modoValor = CALCULADO, valorBaseSnapshot = 200000.00, aliquotaAplicadaSnapshot = 9.2500 and valorDeclarado = 18,500.00
And the Proposal's Global Amount is recalculated including that tax
And a log is recorded in HistoricoOperacao with tipoOperacao = IMPOSTOS_GERADOS containing the base and tax per row
And the screen displays "Taxes generated: 1 row, R$ 18,500.00"
```

**Scenario 2 — Two taxes on the same account sum without cascading (RN_TAX_11)**
```gherkin
Given the analytical account "3.1.02 - Services" has a gross cost of R$ 100,000.00
And the rates "PIS" (9.25%) and "ISS" (3.00%) apply to it, both categoria TRIBUTO and in effect
When the user triggers [Generate Taxes for the Version]
Then 2 CALCULADO rows are created: PIS with valorDeclarado = 9,250.00 and ISS with valorDeclarado = 3,000.00
And both have valorBaseSnapshot = 100,000.00 (the same gross base)
And account "3.1.02"'s total tax is R$ 12,250.00
```

**Scenario 3 — Regenerating replaces only the CALCULADO rows (RN_TAX_12)**
```gherkin
Given account "3.1.01" already has a CALCULADO row for PIS (base R$ 200,000.00, tax R$ 18,500.00)
And there is also a manual DECLARADO row for ISS on that account (R$ 5,000.00, typed in US-101)
And the account's gross cost rose to R$ 220,000.00 (a new Employee was registered)
When the user triggers [Generate Taxes for the Version] again
Then the previous CALCULADO row for PIS is marked ativo = false
And a new CALCULADO row for PIS is created with base R$ 220,000.00 and tax R$ 20,350.00
And the DECLARADO row for ISS (R$ 5,000.00) remains intact and active
```

**Scenario 4 — Partnership Agreement skips PIS and COFINS (RN_PRO_010)**
```gherkin
Given the Proposal is of type TERMO_DE_PARCERIA
And the rates "PIS" and "COFINS" (tipoIncidencia CONTRATO) and "ISS" (tipoIncidencia AMBOS) exist, all categoria TRIBUTO
When the user triggers [Generate Taxes for the Version]
Then no PIS or COFINS row is created (nor shown as an option)
And only the ISS row is calculated and recorded
And if a direct backend call attempts to generate PIS/COFINS for this Partnership Agreement, the system rejects it with "Partnership Agreements have tax immunity — PIS and COFINS cannot be applied (RN_PRO_010)."
```

**Scenario 5 — A rate with categoria INDICE_REAJUSTE does not generate a tax**
```gherkin
Given the rate "IPCA" exists with categoria = INDICE_REAJUSTE (used by Assumptions/Adjustments, US-128/129)
And it is linked to accounts via RateioImpostoGrade (adjustment rows, modoValor DECLARADO)
When the user triggers [Generate Taxes for the Version]
Then "IPCA" is ignored by the engine — no CALCULADO row is generated for it
And the DECLARADO adjustment rows for IPCA remain intact
```

**Scenario 6 — An Officialized Version blocks generation [ERROR LOCK] (RN_TAX_03)**
```gherkin
Given the Proposal's current Version is in OFICIALIZADO status
When the user triggers [Generate Taxes for the Version]
Then the backend rejects the operation with an immediate rollback
And the system displays: "Operation Denied [ERROR LOCK]: This Proposal is officialized and its fiscal data is frozen. No changes are allowed."
And no RateioImpostoGrade row is created or changed
```

**Scenario 7 — An account with no gross cost generates zero tax (or is skipped)**
```gherkin
Given the analytical account "3.1.09 - Reserve" has no Employee, Trip, or Asset assigned (gross cost = R$ 0.00)
And the rate "ISS" (3.00%) applies to it
When the user triggers [Generate Taxes for the Version]
Then no CALCULADO row is created for (ISS, 3.1.09) — a zero base generates no row
And the operation does not fail because of it
```

**Scenario 8 — No financial data in the Version (Flow E1, preserved from US-122)**
```gherkin
Given the Version has no Employee, Trip, Asset, or linked rate
When the user opens the Tax Allocation screen
Then the [Generate Taxes for the Version] button is displayed disabled
And the system displays "Register costs and link at least one tax before generating taxes."
```

**Scenario 9 — Stale-value warning (RN_TAX_13)**
```gherkin
Given taxes have already been generated for the Version (CALCULADO rows with updatedAt from yesterday)
And an Employee of the Version was edited today (updatedAt more recent than the CALCULADO rows)
When the user opens the Tax Allocation screen
Then the warning "The costs of this Version have changed since the last tax calculation. Click Generate Taxes to update." is displayed
And the warning does not block any other action on the screen
```

---

## Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `RateioImpostoGrade` (+`modoValor`, `valorBaseSnapshot`); `AliquotaImpostoParametro` (+`categoria`); reads from `Empregado`/`Viagem`/`ItemPatrimonial`/`Proposta`/`VersaoProposta`; `HistoricoOperacao` (INSERT) |
| Migration | **Additive** — 2 enums + 3 columns with defaults. **Recalculates nothing.** DDL ready in ADR-050 §DDL. Applied via the Supabase SQL Editor **together with the PR's merge**. Manual backfill of `categoria = INDICE_REAJUSTE` for the rates that are indices (the user reviews it). |
| Calculation engine | New domain function `ValorRealizadoService.somarCustoBrutoPorConta(tenantId, versaoId)` = `somarPorContaAnalitica` **without** the `rateioImpostoGrade` block. New use case `GerarImpostosDaVersaoUseCase`. |
| Transaction | Yes — 1 `$transaction`: soft-delete of the old CALCULADO rows + createMany of the new ones + `HistoricoOperacao`. Full rollback on failure. |
| Requires a lock? | Optimistic locking by the Version's `updatedAt`, the same pattern as US-007/US-105. |
| Business rule | Freezing after OFICIALIZADO; Partnership Agreement immunity; only `categoria = TRIBUTO`; the base excludes allocations; no cascading; competencia = `dataInicio`; the rate in effect on `dataInicio` |
| Audit | `HistoricoOperacao` type `IMPOSTOS_GERADOS`: `{ versaoId, contasAfetadas[], porLinha: [{ aliquotaId, contaId, base, imposto, aliquotaPct }], linhasDeclaradoSubstituidas: 0 }` |

---

## Dependencies

- **ADR-050** ✅ accepted.
- `AliquotaImpostoParametro` / `RateioImpostoGrade` / `ConfigurarRateioImpostoUseCase` (US-101, US-123-127) — basis.
- `ValorRealizadoService` (ADR-032) — source of the gross base.
- **Does not block** US-128/129 (adjustment) — decision A1 preserves the coexistence.
- Git flow: migration + financial engine → **branch + PR + `/code-review`**; migration applied together with the merge.

## Definition of Done

- [ ] Scenarios 1 through 9 implemented and approved in staging
- [ ] Additive migration applied (2 enums + 3 columns), without recalculating existing data
- [ ] `DECLARADO` rows (manual and adjustment) demonstrably intact after "Generate Taxes" — regression test
- [ ] Gross base excludes `RateioImpostoGrade` (no circular reference) — test
- [ ] Two taxes on the same account sum without cascading — test
- [ ] Freezing after OFICIALIZADO blocks on the backend (not only in the UI)
- [ ] Partnership Agreement immunity (PIS/COFINS) natively blocked for `TERMO_DE_PARCERIA`
- [ ] A rate with `categoria = INDICE_REAJUSTE` never generates a tax — test
- [ ] `HistoricoOperacao` recorded with the base and tax per row
- [ ] The "stale" warning appears when the cost sources are more recent than the CALCULADO rows
- [ ] The adjustment engine (US-128/129, `prepararPlanoReajuste`) does not regress — green suite
