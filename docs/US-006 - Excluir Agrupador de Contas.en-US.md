US-006 

Delete Account Grouper 

 

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

I want to delete an Account Grouper that is not referenced in any active budget document, 

So that I can keep the Groupers panel clean and free of obsolete configurations, while preserving the integrity of the reports that still reference other Groupers. [RN_PLA_010] 

 

Acceptance Scenarios — US-006 

 

✅  Scenario 1 — Successful deletion of a Grouper with no active references 

Given the Grouper 'Old Airfare' exists with no references in active Disbursement Schedules or Proposals 

When the user clicks [Delete] on the Grouper 

And the system displays the confirmation modal: 'Do you want to delete the Grouper Old Airfare? This action will remove the corresponding subtotal from all linked reports.' 

And the user clicks [Confirm] 

Then the system removes the Grouper (ativo = FALSE or physical DELETE if no history) and its links in tb_agrupador_conta_item 

And the Grouper disappears from the panel immediately 

And the deletion log is written [RN_PLA_004] 

 

 

✅  Scenario 2 — Cancel the deletion 

Given the deletion confirmation modal is visible 

When the user clicks [Cancel] 

Then the modal closes without executing any operation 

And the Grouper remains active and visible in the panel 

And no log is written 

 

 

❌  Scenario 3 — Deletion blocked by active reference [ERROR LOCK] 

Given the Grouper 'Airfare Expenses' is referenced in an active Proposal in the Disbursement Schedule 

When the user tries to delete the Grouper and confirms in the modal 

Then the system aborts the deletion [RN_PLA_010] 

And displays the alert: 'Deletion Blocked [ERROR LOCK]: This Grouper is referenced in active budget documents. Remove the references before deleting it.' 

And the Grouper remains active in the panel 

And no change is made in the database 

 

 

Aspect 

Detail 

Affected tables 

tb_agrupador_contas (UPDATE ativo=FALSE or DELETE), tb_agrupador_conta_item (DELETE links), tb_historico_operacoes (INSERT) 

Pre-check 

The system checks references in tb_cronograma_desembolso and tb_dotacao_conta before allowing deletion 

Transaction? 

Yes — pre-check + removal + log in a single transaction. Rollback if the log fails 

Audit

tipo_operacao: AGRUPADOR_EXCLUIDO | payload: agrupadorId, nome, contaIds — written to HistoricoOperacao within the same transaction, before the physical delete (cascade would remove the data before it could be read)

 

 

Team Debate Decisions (2026-07-30)

1. Pre-existing code: ExcluirAgrupadorUseCase.ts already covered Scenarios 1 and 3 via an injectable `possuiReferenciaAtiva` parameter (stub always `false`, documented as an extension point — no Disbursement Schedule/Proposal module exists yet in the SGO). Decision kept unchanged.

2. Tech Lead finding: the audit payload only wrote `{ agrupadorId, nome }`, without `contaIds` — inconsistent with CriarAgrupadorUseCase/EditarAgrupadorUseCase (which always include contaIds) and incomplete relative to the "full snapshot" the US requires. Since the delete is physical with a cascade on ContaAgrupadoraItem, once committed there is no other source to recover which accounts were linked.

3. Fixed: findUniqueOrThrow now includes `itens: true` before the delete, and `contaIds` was added to the audit payload. Test updated to check for `contaIds` in the log.

4. Deletion is a physical DELETE (not `ativo=FALSE`) — consistent with the decision already made in US-004 that the `ativo` field does not exist/is not needed in the schema.

5. Scenario 2 (canceling the modal) is pure frontend behavior — no backend action is called, so there is nothing to test at the use case level; coverage is left to component/E2E tests once the UI is implemented.

 

 

Definition of Done — US-006

☑  Scenarios 1 and 3 implemented and covered by automated test (ExcluirAgrupadorUseCase.test.ts)

☐  Scenario 2 (cancellation) — depends on the confirmation modal UI, not yet audited in this conversation

☑  Active reference pre-check implemented via the `possuiReferenciaAtiva` extension point (always returns false until a Disbursement Schedule module exists)

☐  Confirmation modal displays the Grouper's name — depends on the UI, not verified in this conversation

☑  Log with full snapshot recorded (name + contaIds) before the physical delete 
