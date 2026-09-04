## [US-118] — Budgeted Value tab becomes the Proposal's summary dashboard

**Module:** Chart of Accounts / Budgeted Value
**Epic:** EP118/24 — Registrations Module
**Priority:** Medium
**Estimate:** M

**As a** user responsible for a Proposal's budget,
**I want** the "Budgeted Value" tab to be the main source of information on how much has already been budgeted in the project,
**So that** I have, on a single screen, the total budgeted amount, the breakdown by synthetic/analytical account and the workforce overview, without needing to navigate between tabs to build this picture.

### Context and Business Rules

Today the "Budgeted Value" tab is just the entry form (`ValorOrcadoContaForm.tsx`): 1 analytical account + 1 fiscal year + 1 value at a time, with no consolidated view. The user requested that it now display:

1. **Global Value** — the same concept already existing in `Meta.valorGlobal` (US-112/ADR-017): the sum of all analytical accounts with a value entered in `ValorOrcadoConta`, across all fiscal years, for the current Version. In a `POR_META` Proposal, `Meta.valorGlobal` already mirrors this value — it can be read directly when a Meta exists. In a `CONSOLIDADA` Proposal (without a Meta), the same total must be calculated directly from the sum of `ValorOrcadoConta`, using the same formula, so the screen works for both categories.
2. **Synthetic accounts with an aggregated total**, in an expandable (dropdown) structure: each synthetic account shows the sum of its child analytical accounts' values; when expanded, it lists the child analytical accounts and their individual values. Only synthetic accounts with at least one child analytical account with an entered value are included (zeroed accounts stay hidden — the same philosophy already applied in the Traffic Light and the ranking chart).
3. **Number of Proposal Employees** — count of active (`ativo: true`) `EmpregadoHeadcount` records, the same number as the "Total Employees" KPI on the Employees tab.
4. The row-by-row entry form (`ValorOrcadoContaForm.tsx`) continues to exist, now as part of this larger screen rather than the entire screen.

### Acceptance Criteria

**Scenario 1 — Global Value in a Por Meta Proposal**
```gherkin
Given the Proposal is category POR_META and the current Version has a registered Meta
When the user opens the Budgeted Value tab
Then the displayed Global Value equals Meta.valorGlobal
```

**Scenario 2 — Global Value in a Consolidated Proposal**
```gherkin
Given the Proposal is category CONSOLIDADA (without a Meta)
And there are entries in ValorOrcadoConta totaling R$ 50,000 across 2 fiscal years
When the user opens the Budgeted Value tab
Then the displayed Global Value is R$ 50,000, calculated directly from the sum of ValorOrcadoConta
```

**Scenario 3 — Expandable synthetic accounts, only those with a value**
```gherkin
Given there are 3 synthetic accounts in the Chart of Accounts, but only 2 have some child analytical account with an entered value in this Version
When the user opens the Budgeted Value tab
Then only the 2 synthetic accounts with a value appear in the list
And each one shows the aggregated total (sum of the child analytical accounts)
And when a synthetic account is clicked/expanded, the list of child analytical accounts with their individual values is displayed
```

**Scenario 4 — Number of Employees**
```gherkin
Given the Proposal has 5 active EmpregadoHeadcount records and 2 inactive (removed)
When the user opens the Budgeted Value tab
Then the displayed number of Employees is 5
```

**Scenario 5 — Entry form remains functional**
```gherkin
Given the user is on the Budgeted Value tab, with the Version editable
When the user enters a new budgeted value for an analytical account/fiscal year
Then the value is saved normally (ConfigurarValorOrcadoContaUseCase, with no rule change)
And the Global Value and the synthetic account list are recalculated/updated alongside it
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | None new — reads `ValorOrcadoConta`, `Meta`, `ContaContabil` (tree), `EmpregadoHeadcount` |
| New calculation | Global Value: reuse the existing `ValorOrcadoTotalizerService` (used by `ConfigurarValorOrcadoContaUseCase` to recalculate ancestors) — or expose a new pure read method, without duplicating the account-hierarchy aggregation logic |
| Transaction? | No — this is a read-only/dashboard screen, no new writes |
| Audit trail | Not applicable (no new writes) |
| Business rule | Hide synthetic accounts with no child analytical account with an entered value |

### Dependencies

- US-007 (`ConfigurarValorOrcadoContaUseCase`, already implemented)
- US-112 (`Meta.valorGlobal`, already implemented)
- US-108 (`EmpregadoHeadcount`, already implemented)

### Definition of Done

- [ ] Acceptance criteria 1-5 implemented
- [ ] Clean `tsc --noEmit`, clean lint
- [ ] Automated tests for the Global Value calculation in both categories (POR_META and CONSOLIDADA)
- [ ] Manually tested in the browser by the user
