US-007

Configure Budgeted Value by Analytical Account and Fiscal Year



Module:

Registrations — Chart of Accounts

Epic:

EP118/24

Profile:

Budget Analyst / GFIN

Priority:

🔴 High

Estimate:

M

Depends on:

US-001 (N7 accounts synchronized)



Source note (Team Debate, 2026-07-30, revised on 2026-07-31)

This US was explicitly requested by the Budget Analyst/GFIN (product owner) as a prerequisite for US-008a ("Display Budget Traffic Light Badge"), currently blocked by the lack of real budgeted-value-per-account data. The TotalizerService (src/domain/plano-contas/TotalizerService.ts) has the ObtemSaldoContaAnalitica extension point ready to receive this data as soon as this US exists.

Scope revision (2026-07-31): the budgeted value is NOT a loose piece of data keyed by (tenant, account, fiscal year). Each partner/client can have several Proposals (Partnership Agreements), and each Proposal can have several Versions. The budgeted value per analytical account is always entered within the context of a specific Proposal/Version — isolated from any other proposal, even when they use the same analytical account and the same fiscal year. That is: if Client A's Proposal posts R$ 1,000.00 to the 'Salaries' account and Client B's Proposal posts R$ 2,000.00 to the same account, each proposal sees only its own value — there is no sum or cross-visibility between proposals.

This US-007 is the configuration and totalization engine for the value per account within a Proposal/Version. Future US covering the entry of budget cost items (e.g. "post airfare", "post per diems") at the Proposal level will still be detailed by the PO and must write/update the same data this US defines (ValorOrcadoConta), respecting the same isolation scope.

Scope decision confirmed with the user: the value is tied to a budget fiscal year AND to the Proposal/Version (it is not a single free-form field) — this allows for historical fiscal years, proposal versioning, and adherence to the LOA/PPA cycle. This implies a new table (ValorOrcadoConta) associated with Proposal/Version, not a direct field on ContaContabil.



As a Budget Analyst or Financial Manager (GFIN),

I want to enter the budgeted value of each analytical account (N7) per budget fiscal year, within the context of a Proposal and its current Version, with the total automatically rolling up the hierarchy to the corresponding synthetic accounts (N1–N6),

So that each Proposal reflects the real budget distribution by line item, isolated from other proposals of the same or other clients, serving as the basis for the Budget Traffic Light (US-008a) and other execution reports, without requiring manual calculation of the totalizer at each level of the tree. [RF_PLA_REQ_003, RN_PLA_012, RN_PLA_013, RN_PLA_014]



Context and Business Rules

The Chart of Accounts is synchronized from the Senior ERP (US-001) and is hierarchical: synthetic accounts (N1–N6) aggregate analytical accounts (N7, isAnalitica=true), which are the only leaf nodes. The budgeted value only makes sense as manual entry on the analytical account — that is where the expense actually occurs; every synthetic account derives its value exclusively from the sum of its direct child accounts, propagated recursively up to the root (RN_PLA_012).

The value is scoped by budget fiscal year (RN_PLA_013) and, additionally, by Proposal and Proposal Version (RN_PLA_014): the same partner/client can have several Proposals, and each Proposal can have several Versions over time (e.g. version in draft, approved version, revised version). Each Proposal/Version keeps its own set of values per analytical account, fully isolated from any other Proposal — the same analytical account and the same fiscal year in two different Proposals never sum or overwrite each other.

When creating a new Version of an existing Proposal, the system copies the values per analytical account from the previous Version as a starting point (RN_PLA_015) — the user adjusts from there; the previous Version remains intact and available for consultation. The Budget Traffic Light (US-008a) always operates on the current (most recent) Version of the Proposal; previous versions do not display an active badge, they are only available for historical consultation.



Acceptance Criteria — US-007

✅  Scenario 1 — Valid value configuration on an analytical account within a Proposal/Version

Given the user accesses the budgeted values panel of the current Version of Proposal 'TP-2026-014' (Client A), fiscal year 2026

And the analytical account 'Salaries' (N7) exists with no value configured in this Proposal/Version for 2026

When the user enters the value R$ 1,000.00 and confirms

Then the system persists the value in ValorOrcadoConta (tenantId, propostaId, versaoId, contaId, exercicio=2026, valor=1000.00)

And the totals of all ancestor synthetic accounts (parent, grandparent, ... up to the root), within this same Proposal/Version, are recalculated immediately for fiscal year 2026

And the audit log is written with the previous value (null/zero) and the new value, containing propostaId and versaoId [RN_PLA_004]



✅  Scenario 2 — Changing a value recalculates the entire ancestor chain within the same Proposal/Version

Given the analytical account 'Salaries' has value R$ 1,000.00 in fiscal year 2026, in the current Version of Proposal 'TP-2026-014'

And its grandparent synthetic account (N5) has a total value of R$ 4,000.00 summing 4 analytical accounts, in this same Proposal/Version

When the user changes the value of 'Salaries' to R$ 1,800.00

Then the system updates the N7 account's value to R$ 1,800.00 in this Proposal/Version

And recalculates and persists the new total of the N6 account (immediate parent), the N5 account (grandparent) and all levels above, up to the root N1, always restricted to this same Proposal/Version

And the audit log is written with the delta (previous and new value) [RN_PLA_004]



✅  Scenario 3 — Isolation between Proposals of different clients on the same account and fiscal year

Given Proposal 'TP-2026-014' (Client A) has a value of R$ 1,000.00 on account 'Salaries', fiscal year 2026

And Proposal 'TP-2026-030' (Client B) has a value of R$ 2,000.00 on the same account 'Salaries', same fiscal year 2026

When the user accesses the budgeted values panel of Proposal 'TP-2026-030'

