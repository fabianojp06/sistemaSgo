# US-140 — Trip Transportation Total by Historical Account Average

**Module:** Registrations / Proposals — Trips Tab (US-109, UC03.29-33)
**Epic:** EP118-24 — Registrations Module
**Priority:** Low
**Estimate:** L (blocked — see dependencies)
**Status:** 🔴 BLOCKED — not refinable until the source of the historical data is resolved

**As a** CTCEA Financial Management (GFIN) analyst building the budget for a Proposal,
**I want** the Trips screen to show me a reference transportation value calculated from the
historical average of the transportation account's entries over the last few years,
**So that** I have an objective benchmark for how much we typically spend on transportation,
instead of estimating the unit transportation cost blindly.

---

## Context and business rules

Today the **Transportation** component of the Trip's Estimated Cost is
`Number of People × Unit Transportation Cost`, with the unit cost **typed in** by the user
(`Viagem.custoUnitarioTransporte`). The domain logic that performs this calculation is
`src/domain/plano-contas/calcularCustoEstimadoViagem.ts` — marked **[SHIELDED SOURCE]** (the
single source of truth for Trip cost math; changing it affects the Budget Traffic Light,
Disbursement Schedule, and the insights dashboard).

The user's request (verbatim): *"Total with transportation = value entered by the GFIN =>
averages of the account over the last few years"*.

Decisions already made with the user (AskUserQuestion, 2026-09-01):

1. The system **must calculate** the historical average automatically — it is not a typed field,
   nor merely a visual hint.
2. This value is **display-only** on the Trips screen. It does **NOT** change the persisted
   `Viagem.custoEstimado`, which continues to feed the Budget Traffic Light / Schedule /
   dashboard exactly as it does today.
   → The Transportation component of `calcularCustoEstimadoViagem` **does not change** in this US.

Consequence: the Trip now displays **two transportation figures**:

| Figure | Source | Included in the Estimated Cost? |
|---|---|---|
| Estimated transportation cost | `Number of People × Unit Transportation Cost` (typed) | Yes (as today) |
| Transportation account historical average | calculated by the system (this US) | No — informational reference only |

---

## 🔴 Unresolved blockers and dependencies

None of these can be assumed by the developer — all require a decision from the user / Tech Lead
before any code is written:

| # | Blocker | Why it blocks | Who decides |
|---|---|---|---|
| B1 | **The source of the historical data does not exist in the SGO.** The system only has `ValorOrcadoConta` (budgeted per fiscal year) and the "realized" amount derived from the current Proposal itself (`ValorRealizadoService`). There is no historical series of **entries realized per account over several years**. | Without a source for "how much was actually spent on account X in years Y..Z," there is nothing to calculate. | User + Tech Lead |
| B2 | **How the historical data enters the system.** Options: (a) a new integration with the Senior ERP pulling the realized amount per account/fiscal year; (b) manual import (spreadsheet) of historical realized amounts per account; (c) a new `RealizadoHistoricoConta(tenantId, contaId, exercicio, valor)` entity fed by one of the above. | Each option is its own foundational US, of a different size. | Tech Lead (ADR) |
| B3 | **Definition of "the last few years."** How many fiscal years? (3? 5?) Fixed window or configurable per tenant/`ParametroSistema`? **Simple** average across fiscal years or **weighted** (more weight to the most recent)? Adjust for inflation/index? Average of the account's **total annual value**, or the average of **some unit value** (per trip? per person?)? | The calculated number changes completely depending on the answer. | User (GFIN) |
| B4 | **Which account.** Is it the transportation analytical account **already linked** to the Trip (`Viagem.contaTransporteId`)? And if different trips use different transportation accounts — is the average per account of each trip, or a single average for the tenant's "trip transportation account"? | Determines whether the calculation is per-trip or global. | User |
| B5 | **What happens to the "Unit Transportation Cost" field on the screen.** Does it keep existing and remain editable (it is what feeds the estimated cost)? Does it get a "use the historical average" button? Does it sit side by side with the average just for comparison? | Determines the screen design and whether there is a risk of confusing the two figures. | User + AN/PO |
| B6 | **No historical data for the account.** What should be shown when the account does not have enough history (a new account, fewer than N fiscal years)? "—", "no history", zero? | Mandatory edge-case rule. | AN/PO |
| B7 | **Multi-tenant.** The history is always per `tenantId` (each organization has its own). Confirm that no average crosses tenants. | Non-negotiable requirement of the SGO. | — (already a project rule, but must be explicit in the B2 data source) |

