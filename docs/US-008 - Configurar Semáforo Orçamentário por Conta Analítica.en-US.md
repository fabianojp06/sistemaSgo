US-008 

Configure Budget Traffic Light by Analytical Account 

 

Module: 

Registrations — Chart of Accounts 

Epic: 

EP118/24 

Profile: 

Budget Analyst / GFIN 

Priority: 

🟢 Low 

Estimate: 

P 

Depends on: 

US-001 (N7 account synchronized) 

 

As a Budget Analyst or Financial Manager (GFIN),

I want to configure the percentage bands of the Budget Traffic Light (Green/Yellow/Orange) for specific analytical accounts,

So that I can customize the thresholds that will later define the visual budget-consumption alerts per account, tailoring them to each line item's operational reality without relying on the system's global defaults. [RN_PLA_006, RF_PLA_REQ_003]



Scope note (slicing — Team Debate, 2026-07-30; revised on 2026-07-31): this US covers only the configuration and validation of the 3 percentages (Scenarios 1 and 2). The actual display of the colored badge based on consumption (former Scenario 3) was moved to US-008a, which depends on `valorRealizado` — data that will come from EP118/24's own cost-entry modules (Employees, Travel, Goods/Services, Apportionments/US-101), not from a public budget execution module as originally assumed. See US-008a for the backlog sequence until then.

This US-008 does not have that blocker: US-001 already delivers the synchronized N7 account, and it does not depend on any cost module. It is free for immediate implementation.



Acceptance Scenarios — US-008

✅  Scenario 1 — Valid configuration of traffic light bands

Given the user accesses the parameterization panel of an N7 analytical account

When the user sets the thresholds: Green up to 70%, Yellow up to 85%, Orange up to 95%

And confirms the configuration

Then the system saves semaforo_verde_pct=70, semaforo_amarelo_pct=85, semaforo_laranja_pct=95

And the audit log is written with the previous and new values [RN_PLA_004]



❌  Scenario 2 — Inconsistent bands (Yellow < Green) [ERROR LOCK]

Given the user is configuring the thresholds

When the user sets Green=85% and Yellow=70% (Yellow lower than Green)

And tries to save

Then the system blocks the save

And displays the alert: 'Invalid Configuration: The Yellow threshold must be greater than the Green threshold. Check the entered percentages.'



❌  Scenario 2a — Inconsistent bands (Orange ≤ Yellow) [ERROR LOCK]

Given the user is configuring the thresholds

When the user sets Yellow=85% and Orange=80% (Orange lower than or equal to Yellow)

And tries to save

Then the system blocks the save

And displays the alert: 'Invalid Configuration: The Orange threshold must be greater than the Yellow threshold. Check the entered percentages.'



❌  Scenario 2b — Percentage outside the 0–100% range [ERROR LOCK]

Given the user is configuring the thresholds

When the user enters a value less than or equal to 0, or greater than 100, in any of the three fields

And tries to save

Then the system blocks the save

And displays the alert: 'Invalid Configuration: percentages must be between 1 and 100.'



Aspect

Detail

Affected tables

ContaContabil (UPDATE on semaforoVerdePct, semaforoAmareloPct, semaforoLaranjaPct — field names to be confirmed with the Tech Lead/DBA during modeling)

Validation

laranja > amarelo > verde > 0 and all ≤ 100. Validated on the backend; assess with the DBA whether a CHECK constraint in the database is also worthwhile

Audit

tipo_operacao: SEMAFORO_CONFIGURADO (or equivalent) | delta: previous and new values of the three fields



Dependencies

- US-001 (N7 account synchronized)
- Does not depend on a budget execution module — that dependency was isolated in US-008a



Definition of Done — US-008

☐  Scenarios 1, 2, 2a and 2b implemented and approved in UAT

☐  Band consistency validation implemented on the backend (and on the frontend, once the UI exists)

☐  Log with delta recorded
