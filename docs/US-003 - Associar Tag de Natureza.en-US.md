US-003
Associate Nature Tag (OPEX/CAPEX) to Analytical Account

Module:	Registrations — Chart of Accounts	Epic:	EP118/24
Profile:	Budget Analyst / GFIN	Priority:	🟡 Medium
Estimate:	M	Depends on:	US-001 (account existing in the SGO)

As a Budget Analyst or Financial Manager (GFIN),
I want to associate a Nature Tag (OPEX — Operating Cost or CAPEX — Investment) to an N7 analytical account imported from the ERP, directly in the SGO parameterization panel,
So that expenses can be classified by economic nature without interfering with the ERP's official hierarchy, enabling the Budget Traffic Light and the cost-vs-investment management reports. [RF_PLA_REQ_003, RN_PLA_005]

Acceptance Scenarios — US-003

✅  Scenario 1 — Assigning an OPEX tag to an N7 analytical account with no prior tag
Given the user accesses the parameterization panel of an N7 analytical account
And the account has no tag_natureza assigned (NULL)
When the user selects 'OPEX (Operating Cost)' in the Nature Tag selector and confirms
Then the system saves tag_natureza = 'OPEX' in tb_conta_contabil for that account
And the tag is visually displayed in the tree (identifying badge or icon)
And the audit log is written with the previous state (NULL) and the subsequent state ('OPEX') [RN_PLA_004]


❌  Scenario 2 — Attempting to assign an OPEX tag to a child account of a CAPEX parent [ERROR LOCK]
Given there is a Level 6 synthetic account with tag_natureza = 'CAPEX' or whose hierarchical nature is Investment
And the user tries to assign 'OPEX (Operating Cost)' to an N7 analytical account that is a child of that synthetic account
When the user tries to confirm the assignment
Then the system blocks the save with rollback [RN_PLA_005]
And displays the alert: 'Invalid Classification [ERROR LOCK]: This account's parent synthetic account is classified as CAPEX. It is not permitted to classify a child account as OPEX — the nature must be consistent with the hierarchy.'
And the tag_natureza field remains unchanged in the database


✅  Scenario 3 — Removing a nature tag from an analytical account
Given an N7 analytical account has tag_natureza = 'OPEX'
When the user selects the 'Unclassified' option (NULL) and confirms
Then the system updates tag_natureza to NULL
And the nature badge disappears from the tree display
And the audit log records the removal with the previous state ('OPEX') and the subsequent state (NULL)


❌  Scenario 4 — Attempting to assign a tag to an N1–N6 synthetic account [ERROR LOCK]
Given the user tries to access the parameterization panel of a synthetic account (Level 1 to 6)
When the panel is loaded
Then the Nature Tag selector is not rendered for synthetic accounts — read-only only
And the system displays the message: 'Nature Tags are only configurable on analytical accounts (Level 7).'


Aspect	Detail
Affected tables	tb_conta_contabil (UPDATE on tag_natureza), tb_historico_operacoes (INSERT)
Changed fields	tag_natureza (OPEX | CAPEX | NULL)
Transaction?	Yes — UPDATE + audit log in a single transaction
Critical validation	Nature inheritance hierarchy (RN_PLA_005): validated in the application layer before the UPDATE
Audit	tipo_operacao: UPDATE | fields: previous and subsequent state of tag_natureza

Definition of Done — US-003
☐  Scenarios 1 through 4 implemented and approved in UAT
☐  Hierarchical inheritance correctly blocked (CAPEX parent → child cannot be OPEX)
☐  Tag visually displayed in the tree after assignment
☐  Log with state delta correctly recorded
☐  Selector not rendered for N1–N6 synthetic accounts
