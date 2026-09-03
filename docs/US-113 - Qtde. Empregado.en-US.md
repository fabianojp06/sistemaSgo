## [US-113] — Maintain Employee Headcount

**Module:** Registrations — Employees (Quantitative Consolidation)
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As a** Regular User,
**I want** to formally consolidate, by period of validity and supporting document (Addendum/Amendment), the number of active Employees, Interns, and Young Apprentices of a Proposal,
**So that** there is an auditable headcount history by period, with the quantities always calculated by actual count — never typed in — and subject to the same integrity locks already applied to the Employees module.

### Context and Business Rules

Covers UC03.20 to UC03.23 of Draft Spec V5 (Maintain/Create/Update/Delete Employee Headcount). This is a **consolidation/snapshot** screen, not a cost-entry screen: it does not create or edit `EmpregadoHeadcount`, it only formally records, with a date and an official document, what the count of active headcounts per category was in that interval.

The 3 quantitative fields (`quantidadeEmpregados`, `quantidadeEstagiarios`, `quantidadeJovemAprendiz`) are **SHIELDED ORIGIN** [RN0457]: calculated by `COUNT` over active `EmpregadoHeadcount`, grouped by `categoria`, at the time of creation — never accepted as input. The only fields typed by the user are **Start Period**, **End Period**, and **Document Number**.

**⚠️ Finding that blocks the modeling — needs a Tech Lead decision before coding:**

`EmpregadoHeadcount` has `propostaId` (direct FK to `Proposta`), **not** `versaoId`/`metaId` like `Viagem` and `ItemPatrimonial` (ADR-022/ADR-023). This breaks the pattern that US-113 would need to follow for "Goal (if any)" from the Draft Spec (RN0148/RN0152: grouping by Goal only exists if the Proposal is `POR_META`):

- There is currently no column on `EmpregadoHeadcount` linking a headcount to a specific `Meta` — so "COUNT of active headcounts for a Goal" is not a query possible under the current schema, only "COUNT of active headcounts for the entire Proposal".
- `EmpregadoHeadcount` is also not scoped by `VersaoProposta` — it is scoped directly by `Proposta`. This has been the case since US-108 (ADR-018) and was not changed by any later US.

**User decision (2026-08-04): fix the structural gap first.** `EmpregadoHeadcount` gains a `metaId` (nullable, required only when `Proposta.categoria=POR_META`, the same pattern as `Viagem`/`ItemPatrimonial`), aligning it with the rest of the cost domain. This is a retroactive change to `EmpregadoHeadcount` (US-108/ADR-018) — it is up to the Tech Lead to formalize, in an ADR, the migration of already-existing records (headcounts registered before this US, without `metaId`) and the impact on the `Cadastrar/Editar/ExcluirEmpregadoUseCase` use cases.

**Additional finding (2026-08-04) — adjusted scope:** `CadastrarEmpregadoUseCase` (US-108) currently blocks any Proposal with `categoria≠CONSOLIDADA` (`EmpregadoForaDeEscopoCategoriaError`). Without removing that restriction, `metaId` would never have a real value — an Employee simply could not exist on a `POR_META` Proposal. **User decision: also unlock Employee for `POR_META` Proposals in this same round**, with `metaId` automatically derived from the version's 1:1 Goal (the same pattern as `CadastrarViagemUseCase`), making Scenario 8 below actually exercisable.

**Additional inherited gap (same pattern already accepted in US-109/US-112):** RN0145/E2 of the Draft Spec ask to block deletion if there are "issued per diems, advances, or active travel" linked to the period's headcounts. There is no Per Diem/Advance module, and `Viagem` has no FK to an individual `EmpregadoHeadcount` (it is by Goal). Proposal: **do not implement this check in this US** — the same simplification already applied to `ExcluirViagemUseCase`/`ExcluirMetaUseCase`, which only check `Proposta.status`.

### Acceptance Criteria

**Scenario 1 — Consolidate employee headcount with a calculated count**
```gherkin
Given Proposal "PROP-2026-0001" is in RASCUNHO
And it has 8 active EmpregadoHeadcount: 5 category EMPREGADO, 2 ESTAGIARIO, 1 JOVEM_APRENDIZ
When the user creates an Employee Headcount with:
  | Start Period    | 2026-01-01 |
  | End Period      | 2026-06-30 |
  | Document Number | APOST-2026-014 |
Then the system calculates quantidadeEmpregados=5, quantidadeEstagiarios=2, quantidadeJovemAprendiz=1 [SHIELDED ORIGIN]
And persists the record with these values, never accepted as direct input
And a `QTDE_EMPREGADO_CADASTRADA` audit record is written to HistoricoOperacao
```

**Scenario 2 — Block: period outside the Proposal's validity**
```gherkin
Given Proposal "PROP-2026-0001" has dataInicio=2026-01-01 and dataFim=2026-12-31
When the user tries to create an Employee Headcount with End Period = 2027-03-31
Then the system blocks the save [RN0154]
And displays the message "Period cannot extend beyond the Proposal's validity."
```

