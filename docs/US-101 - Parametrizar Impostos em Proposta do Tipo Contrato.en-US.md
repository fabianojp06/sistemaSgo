US-101

Configure Taxes on a Proposal



Module:

Calculation Center — Tax Tab

Epic:

EP118/24

Profile:

Budget Analyst / GFIN

Priority:

🔴 High

Estimate:

G

Depends on:

Proposal with a current Version in RASCUNHO or EM_ELABORACAO status (ADR-012); tax rates registered in AliquotaImpostoParametro (Administration Module)



Source note (Team Debate, 2026-07-30; revised on 2026-07-31)

The original title of this US was "Configure Taxes on a Contract-type Proposal" — adjusted to "Configure Taxes on a Proposal" because the US now explicitly covers Partnership Agreement behavior as well (Scenario 5), not only Contract.

Scope revision (2026-07-31): the first version of this US used terminology from a different context (tables `tb_proposta`, `tb_rateio_imposto_grade`, `tb_historico_operacoes`, Java/JPA patterns such as `@Version` and `BigDecimal`) copied from the UC03.01 field dictionary without adapting it to the project's actual stack (Next.js/Prisma/TypeScript). Corrected to use the real entities already implemented: `Proposta` and `VersaoProposta` (ADR-012, US-007/US-008), with the status enum `RASCUNHO | EM_ELABORACAO | OFICIALIZADO | ENCERRADO` (no "Cancelled" — confirmed with the user/PO during the US-007 review).

Data grain clarified: `RateioImpostoGrade` is one row per **(Proposal version × tax × reporting month)** — not per (version × month) as the original wording vaguely suggested. Each selected tax (PIS, COFINS, ISS, or another registered via UC03.01) has its own row per month, allowing taxes to be unchecked/rechecked independently (see Scenario 3).

`AliquotaImpostoParametro` is introduced as an explicit data prerequisite: it is a **global, per-tenant** tax parameter table (not per Proposal), with temporal validity — never hardcoded in source code (RN_TAX_01, Anti-Hardcode). Pre-registered via the Administration Module or via the inline shortcut [New Tax] (UC03.01, Alt. Flow C — out of scope for this US).



As a Budget Analyst or Financial Manager (GFIN),

I want to select the taxes that apply to the Proposal (PIS, COFINS, ISS and others registered) and fill in the monthly value grid by reporting period, triggering the automatic calculation of the Global Value,

So that I can record the complete fiscal calculation memory by reporting period, ensuring precision in the Proposal's budget projection and traceability for audit purposes — respecting the tax immunity of Partnership Agreements. [RF_TAX_001, RF_TAX_002, RF_TAX_003, RN_PRO_010]



Context and Business Rules

The Tax Tab is the fiscal governance interface of the SGO's Calculation Center. Its behavior depends on the `Proposta.tipo` field:

- **Contract**: all registered taxes (PIS, COFINS, ISS, others) are available for selection. The tab injects the tax rates in effect from `AliquotaImpostoParametro` as of the Proposal's start date (`Proposta.dataInicio`) and opens the monthly grid for entering values by reporting period, covering every month between `dataInicio` and `dataFim`.
- **Partnership Agreement** (`TipoProposta.TERMO_DE_PARCERIA`): PIS and COFINS are automatically zeroed and locked due to promotional tax immunity (RN_PRO_010) — they do not appear as editable options. Only ISS remains configurable.

The tax engine processes the data and synchronously updates the Proposal's Global Value. The entire operation is atomic: batch upsert of the grid + Global Value update + audit log in a single transaction. [RN_TAX_01, RN_TAX_02, RNF_TAX_001, RNF_TAX_005]

The grid is only editable while the Proposal's current Version is in `RASCUNHO` or `EM_ELABORACAO` status; once `OFICIALIZADO`, the fiscal data freezes (RN_TAX_03), consistent with the same immutability pattern already applied to `ValorOrcadoConta` (US-007) and the Traffic Light thresholds (US-008).



Acceptance Criteria — US-101

✅  Scenario 1 — Complete tax configuration and successful save on a Contract

Given the user is authenticated with write access to the budget module

And the Proposal is of type CONTRATO and its current Version is in RASCUNHO or EM_ELABORACAO status

And the PIS (9.25%), COFINS (7.60%) and ISS (3.00%) rates are registered and in effect in AliquotaImpostoParametro for this tenant

When the user accesses Calculation Center > Tax Tab of the Proposal

Then the system renders the PIS, COFINS and ISS checkboxes with the rates in effect automatically injected [RN_TAX_01]

And the monthly grid is displayed covering every month between the Proposal's `dataInicio` and `dataFim`

When the user checks the PIS and ISS checkboxes, fills in every month with values (none left blank) and clicks [Save]

Then the system runs the synchronous validations (RN_TAX_01 through RN_TAX_04) with no inconsistencies found

And persists one row in RateioImpostoGrade per (versaoId, tax, reporting period) with `aliquotaAplicadaSnapshot` = the rate in effect at the time of saving [RN_TAX_03]

And the totalization service recalculates and updates the Proposal's Global Value (a read-only field, [SHIELDED ORIGIN])

And the total operation time does not exceed 2.0 seconds for up to 1,000 grid rows [RNF_TAX_001]

And an audit log is written to HistoricoOperacao with the previous and new state, usuarioId and timestamp [RNF_TAX_005]

And the system displays the success message and keeps the screen open for continuity