---

## Acceptance criteria (draft — only valid AFTER resolving B1–B6)

> ⚠️ These scenarios assume there is a `RealizadoHistoricoConta` source per `tenantId` +
> `contaId` + `exercicio`, and that the window is "the last 3 closed fiscal years, simple average
> of the total annual value." These parameters are **draft assumptions** — to be replaced per
> B2/B3.

**Scenario 1 — Transportation account with sufficient history**
```gherkin
Given the Proposal is in RASCUNHO or EM_ELABORACAO
And the Trip "Missão Brasília" has transportation account = "3.1.2.05 - Transporte"
And the tenant's account "3.1.2.05" has closed realized amounts: 2023 = R$ 120,000.00, 2024 = R$ 150,000.00, 2025 = R$ 180,000.00
When the user opens the Trips tab
Then the "Historical transportation average (account 3.1.2.05)" field shows R$ 150,000.00
And this value is NOT added to the Trip's Estimated Cost
And the Trip's Estimated Cost remains = Airfare + Per Diem + (Number of People × typed Unit Transportation Cost)
```

**Scenario 2 — Transportation account without sufficient history**
```gherkin
Given the Trip's transportation account has closed realized amounts in only 1 fiscal year (2025)
And the rule requires a minimum of 3 fiscal years (B3 parameter)
When the user opens the Trips tab
Then the "Historical transportation average" field shows "insufficient history"
And no average calculation is performed
```

**Scenario 3 — Multi-tenant isolation**
```gherkin
Given the account with code "3.1.2.05" exists in tenant A (realized average of R$ 150,000.00) and in tenant B (realized average of R$ 900,000.00)
And the user is authenticated in tenant A
When the user opens the Trips tab of a Proposal in tenant A
Then the displayed historical average considers ONLY entries from tenant A
And under no circumstance uses data from tenant B
```

**Scenario 4 — Officialized Proposal (read-only)**
```gherkin
Given the Proposal is OFICIALIZADA / approved
When the user opens the Trips tab
Then the historical average is displayed normally (it is a read-only calculation)
And no field of the Trip is editable
```

---

## Technical impact (preliminary)

| Aspect | Detail |
|---|---|
| Tables affected | **New:** likely `RealizadoHistoricoConta` (`tenantId`, `contaId`, `exercicio`, `valor` Decimal) — depends on B2. No change to `Viagem`. |
| `calcularCustoEstimadoViagem` | **Do NOT change.** The persisted estimated cost does not change (the user's decision). |
| Average calculation | New domain service (e.g., `CalcularMediaHistoricaContaService`) — pure read, no transaction. |
| Display layer | `ViagemPanel.tsx` — new reference field/label; the tab's Server Action (`page.tsx`) starts loading the average per account. |
| Audit | None (read operation). Loading the history (B2) does require its own audit trail. |
| Multi-tenant | `tenantId` in every `where` clause of the history query. |

---

## Backlog recommendation

- **Column: 🔴 Blocked.** This is not a "US ready and waiting in the queue" — it is missing the
  historical data foundation (B1/B2), which is an architecture decision plus a likely
  integration/import.
- **Unblocking condition:** the user defines where the historical realized amount per account
  comes from (B2) and the average's window/method (B3); the Tech Lead produces the ADR for the
  data source.
- **Smallest deliverable increment (once unblocked):** a foundational US
  "US-140a — Historical Realized-Amount Load per Account" (manual import via spreadsheet, the
  cheapest path), and only then US-140 (display the calculated average on the Trips screen). The
  screen part itself is small (S); all the weight is in the data source.

---

## Definition of Done (once out of blocked status)

- [ ] Source of historical realized amount per account defined, with an audited load isolated per tenant
- [ ] Average window and method documented as a business rule (RN) and/or `ParametroSistema`
- [ ] Average displayed on the Trips tab, clearly labeled as a reference (not included in the estimated cost)
- [ ] "Insufficient history" scenario handled with a specific message
- [ ] Multi-tenant isolation test for the history query
- [ ] `Viagem.custoEstimado` and everything that depends on it (Traffic Light, Schedule, dashboard) unchanged — regression test
