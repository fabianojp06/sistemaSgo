US-004 

Create Analytical Account Grouper 

 

Module: 

Registrations — Chart of Accounts 

Epic: 

EP118/24 

Profile: 

Budget Analyst / GFIN 

Priority: 

🟡 Medium 

Estimate: 

M 

Depends on: 

US-001 (N7 accounts available) 

 

As a Budget Analyst or Financial Manager (GFIN), 

I want to create an Account Grouper that consolidates two or more analytical (N7) accounts from the ERP under a custom SGO label, 

So that I can generate customized subtotals in budget reports (Disbursement Schedule, Expense Forecast) without changing the official Senior ERP hierarchy. [RF_PLA_REQ_005, RN_PLA_007, RN_PLA_008, RN_PLA_009] 

 

Acceptance Scenarios — US-004 

 

✅  Scenario 1 — Creating a valid Grouper with 2 or more N7 accounts 

Given the user accesses the Account Groupers panel 

And there are N7 analytical accounts synchronized in the SGO 

When the user clicks [New Grouper], fills in the name 'Airfare Expenses' and selects the accounts 'Domestic Airfare' and 'International Airfare' 

And clicks [Save Grouper] 

Then the system validates the unique name and the minimum of 2 N7 accounts [RN_PLA_008] 

And persists the Grouper in tb_agrupador_contas with ativo = TRUE 

And persists the links in tb_agrupador_conta_item for each selected account 

And the Grouper appears immediately in the panel, available for the Budget module reports [RN_PLA_009] 

And the creation log is written to tb_historico_operacoes with tipo_operacao='INSERT' and the full payload [RN_PLA_004] 

 

 

✅  Scenario 2 — The same N7 account participates in multiple Groupers simultaneously 

Given the account 'Domestic Airfare' already belongs to the Grouper 'Airfare Expenses' 

When the user creates a new Grouper 'Corporate Travel' and selects the same account 'Domestic Airfare' together with 'Travel Per Diems' 

Then the system allows the link without conflict [RN_PLA_011] 

And the account appears in both Groupers in the panel 

And the TotalizerService calculates the value of each Grouper independently 

 

 

❌  Scenario 3 — Duplicate Grouper name [ERROR LOCK] 

Given a Grouper named 'Airfare Expenses' already exists registered in the tenant 

When the user tries to create a new Grouper with the same name 

And clicks [Save Grouper] 

Then the system blocks the save [RN_PLA_008] 

And displays the alert: 'A Grouper with this name already exists. Use a unique name.' 

And the modal remains open with the entered data intact for correction 

 

 

❌  Scenario 4 — Grouper with fewer than 2 N7 accounts [ERROR LOCK] 

Given the user is creating a Grouper and has selected only 1 analytical account 

When they click [Save Grouper] 

Then the system blocks the save [RN_PLA_008] 

And displays the alert: 'The Grouper must have a filled-in Name and at least two selected analytical accounts.' 

And the modal remains open with the entered data intact 

 

 

❌  Scenario 5 — Grouper with a blank name [ERROR LOCK] 

Given the user is creating a Grouper with 2 accounts selected but has not filled in the Name 

When they click [Save Grouper] 

Then the system blocks the save 

And displays the alert: 'The Grouper must have a filled-in Name and at least two selected analytical accounts.' 

And the Name field is visually highlighted in red 

 

 

❌  Scenario 6 — Attempting to link an N1–N6 synthetic account to the Grouper [ERROR LOCK] 

Given the user tries to select a synthetic account (Level 1 to 6) in the account selector of the Grouper modal 

When the account selector is rendered 

Then only N7 analytical accounts are displayed as options in the selector [RN_PLA_003] 

And N1–N6 synthetic accounts do not appear in the selection list 

 

 

Aspect 

Detail 

Affected tables 

tb_agrupador_contas (INSERT), tb_agrupador_conta_item (INSERT per account), tb_historico_operacoes (INSERT) 

Transaction? 

Yes — INSERT on the grouper + INSERT on the links + log in a single transaction. Full rollback on failure 

Database constraint

UNIQUE (tenantId, nome) on ContaAgrupadora [implemented]. Analytical account (N7) validation is done in application code, in CriarAgrupadorUseCase, via contaContabil.count({isAnalitica: true}) — there is no fn_check_conta_analitica trigger in Postgres (see Team Debate Decisions)

Audit

tipo_operacao: AGRUPADOR_CRIADO | payload: agrupadorId, nome, contaIds, usuarioId, timestamp — written to HistoricoOperacao within the same transaction

Reports

Grouper available immediately in the Disbursement Schedule (UC04.01) — there is no `ativo` field in the table; every created Grouper is considered available (see Team Debate Decisions)

 

 

Team Debate Decisions (2026-07-30)

 

 

1. RN_PLA_007 — confirmed: it means ContaAgrupadora is a 100% SGO entity, isolated from the ERP-imported tree (full CRUD allowed, no write link to ContaContabil). It is not a multi-tenant isolation rule (that is already covered by tenantId in all tables).

2. The `ativo = TRUE` field in Scenario 1 — text out of date with respect to the implementation. There is no `ativo` column in the schema (ContaAgrupadora) and there is no need to add one: every created Grouper is already returned by ListarAgrupadoresUseCase with no status filter. Decision: keep the schema as is, no migration; Scenario 1 text kept only as a historical reference of the business intent ("available immediately"), already satisfied.

3. fn_check_conta_analitica trigger — team decision: do not implement. The validation already happens in CriarAgrupadorUseCase (the only write point in ContaAgrupadoraItem today), is testable in a unit test, and avoids business logic in PL/pgSQL. Revisit only if a second write path to this table appears (bulk import, admin script, etc.).

4. Interactive transaction (prisma.$transaction(async (tx) => {...})) in CriarAgrupadorUseCase — same pattern that caused a failure in the chart-of-accounts sync with the Supabase pooler (commit 814d57e). Risk considered lower here (3 fixed writes, not a dynamic loop), does not block the US, but recorded as technical debt to revisit if instability occurs in production.

5. Scenario 2 (same account in multiple Groupers) had no automated test — TotalizerService currently uses a stub that always returns a zero balance (there is no commitment/settlement module implemented yet), so this behavior was never exercised with real values. Test added to ListarAgrupadoresUseCase.test.ts injecting a fake balance per account, confirming independent totals per Grouper even with a shared account.

 

 

Definition of Done — US-004

☑  Scenarios 1, 3, 4, 5 implemented and covered by automated test (CriarAgrupadorUseCase.test.ts)

☑  Scenario 2 implemented and covered by automated test (ListarAgrupadoresUseCase.test.ts)

☑  Grouper available in reports immediately after creation (no `ativo` field — see Team Debate Decisions, item 2)

☑  Multiple participation of the same account in different groupers validated (N:N)

☑  Analytical account (N7) validation implemented in CriarAgrupadorUseCase and tested — team decision not to use a database trigger (see Team Debate Decisions, item 3)

☐  Selector displays only N7 accounts in the modal — pending UI/frontend verification (out of scope for the use cases already audited)

☑  Creation log with full payload recorded 