✅  Scenario 2 — Opening the tab looks up the rate in effect as of the Proposal's start date

Given the Proposal has `dataInicio` on 03/01/2025

And the ISS rate in effect on 03/01/2025 is 3.00%, with a new rate of 4.00% taking effect from 01/01/2026

When the user opens the Tax Tab of this Proposal

Then the system injects the ISS rate = 3.00% (in effect as of the start date) [RN_TAX_01]

And the 4.00% rate is neither displayed nor applied to this Proposal



✅  Scenario 3 — Unchecking a tax removes its values from the grid and the Global Value

Given the PIS and ISS taxes are checked and saved in the fiscal grid of the Proposal's current Version

When the user unchecks the PIS checkbox and clicks [Save]

Then the system removes (or marks as inactive) all RateioImpostoGrade rows for the PIS tax under this versaoId

And the totalization service recalculates the Global Value excluding the PIS values

And the audit log records the change, including the removed tax



❌  Scenario 4 — Attempt to save on an Officialized Proposal Version [ERROR LOCK]

Given the Proposal's current Version is in OFICIALIZADO status

When the user tries to modify any cell or save the tax grid

Then the backend rejects the commit with an immediate rollback [RN_TAX_03]

And the system displays: "Operation Denied [ERROR LOCK]: This Proposal is officialized and its fiscal data is frozen. No changes are allowed."

And no data is changed in the database



✅  Scenario 5 — Partnership Agreement automatically zeroes and locks PIS and COFINS [RN_PRO_010]

Given the Proposal is of type TERMO_DE_PARCERIA

When the user accesses the Tax Tab of this Proposal

Then the PIS and COFINS checkboxes appear unchecked and disabled, with no rate displayed

And the ISS checkbox appears normally, available for selection and configuration

When the user tries, by any means (including a direct backend call), to enable PIS or COFINS for this Proposal

Then the system blocks the operation and displays: "Partnership Agreements have tax immunity — PIS and COFINS cannot be applied (RN_PRO_010)."

And no RateioImpostoGrade row is created for PIS/COFINS under this versaoId



Technical Impact (guidance for dev)

| Aspect            | Detail                                                      |
|-------------------|--------------------------------------------------------------|
| Affected tables   | New: `AliquotaImpostoParametro` (global per-tenant parameter, with validity period), `RateioImpostoGrade` (grain: versaoId × tax × reporting period). Read/update: `Proposta` (type, status via VersaoProposta), `HistoricoOperacao` (INSERT) |
| Suggested model — AliquotaImpostoParametro | `{ id, tenantId, nome, aliquotaPct Decimal, dataInicioVigencia DateTime, tipoIncidencia enum(CONTRATO\|TERMO_DE_PARCERIA\|AMBOS), createdAt, updatedAt }` — `@@unique([tenantId, nome])` case-insensitive (RN_TAX_05, see UC03.01) |
| Suggested model — RateioImpostoGrade | `{ id, tenantId, versaoId (FK VersaoProposta), aliquotaParametroId (FK AliquotaImpostoParametro), competencia DateTime (first day of the month), valorDeclarado Decimal, aliquotaAplicadaSnapshot Decimal, createdAt, updatedAt }` — `@@unique([tenantId, versaoId, aliquotaParametroId, competencia])` |
| Transaction?      | Yes — batch upsert of the grid + Global Value update + audit log in a single transaction. Full rollback on failure |
| Requires lock?    | Yes — same per-`versaoId` transaction pattern already adopted in US-007 (`ConfigurarValorOrcadoContaUseCase`), to avoid a race condition between two concurrent edits of the same Version |
| Business rule     | PIS/COFINS locked for TERMO_DE_PARCERIA (RN_PRO_010); rate always a snapshot taken at save time (RN_TAX_03); grid only editable on a RASCUNHO/EM_ELABORACAO version; no blank cell allowed when saving (RN_TAX_04) |
| Audit             | Record in `HistoricoOperacao`: tenantId, usuarioId, versaoId, changed tax(es), reporting period, previous and new value |

Technical Note (for the Tech Lead to decide): confirm whether `RateioImpostoGrade` needs a performance index for queries by `(tenantId, versaoId)` (the same batch read of the entire grid), and review the locking strategy (US-007 used a per-`versaoId` transaction, with no explicit `SELECT FOR UPDATE` — assess whether this US needs something stronger given the potential volume of 1,000 rows per grid).



Dependencies

- Proposta/VersaoProposta (ADR-012) — already implemented (US-007, US-008)
- AliquotaImpostoParametro needs to be modeled as a prerequisite of this very US (it is not a separate US — it is parameterization data, analogous to the Traffic Light's default thresholds, ADR-013)
- Partially unblocks US-008a (Budget Traffic Light): RateioImpostoGrade is one of the sources of `valorRealizado` (see the revised blocking note in US-008a)



Definition of Done — US-101

☐  Scenarios 1 through 5 implemented and approved in UAT

☐  Rate correctly injected based on the Proposal's `dataInicio` (not the current date)

☐  Totalization service updates the Proposal's Global Value after each save (validated by database inspection)

☐  Operation ≤ 2.0s validated with a 1,000-row grid

☐  Audit log recorded with all required fields

☐  Partnership Agreement natively blocks PIS/COFINS, without relying only on frontend validation

☐  Attempted edit on an Officialized Version blocked on the backend (not only in the UI)
