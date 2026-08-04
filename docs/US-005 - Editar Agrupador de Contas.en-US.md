US-005 

Edit Account Grouper 

 

Module: 

Registrations — Chart of Accounts 

Epic: 

EP118/24 

Profile: 

Budget Analyst / GFIN 

Priority: 

🟡 Medium 

Estimate: 

P 

Depends on: 

US-004 (existing Grouper) 

 

As a Budget Analyst or Financial Manager (GFIN), 

I want to edit the name and/or the list of analytical accounts linked to an existing Account Grouper, 

So that I can keep the report subtotal configuration up to date as the expense structure changes, without needing to delete and recreate the Grouper. [RF_PLA_REQ_005, RN_PLA_008, RN_PLA_009] 

 

Acceptance Scenarios — US-005 

 

✅  Scenario 1 — Successful editing of the Grouper's name and accounts 

Given the Grouper 'Airfare Expenses' exists with 2 linked accounts 

When the user clicks [Edit] on the Grouper, changes the name to 'Airfare and Per Diems' and adds the account 'Travel Per Diems' 

And clicks [Save Grouper] 

Then the system validates the unique name and the minimum of 2 accounts [RN_PLA_008] 

And persists the new name and updates the links in tb_agrupador_conta_item 

And the reports that reference the Grouper immediately reflect the new configuration [RN_PLA_009] 

And the change log is written with the previous and subsequent state (delta) [RN_PLA_004] 

 

 

❌  Scenario 2 — Editing results in fewer than 2 linked accounts [ERROR LOCK] 

Given the Grouper has 2 linked accounts 

When the user removes 1 account in the edit modal, leaving only 1, and tries to save 

Then the system blocks the save [RN_PLA_008] 

And displays the alert: 'The Grouper must have a filled-in Name and at least two selected analytical accounts.' 

And the modal remains open with the data intact 

 

 

❌  Scenario 3 — New name duplicates another existing Grouper [ERROR LOCK] 

Given the Grouper 'Corporate Travel' already exists in the system 

When the user edits the Grouper 'Airfare Expenses' and changes the name to 'Corporate Travel' 

Then the system blocks the save 

And displays the alert: 'A Grouper with this name already exists. Use a unique name.' 

 

 

Aspect 

Detail 

Affected tables 

tb_agrupador_contas (UPDATE), tb_agrupador_conta_item (DELETE + INSERT to reconcile links), tb_historico_operacoes (INSERT) 

Sync strategy 

Compare the current list vs. the new list: remove deleted links, insert added links — never DELETE ALL + INSERT 

Transaction? 

Yes — UPDATE + link reconciliation + log in a single transaction 

Audit

tipo_operacao: AGRUPADOR_EDITADO | delta: name before/after, contaIds before/after — written to HistoricoOperacao within the same transaction

 

 

Team Debate Decisions (2026-07-30)

1. Pre-existing code violated the US itself: EditarAgrupadorUseCase.ts did a deleteMany (all) + createMany (all) on ContaAgrupadoraItem, exactly the pattern forbidden by the Sync Strategy. There was no automated test for this use case.

2. The Tech Lead decided to implement diff reconciliation (remove only the contaIds missing from the new list, insert only the new ones) — not because the delete-all+insert caused a bug today (the ContaAgrupadoraItem table only has the composite FK, with no data of its own to lose), but to avoid silently losing data if the model gains its own fields in the future, and to keep the code aligned with the US text without opening a second doc-vs-implementation exception (the first was the database trigger in US-004).

3. EditarAgrupadorUseCase.ts rewritten: it computes contaIdsRemovidos and contaIdsAdicionados by comparing the previous state (read inside the transaction) against the new list, and only runs deleteMany/createMany on those differences — accounts that are kept are never touched.

4. Test created in EditarAgrupadorUseCase.test.ts covering the 3 US scenarios plus an extra partial-reconciliation case (grouper with [c1,c2,c3], edited to [c1,c2,c4] must remove only c3 and add only c4).

 

 

Definition of Done — US-005

☑  Scenarios 1 through 3 implemented and covered by automated test (EditarAgrupadorUseCase.test.ts)

☐  Reports updated immediately after editing the Grouper — behavior follows from ListarAgrupadoresUseCase already reading the current state with no cache; there is no end-to-end integration test with the reports module yet

☑  Link reconciliation strategy implemented via diff (no DELETE ALL) and tested, including the partial-reconciliation case

☑  Log with change delta recorded (name and contaIds before/after) 
