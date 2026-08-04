US-008a

Display Budget Traffic Light Badge in the Totalizers Tab



Module:

Registrations — Chart of Accounts / Budget Reports

Epic:

EP118/24

Profile:

Budget Analyst / GFIN

Priority:

🟡 Medium — depends on cost modules of the same epic (see revised Blocking Note)

Estimate:

Not estimable until at least one cost module (Employees, Travel, Goods/Services or Apportionments) is implemented

Depends on:

US-007 (completed — provides valorOrcado), US-008 (thresholds configured), and at least one of the EP118/24 cost-entry modules (UC03.18-27 Employees, UC03.29-33 Travel, UC03.34-36 Goods/Services/Equipment, or US-101 Apportionment/Tax) to provide valorRealizado



Blocking Note (Team Debate, 2026-07-30 — revised on 2026-07-31)

This US was extracted from the original Scenario 3 of US-008 ("Configure Budget Traffic Light"). It depends on "Realized Value / Budgeted Value" per analytical account.

Scope revision (2026-07-31): the original note assumed `valorRealizado` would come from a public budget execution module (commitment/settlement, Lei 4.320/64) — that assumption was wrong for the CTCEA context (an OSCIP with a Partnership Agreement/Commercial Proposal, not federal public budget execution). Per the V5 Registrations Module Specification Draft (UC 3.02 — Totalizers Tab, RN_TOT_03): "The search engine consolidates the budgeted and realized values extracted exclusively from the last configured level (Level 7 / Leaf Node)... triggers a synchronous scan across the expense tables (Positions, Travel, Apportionments)." That is, `valorRealizado` is the sum of the operational cost entries already specified within this same epic (EP118/24) — Employees/Positions, Travel, Goods/Services/Equipment and Apportionments/Taxes (US-101) — not a dependency on a nonexistent external module.

`valorOrcado` has already been available since US-007 was completed (`ValorOrcadoConta`, scoped by Proposal/Version/fiscal year).

**Pending product decision (PO)**: a traffic light with partial `valorRealizado` (e.g. only the Apportionments/US-101 contribution, without Employees) could give a false sense of security — an account might look "Green" simply because most of the cost (payroll) hasn't been entered into the system yet. Recommendation: **do not release US-008a until at least the Employees/Positions module is live**, since it is typically the largest cost mass in Partnership Agreements. Revisit this recommendation once the cost modules are sequenced in the backlog.

Recommended backlog sequence up to this point: US-007 (✅ completed) → US-008 (thresholds) → US-101 (Apportionment/Tax) → Employees/Positions (UC03.18-27) → Travel (UC03.29-33) → Goods/Services/Equipment (UC03.34-36) → US-008a.



As a Budget Analyst or Financial Manager (GFIN),

I want to view a colored badge (Green/Yellow/Orange/Red) in the Totalizers tab of each analytical account, reflecting the current budget consumption against the thresholds configured in US-008,

So that I can quickly and visually identify which accounts are close to or have already exceeded their consumption limits, without having to manually calculate each percentage. [RN_PLA_006]



Acceptance Scenarios — US-008a

✅  Scenario 1 — Traffic light shows Red when consumption exceeds the Orange threshold

Given account 'Domestic Airfare' has semaforoLaranjaPct=95 (configured via US-008)

And this account's current consumption represents 97% of the budgeted value

When the user accesses the Proposal's Totalizers tab

Then the system displays the Red badge on the account's row [RN_PLA_006]

And the consumption value is calculated by the TotalizerService: Realized Value / Budgeted Value



✅  Scenario 2 — Traffic light shows Green/Yellow/Orange based on the consumption band

Given the account has configured thresholds (Green=70, Yellow=85, Orange=95)

When the account's consumption is, respectively, below 70%, between 70% and 85%, or between 85% and 95%

Then the system displays the corresponding badge (Green, Yellow or Orange) on the account's row



✅  Scenario 3 — An account with no configured thresholds uses the system's global default

Given the analytical account has not had thresholds configured via US-008

When the user accesses the Totalizers tab

Then the system applies the global default thresholds (to be defined by the PO/Tech Lead)

And displays the badge normally based on those default values



Aspect

Detail

Affected tables

None (read-only — ContaContabil for thresholds, budget execution module for realized/budgeted value)

Module dependency

At least one cost-entry module (Employees, Travel, Goods/Services or Apportionments) — the TotalizerService (ObtemSaldoContaAnalitica, currently semSaldoDisponivel/stub) needs to start aggregating the real entries from these modules, not from public budget execution

Calculation

percentualConsumo = valorRealizado / valorOrcado; badge = comparison against the account's 3 thresholds (or global default if not configured)

Audit

Not applicable — this is read/display only, with no data changes



Definition of Done — US-008a

☐  At least the Employees/Positions module (largest cost mass) available, providing real valorRealizado per account; valorOrcado already available via US-007

☐  TotalizerService (or equivalent service) calculates the real consumption percentage

☐  Scenarios 1 through 3 implemented and approved in UAT

☐  Global default threshold defined for accounts with no configuration of their own (US-008)
