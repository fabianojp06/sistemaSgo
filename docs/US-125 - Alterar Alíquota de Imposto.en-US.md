## [US-125] — Edit Tax Rate

**Module:** Registrations — Tax Rates
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As an** Administrator or Budget Analyst with write permission in Registrations,
**I want** to edit an existing tax rate without affecting already-Officialized Proposals,
**So that** I can correct/update fiscal parameters while preserving the budgetary immutability of already-frozen snapshots.

### Context and Business Rules

Covers UC03.41. Central rule [RN_TAX_03/RN_TAX_06], already validated in production by the existing behavior of `RateioImpostoGrade.aliquotaAplicadaSnapshot`: changing `AliquotaImpostoParametro.aliquotaPct` **never** recalculates Officialized Proposals — the snapshot recorded in the allocation is immutable. This US only formalizes the editing screen/validations for the global parameter; the snapshot mechanism already exists since US-101/ADR (`ConfigurarRateioImpostoUseCase` writes `aliquotaAplicadaSnapshot` at the moment of allocation).

Requires Optimistic Locking (RNF_TAX_006) via the `version` field (added in ADR-038/US-124) — the same pattern already used in `ValorOrcadoConta`/`RateioImpostoGrade` (US-105).

### Form Fields (Editing)

Same fields as US-124 (Register), all editable, including `contaSinteticaId` (suggestion, ADR-038). No locked field — unlike other entities in the system (e.g., the Position's Real Salary), there is no Read-only field here.

### Acceptance Criteria

**Scenario 1 — Successful edit**
```gherkin
Given the tax rate "PIS" exists with aliquotaPct = 0.65 and version = 0
When the user changes the Default Rate to 1.65
And clicks [Save]
Then the system persists the change via UPDATE and increments version to 1 [RNF_TAX_006]
And writes a delta log entry ALIQUOTA_IMPOSTO_EDITADA in HistoricoOperacao with the previous and new state [RN0232]
And already-Officialized Proposals that used "PIS" keep their aliquotaAplicadaSnapshot unchanged [RN_TAX_03]
```

**Scenario 2 — Impact warning for in-progress Proposals (non-blocking)**
```gherkin
Given the tax rate "ISS" is referenced in RateioImpostoGrade of a Proposal with status EM_ELABORACAO
When the user opens the editing form for that tax rate
Then the system displays the warning "Attention: This tax rate is being used in in-progress Proposals. Changes will affect new saves on those Proposals, but will NOT recalculate already-Officialized Proposals." [RN_IMP_008]
And the form remains editable (the warning does not block saving)
```

**Scenario 3 — Concurrency conflict (Optimistic Lock) [ERROR LOCK]**
```gherkin
Given two users open the editing form for the same tax rate "COFINS" (version = 2)
When User A saves first (version moves to 3)
And User B then tries to save while sending version = 2
Then the system rejects the request with HTTP 409 and the message "Edit Conflict [ERROR LOCK]: Another user has modified this record simultaneously. Reload before proceeding." [RNF_TAX_006]
And none of User B's changes are persisted
```

**Scenario 4 — Blocked: duplicate name while editing**
```gherkin
Given the tax rates "ISS" and "IOF" exist
When the user edits "IOF" and tries to rename it to "iss" (case-insensitive)
Then the system blocks the operation with the same message as US-124 Scenario 2
And no change is persisted
```

**Scenario 5 — Blocked: ISS outside the legal range while editing**
```gherkin
Given the user is editing the tax rate "ISS"
When they change the value to 1.50
And click [Save]
Then the system blocks the operation with the same message as US-124 Scenario 3
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `AliquotaImpostoParametro` (UPDATE) |
| Fields changed | All fields from US-124, plus `version` (incremented on every UPDATE) |
| Transaction? | Yes — UPDATE conditional on `version` + delta log within the same transaction [RN0232] |
| Requires lock? | Yes — Optimistic Locking via `version`, same pattern as US-105 |
| Audit trail | `ALIQUOTA_IMPOSTO_EDITADA`, payload with previous × new state |
| Business rule | RN_TAX_03 (immutability of the Officialized snapshot), RN_TAX_06 (retroactive isolation), RN_IMP_008 (non-blocking warning), RNF_TAX_006 (Optimistic Locking) |

### Dependencies

- **ADR-038 / US-124**: the `version` field and other schema fields must exist.
- **US-123 (Maintain)**: source screen ([Edit] button).

### Definition of Done

- [ ] Acceptance criteria 1 to 5 implemented and tested
- [ ] Optimistic Locking tested with a real concurrency conflict (Scenario 3)
- [ ] Confirmed by test that editing `aliquotaPct` does not change the `RateioImpostoGrade.aliquotaAplicadaSnapshot` of already-existing allocations
- [ ] Impact warning (Scenario 2) does not block saving
- [ ] Delta log with before/after state recorded correctly