Then the system displays R$ 2,000.00 for the 'Salaries' account, with no sum or interference from Proposal 'TP-2026-014''s value [RN_PLA_014]

And the same isolation applies to the totals of ancestor synthetic accounts — each Proposal/Version has its own tree of totals



✅  Scenario 4 — A new Proposal Version copies the values from the previous Version

Given Proposal 'TP-2026-014' has Version 1 with a value of R$ 1,000.00 on account 'Salaries' and totals already calculated on the ancestor synthetic accounts, fiscal year 2026

When the user creates Version 2 of this Proposal

Then the system copies, to Version 2, the value of R$ 1,000.00 on account 'Salaries' and the corresponding totals of the ancestor synthetic accounts, as a starting point

And Version 1 remains unchanged and available for consultation [RN_PLA_015]

And the audit log records the creation of Version 2 originating from Version 1



❌  Scenario 5 — Attempt to enter a value on a synthetic account [ERROR LOCK]

Given the user tries to enter a value directly on a synthetic account (N1–N6, isAnalitica=false), in any Proposal/Version

When the system renders the value selector/field

Then the value field is not displayed or is read-only for synthetic accounts [RN_PLA_012]

And, if the attempt reaches the backend by any means, the system blocks it with the alert: 'Value cannot be entered directly on a synthetic account. The value is automatically calculated by summing the child analytical accounts.'



❌  Scenario 6 — Negative or non-numeric value [ERROR LOCK]

Given the user is configuring the value of an analytical account in a Proposal/Version

When they enter a negative value (zero is allowed, negative is not) or a non-numeric value

And try to save

Then the system blocks the save

And displays the alert: 'Invalid Value: enter a monetary value greater than or equal to zero.'



✅  Scenario 7 — Querying a value from a previous fiscal year preserves history within the same Proposal/Version

Given account 'Salaries', in the current Version of Proposal 'TP-2026-014', had a value of R$ 900.00 configured in fiscal year 2025

And in fiscal year 2026 the value R$ 1,000.00 was configured, in the same Proposal/Version

When the user queries the values panel for fiscal year 2025 of this Proposal

Then the system displays R$ 900.00 for the account, with no interference from the 2026 value [RN_PLA_013]



Technical Impact (guidance for dev)

| Aspect            | Detail                                                      |
|-------------------|--------------------------------------------------------------|
| Affected tables   | New table `ValorOrcadoConta` (INSERT/UPDATE); recursive reading of `ContaContabil` (idPai/filhas) for ancestor recalculation; `HistoricoOperacao` (INSERT). Depends on Proposal/Version entities (to be confirmed with the Tech Lead — assumed `Proposta` and `PropostaVersao` already exist or need to be created in a related US) |
| Suggested model   | `ValorOrcadoConta { id, tenantId, propostaId (FK Proposta), versaoId (FK PropostaVersao), contaId (FK ContaContabil, must be isAnalitica=true), exercicio Int, valor Decimal, createdAt, updatedAt }` with `@@unique([tenantId, versaoId, contaId, exercicio])` |
| Synthetic totals  | Not persisted as their own column in this first version — calculated on demand by recursive sum of descendant leaves, for the same fiscal year and the same Proposal/Version (see Technical Note below) OR persisted and recalculated in cascade — Tech Lead's decision |
| Copy between versions | When creating a new `PropostaVersao`, copy all `ValorOrcadoConta` rows from the source version to the new version (new records, new `versaoId`), keeping the source version intact |
| Transaction?      | Yes — value insert/update + (if persisted) cascade recalculation + log in a single transaction. Version copy is also a single transaction (all accounts or none) |
| Requires lock?    | Yes, optimistic lock or serializable transaction per (versaoId, contaId) during ancestor recalculation, to avoid a race condition between two concurrent changes on the same Proposal/Version |
| Business rule     | Value is only accepted on an account with isAnalitica=true; value ≥ 0; scoped by (tenantId, propostaId, versaoId, contaId, exercicio); no read or write can leak between different propostaId/versaoId |
| Audit             | Record in `HistoricoOperacao`: actor, date, propostaId, versaoId, contaId, exercicio, previous and new value |

Technical Note (for the Tech Lead to decide): the US does not prescribe whether the synthetic account total should be persisted (a calculated column, recalculated in cascade on every change) or calculated on demand (recursive query, no persistence). This is an architecture decision — please evaluate the consistency-vs-performance trade-off before modeling. It is also up to the Tech Lead to confirm the data model for `Proposta` and `PropostaVersao` (whether they already exist in another US or need to be created as a prerequisite for this one).



Dependencies

- US-001: N7 accounts synchronized and available
- Related US (to be detailed by the PO): Proposal and Proposal Version data structure — a modeling prerequisite for this US, if it does not already exist
- Related US (to be detailed by the PO): entry of budget cost items by line item (e.g. airfare, per diems, personnel), which will write to ValorOrcadoConta using the same scope contract defined here
- Unblocks US-008a (Display Traffic Light Badge): provides the real "Budgeted Value" data for the Proposal's current Version, which the TotalizerService needs



Definition of Done — US-007

☐  Scenarios 1 through 7 implemented and approved in UAT

☐  Synthetic account totals correctly reflect the recursive sum of child analytical accounts, at every level, for the correct fiscal year and Proposal/Version

☐  Value cannot be entered on a synthetic account, neither via UI nor via backend

☐  Values from different fiscal years do not mix (isolation by fiscal year)

☐  Values from different Proposals do not mix, even using the same account and the same fiscal year (isolation by propostaId/versaoId)

☐  A new Version of a Proposal correctly copies the values from the previous Version, without changing the source Version

☐  Audit log with delta recorded, including propostaId and versaoId
