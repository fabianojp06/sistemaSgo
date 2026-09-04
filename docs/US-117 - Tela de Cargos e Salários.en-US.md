## [US-117] — Roles and Salaries Screen

**Module:** Registrations — Roles and Salaries (UC03.19, UC03.24-27)
**Epic:** EP118/24
**Priority:** High
**Estimate:** G
**Provenance note:** document reconstructed retroactively on 2026-08-13 — implemented on 2026-08-06 (commit `347b7ef`, same delivery as US-116) and evolved over 3 rounds of real manual test feedback in the same session (commits `96fce36`, `ab22790`, `d2951d2`), but never got its own file in `docs/`. Reconstructed from `CONTEXTO_SESSOES.md` (2026-08-06 section, 14:18–21:11 UTC).

**As a** Regular User (GFIN),
**I want** a dedicated screen to create/edit Roles (with percentage apportionment between Functional Units and benefits) and enter Employee Headcount in bulk,
**So that** US-107/US-107a/US-108/US-108a/US-112/US-113 (all already implemented in the backend since 2026-08-03/04, with no UI) finally become operable by the end user.

### Context and Business Rules

Closes the project's biggest "backend ahead of the UI" gap (5 entire US with only a use case/Server Action, no screen). "Roles" sub-tab (`CargoPanel.tsx`) on the same `/propostas/{id}/estrutura` route as US-116.

**ADR-028 (point 2 of feedback #1):** the screen has 2 save sections (Role data + Benefits) — the Tech Lead's decision was **not to merge** `CadastrarCargoUseCase`/`ConfigurarBeneficiosCargoUseCase` into a single use case; orchestration happens only in the Server Action (`salvarCargoCompleto`), with a partial-error contract (Role is saved even if Benefits fails).

**US-108b (formalized during testing, point (a) of feedback #1):** entering the number of vacancies per Role in bulk, not one at a time — `CadastrarEmpregadosEmLoteUseCase`.

**US-113b (formalized during testing, point (a) of feedback #2):** Employee Headcount consolidation showing the total value (quantity × cost × contract duration), with a per-Employee period overlap formula (`calcularValorTotalConsolidado.ts`) — not a simple multiplication, each Employee in the batch can have a different period.

**UX improvements added during testing (feedback #3, directly in chat):**
- Consolidation Document Number generated automatically (`gerarNumeroDocumentoQtdeEmpregado.ts`, format `C-XXX`, sequential per Proposal).
- Employee list becomes a tree grouped by Role (`EmpregadosPorCargoArvore`), expand/collapse, instead of a flat list.

### Acceptance Criteria

**Scenario 1 — Register a Role with percentage apportionment between Functional Units**
```gherkin
Given 2 Analytical Functional Units exist in the Proposal
When the user registers a Role with a 60%/40% apportionment between them (CargoAlocacaoPercentual, ADR-026)
Then the system requires the sum of the percentages to be exactly 100%
And persists the Role with the 2 allocations
```

**Scenario 2 — Save the Role's data even if Benefits fails**
```gherkin
Given the user fills in valid Role data and invalid Benefits data
When they trigger "Save" on the screen
Then the Role is saved (CadastrarCargoUseCase)
And the Benefits error is reported separately, without undoing the already-saved Role
```

**Scenario 3 — Enter Employee Headcount in bulk (US-108b)**
```gherkin
Given the user wants to register 11 vacancies for the same Role
When they enter the quantity in bulk instead of 11 individual registrations
Then the system creates 11 EmpregadoHeadcount records at once, each with its own possibly distinct period
And the Employee Headcount consolidation (US-113b) sums the total value considering each period's overlap with the Proposal's term
```

**Scenario 4 — Document Number generated automatically**
```gherkin
Given the user is creating a new Employee Headcount consolidation document
When they save without typing a Document Number
Then the system automatically generates the next sequential "C-XXX" within the Proposal
And guarantees uniqueness via @@unique([tenantId, propostaId, numeroDocumento]), with retry on collision
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `Cargo`, `CargoAlocacaoPercentual`, `EmpregadoHeadcount`, `QtdeEmpregado` (no schema change in this US, except the US-108b/113b fields below) |
| Migrations applied | `add_empregados_lote_cadastrado_enum`, `add_qtde_empregado_valor_total_consolidado`, `add_qtde_empregado_numero_documento_unique` |
| New Server Action | `salvarCargoCompleto` (orchestrates 2 use cases, partial-error contract) |
| New pure functions | `gerarNumeroDocumentoQtdeEmpregado.ts`, `calcularValorTotalConsolidado.ts` |
| Audit trail | `HistoricoOperacao` covers creation of Role, Benefits, Employee batch and consolidation |

### Dependencies

- US-107, US-107a, US-108, US-108a, US-112, US-113 (all the HR backend already implemented, no UI)
- US-116 (same route, sibling sub-tab)

### Definition of Done

- [x] Roles screen with percentage apportionment and benefits live
- [x] US-108b (Employee batch) and US-113b (consolidation with overlap) implemented in the same session
- [x] Document Number generated automatically with guaranteed uniqueness
- [x] Employee tree grouped by Role
- [x] Manually tested by the user in the browser (3 rounds of real feedback, all fixed)
- [x] 239 tests passing at the end of the session, clean `tsc --noEmit`
