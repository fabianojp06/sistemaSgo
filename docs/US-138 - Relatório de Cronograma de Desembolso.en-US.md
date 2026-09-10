
US-138 — Disbursement Schedule Report (Consolidated by Partnership Agreement)

**Module:** Budget
**Epic:** EP48/26 — Budget Module
**Priority:** Medium
**Status:** Implemented — commit pending, branch `feature/us-138-relatorio-cronograma-desembolso`

**As a** Common User or Financial Manager (GFIN),
**I want** to view a consolidated Disbursement Schedule report for an Officialized Partnership Agreement, with filters by Amendment and Fiscal Year, and export it to PDF/XLSX with an audit trail,
**So that** I can track the contract's financial health and issue an official document for the comptroller's office/audit, without having to open the Proposal and navigate to its internal tab.

## Context and origin

Based on the document `docs/Cronograma de Desembolso-VersaoUsuarioFinal.docx` (attached by the user on 2026-08-20). This is a **new** feature, distinct from the "Disbursement Schedule" tab that already exists inside the Proposal detail view (US-122/UC04.01, `propostas/[id]/cronograma-desembolso`):

| | US-122 (existing tab) | US-138 (report, this US) |
|---|---|---|
| Where | Tab inside the detail of an already-open Proposal | Dedicated page, reached from a card on the `/orcamentario` landing page |
| Proposal selection | Implicit (already the open Proposal) | Explicit, via combo box — only `status = OFICIALIZADO` |
| Filters | None | Amendment (informational), Fiscal Year (trims the displayed months) |
| Final Totals row | Does not have one | Has one (Scenario 5) |
| Audit | None found in the code | Writes `HistoricoOperacao` on every export (Print/PDF/XLSX), BEFORE releasing the file |

## AN/PO decisions (authorized by the user at the assistant's discretion, 2026-08-20)

1. **Position on screen:** a new card on the `/orcamentario` landing page, not a separate "Report Manager" menu (which does not exist in the system).
2. **"GFIN"** is already an established term in the project (Financial Manager), a synonym for Budget Analyst — no gap.
3. **"Amendments"** mapped to `TermoAjuste` (US-111/UC03.13) with `status = HOMOLOGADO`. Deliberately narrow scope: the filter is only **informational** (it appears in the report header) — there is no specified rule for how an approved Amendment should change the month-by-month distribution of the schedule, and inventing that rule would be a bigger risk than value.
4. **Fiscal Year** is in v1 — it trims the months already calculated for the Proposal's full validity period (Accumulated Disbursement and Accumulated Financial % continue to be calculated against the global total, not the total of the filtered fiscal year).
5. **"Month N" naming** kept identical to the US-122 tab (the original document asked for "Code T"/T1, T2 — a deliberate decision to keep consistency between the two screens instead of introducing a second convention).
6. **Audit only on export** (Print/PDF/XLSX), not on every view — consistent with the pattern used across the rest of the system (audits writes/exports, not reads).
7. **A failure to write the audit record blocks the download** (Scenario 8) — a deliberate compliance-over-availability trade-off.
8. New Feature: `orcamentario.cronograma-desembolso-relatorio.visualizar`.

## Acceptance Criteria — BDD/Gherkin

See the full text of the 9 scenarios in the original refinement conversation (2026-08-20) — summary:
1. Successful generation (happy path).
2. Filter by Amendment (informational only, in the header).
3. Filter by Fiscal Year.
4. Automatic fill-in (no year filter = full validity period).
5. Final Totals row.
6. Block — Partnership Agreement not selected.
7. Block — Proposal without financial data.
8. Block — failure to write the audit trail on export.
9. Successful PDF/XLSX export (audit record written before download).

## Technical impact (as implemented)

| Aspect | Detail |
|---|---|
| Migration | `20260820150000_add_relatorio_cronograma_desembolso_exportado_enum` — `ALTER TYPE "TipoOperacao" ADD VALUE 'RELATORIO_CRONOGRAMA_DESEMBOLSO_EXPORTADO'`. **Created but not applied in production** — pending `/code-review` and the user's decision on when to run `prisma migrate deploy` (the environment's DATABASE_URL points to production). |
| New use case | `RegistrarExportacaoRelatorioCronogramaUseCase` (writes `HistoricoOperacao`; propagates `FalhaAuditoriaExportacaoRelatorioError` if the INSERT fails) |
| New errors | `FalhaAuditoriaExportacaoRelatorioError`, `RelatorioCronogramaDesembolsoSemPropostaError` (`src/domain/plano-contas/errors.ts`) |
| New Server Action | `registrarExportacaoCronogramaAction` (`src/app/(autenticado)/orcamentario/cronograma-desembolso-relatorio/actions.ts`) |
| New page | `src/app/(autenticado)/orcamentario/cronograma-desembolso-relatorio/page.tsx` — GET form with filters (Partnership Agreement/Amendment/Year), reuses `montarCronogramaDesembolso` (same calculation engine as US-122) |
| New component | `RelatorioCronogramaDesembolsoPanel.tsx` — variant of `CronogramaDesembolsoPanel.tsx` (US-122) with a Final Totals row and export gated by the audit write |
| New Feature (seed) | `orcamentario.cronograma-desembolso-relatorio.visualizar` (`prisma/seed.mjs`) — automatically granted to the Administrator |
| Card on the landing page | `/orcamentario/page.tsx` — "Disbursement Schedule Report" card, visible only with the permission above |

## Pending items before merge

- [x] Migration applied in production (`prisma migrate deploy`, 2026-08-20, authorized by the user)
- [x] Seed run (2026-08-20, authorized by the user) — `Funcionalidade` linked to the Administrator profile
- [x] `/code-review` (high) run on the branch — 2 high-severity findings fixed (see below), 1 medium and 4 minor logged for later
- [ ] Manual on-screen validation (authenticated screenshot) before considering it complete

## `/code-review` findings (2026-08-20) and resolution

| Severity | Finding | Resolution |
|---|---|---|
| High | `registrarExportacaoCronogramaAction` did not check permission before writing the audit record — any user in the tenant could forge an entry in the trail | **Fixed** — the action now calls `usuarioTemFuncionalidade` before the use case |
| High | The `status: 'OFICIALIZADO'` filter makes the screen unreachable, since no current path in the system transitions a Proposal to that status (pre-existing gap, out of scope for this US) | **Mitigated in 2 steps by the user's decision:** first widened to `{ in: ['OFICIALIZADO', 'EM_ELABORACAO'] }` (2026-08-20); then, with real production data showing that even that was not enough (screenshot attached to the conversation — the combo box remained empty), **removed entirely** (2026-08-20) — the report now accepts a Proposal of **any status** (`RASCUNHO`/`EM_ELABORACAO`/`OFICIALIZADO`/`ENCERRADO`). **Technical debt logged:** once an "Officialize Proposal" feature exists, revisit whether the filter should go back to restricting by status (the block message in Scenario 6 still literally reads "Officialized Partnership Agreement" in the document text, but there is no longer such a restriction in practice — it only requires that some Partnership Agreement be selected) |
| Medium | Scenario 7 (proposal without financial data) does not trigger when the Proposal has no current/active `VersaoProposta` — the screen ends up blank | **Not fixed yet** — pending |
| Low (4) | Code duplication between the two Disbursement Schedule panels; `termoAditivoId` writes `""` instead of `null` to the audit record when "All" is selected; the `RelatorioCronogramaDesembolsoSemPropostaError` error class is dead code; the `propostaId` prop is unused in the panel; sequential queries instead of `Promise.all` on the landing page | **Not fixed yet** — pending, no security/correctness risk |
