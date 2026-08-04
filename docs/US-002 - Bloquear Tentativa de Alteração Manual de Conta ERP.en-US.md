US-002
Block Manual Alteration Attempt on ERP Account

Module:	Registrations — Chart of Accounts	Epic:	EP118/24
Profile:	SGO System (backend bus)	Priority:	🔴 High
Estimate:	M	Depends on:	US-001 (Chart of Accounts synchronized)

As the SGO System (backend bus),
I want to intercept and reject any attempt to insert, rename, or directly delete accounts imported from the ERP,
So that I guarantee accounting integrity and the Senior ERP's exclusive governance over the official Chart of Accounts structure. [RN_PLA_001, RN_PLA_002, RF_PLA_REQ_002]

Acceptance Scenarios — US-002

❌  Scenario 1 — Attempted alteration via graphical interface [ERROR LOCK]
Given the user accesses the Chart of Accounts screen
When the user views any account imported from the ERP
Then the [New Account], [Edit Name], [Delete Account] buttons are not rendered in the interface [RF_PLA_REQ_002]
And the código_conta, nome_conta and nivel fields are in strict Read-only mode
And there is no editable input or text field linked to the ERP structure


❌  Scenario 2 — Attempted bypass via direct API call [ERROR LOCK]
Given a user tries to force an account insertion or change via a direct request to the SGO persistence endpoint (interface bypass)
When the backend bus receives the unauthorized request
Then the system rejects the operation with an immediate transaction rollback
And returns HTTP status 403 with the message: 'Operation Denied [ERROR LOCK]: The Chart of Accounts is governed exclusively by the Senior ERP. It is not permitted to insert, delete, or change account names directly in the SGO.'
And the database remains 100% unchanged
And the governance violation event is recorded in tb_historico_operacoes with tipo_operacao='VIOLACAO_GOVERNANCA'


Aspect	Detail
Affected tables	tb_conta_contabil (no write allowed via interface)
Validation	Backend verifies the origin of the request; rejects any UPDATE/INSERT/DELETE on ERP structural fields
Audit	Blocked attempts recorded in tb_historico_operacoes with type VIOLACAO_GOVERNANCA
Transaction?	Immediate rollback on any detected attempt

Definition of Done — US-002
☐  Interface does not render write buttons on ERP accounts (tested with DOM inspection)
☐  Persistence endpoint rejects direct requests (tested with Postman/curl without sync admin token)
☐  Error message displayed as specified
☐  Violation log recorded correctly