**Scenario 3 — Block: overlapping periods on the same Proposal**
```gherkin
Given an active Employee Headcount already exists on Proposal "PROP-2026-0001" with period 2026-01-01 to 2026-06-30
When the user tries to create a new Employee Headcount with period 2026-05-01 to 2026-08-31 (overlapping)
Then the system blocks the save [RN0155]
And displays the message "An overlapping consolidation period already exists for this Proposal."
```

**Scenario 4 — Block: required fields left blank [HARD ERROR]**
```gherkin
Given the user is creating an Employee Headcount
When they try to save without Start Period, End Period, or Document Number
Then the system blocks the save [RN0153]
And displays the message "Start Period, End Period, and Document Number are required."
```

**Scenario 5 — Updating Employee Headcount recalculates the quantities**
```gherkin
Given an Employee Headcount exists with quantidadeEmpregados=5 (calculated on 2026-01-10)
And, since then, 2 more EmpregadoHeadcount of category EMPREGADO were created and activated on the Proposal
When the user updates the record's Document Number (the only field besides the period)
Then the system recalculates quantidadeEmpregados=7 at the time of the update [SHIELDED ORIGIN]
And a `QTDE_EMPREGADO_EDITADA` audit record is written with the prior and new values
```

**Scenario 6 — Block: update/delete on a Proposal outside RASCUNHO/EM_ELABORACAO [HARD ERROR]**
```gherkin
Given the linked Proposal has status OFICIALIZADO
When the user tries to update or delete an Employee Headcount record
Then the system blocks the operation [RN0159]
And displays the message "Cannot change Employee Headcount of an approved or closed Proposal."
```

**Scenario 7 — Delete Employee Headcount (soft delete)**
```gherkin
Given an active Employee Headcount record exists on a RASCUNHO Proposal
When the user confirms the deletion
Then the system marks ativo=false (soft delete)
And a `QTDE_EMPREGADO_EXCLUIDA` audit record is written to HistoricoOperacao
```

**Scenario 8 — Consolidation on a POR_META Proposal groups only the headcounts of the linked Goal**
```gherkin
Given Proposal "PROP-2026-0002" is POR_META, with single Goal "M1"
And there are 4 active EmpregadoHeadcount with metaId="M1" (3 EMPREGADO, 1 ESTAGIARIO)
And there are 2 active EmpregadoHeadcount from another Proposal, unrelated to "M1"
When the user creates an Employee Headcount for Proposal "PROP-2026-0002"
Then the system automatically links metaId="M1" (the version's same 1:1 Goal)
And calculates quantidadeEmpregados=3, quantidadeEstagiarios=1, counting only headcounts with metaId="M1"
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | New model `QtdeEmpregado`: `id`, `tenantId`, `propostaId` (FK `Proposta`), `metaId` (FK `Meta`, nullable — required only if `Proposta.categoria=POR_META`), `periodoInicio`, `periodoFim`, `numeroDocumento`, `quantidadeEmpregados` (Int, calculated), `quantidadeEstagiarios` (Int, calculated), `quantidadeJovemAprendiz` (Int, calculated), `ativo` (soft delete), `createdAt`, `updatedAt`. **Retroactive change to `EmpregadoHeadcount`**: add `metaId` (FK `Meta`, nullable, same conditional rule) — the migration of existing records is up to the Tech Lead's ADR |
| Transaction? | Yes — COUNT + persistence in the same transaction |
| Requires lock? | No — same transactional simplicity as Cargo/Viagem/Meta/ItemPatrimonial |
| Audit | `QTDE_EMPREGADO_CADASTRADA`, `QTDE_EMPREGADO_EDITADA`, `QTDE_EMPREGADO_EXCLUIDA` in `HistoricoOperacao` |
| Business rule | Quantities always recalculated via COUNT, never accepted as direct input; period within the Proposal's validity; no overlapping periods on the same Proposal; update/delete only in RASCUNHO/EM_ELABORACAO |

### Dependencies

- **US-108 (EmpregadoHeadcount)**: satisfied as the source of the count data, but requires a retroactive change (adding `metaId`) before this US can be implemented.
- **US-112 (Meta)**: satisfied — reuses the same optional 1:1 Goal per version.
- **Tech Lead ADR**: formalize the addition of `metaId` to `EmpregadoHeadcount` and the migration strategy for existing records, before dev starts.

### Definition of Done

- [ ] Tech Lead ADR on `metaId` in `EmpregadoHeadcount` approved
- [ ] Acceptance criteria 1 to 8 implemented and tested
- [ ] Quantities always calculated by COUNT in the backend, never accepted as direct input
- [ ] Tested with a period outside the Proposal's validity (must block)
- [ ] Tested with overlapping periods (must block)
- [ ] Tested with a Proposal outside RASCUNHO/EM_ELABORACAO on update/delete (must block)
- [ ] Deletion tested as soft delete
