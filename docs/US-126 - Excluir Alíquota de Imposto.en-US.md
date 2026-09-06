## [US-126] — Delete (Deactivate) Tax Rate

**Module:** Registrations — Tax Rates
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** S

**As an** Administrator with delete permission in Registrations,
**I want** to logically deactivate a tax rate that has no active references,
**So that** I can remove it from lookups for new Proposals without losing audit history or breaking existing allocations.

### Context and Business Rules

Covers UC03.42. Follows the guidelines already used throughout the system: **[SOFT DELETE]** (never a physical deletion of a record with usage history) and **[ERROR LOCK]** (synchronous blocking before any commit). Same pattern as `DesativarTributoRateioUseCase`, which already exists for `RateioImpostoGrade` — here the target is the global parameter `AliquotaImpostoParametro`, not the allocation line.

### Acceptance Criteria

**Scenario 1 — Logical deletion with no active references**
```gherkin
Given the tax rate "IOF" is not referenced by any RateioImpostoGrade with ativo = TRUE in a non-frozen Proposal
When the user clicks [Delete] on the "IOF" row and confirms in the modal
Then the system scans tb_rateio_imposto_grade and confirms there is no active link [RN_IMP_009]
And updates ativo = FALSE in AliquotaImpostoParametro (no physical DELETE) [RN_IMP_010]
And writes a log entry ALIQUOTA_IMPOSTO_INATIVADA in HistoricoOperacao with the payload of the previous state [RN0232]
And the tax rate no longer appears in lookups for new Proposals
```

**Scenario 2 — Blocked: active reference detected [ERROR LOCK / RN_IMP_009]**
```gherkin
Given the tax rate "ISS" is referenced by a RateioImpostoGrade with ativo = TRUE in a Proposal with status EM_ELABORACAO
When the user tries to delete "ISS"
Then the system blocks the operation with "Deletion Blocked [ERROR LOCK]: This tax rate is being used in active Proposals. Remove the references before deleting."
And ativo remains TRUE, no data is changed
```

**Scenario 3 — Cancel in the confirmation modal**
```gherkin
Given the deletion confirmation modal for the tax rate "PIS" is open
When the user clicks [Cancel]
Then the modal closes without performing any operation
And the tax rate remains active and visible
And no log is recorded
```

**Scenario 4 — [Delete] button disabled at the source (reinforcing Scenario 5 of US-123)**
```gherkin
Given the tax rate "ISS" has an active reference
When the UC03.39 grid is rendered
Then the [Delete] button already appears disabled for that row, without even allowing the modal to be opened
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `AliquotaImpostoParametro` (UPDATE `ativo = false`), reading `RateioImpostoGrade` for the scan |
| Fields changed | `ativo` |
| Transaction? | Yes — UPDATE + log within the same ACID transaction [RNF_EXC_REQ_002]; atomic rollback if the log fails |
| Requires lock? | No, beyond the synchronous pre-commit scan (this is not concurrent editing of the same record, it's a reference check) |
| Audit trail | `ALIQUOTA_IMPOSTO_INATIVADA`, JSON payload with a full snapshot of the previous state |
| Business rule | RN_IMP_004 (button condition), RN_IMP_009 (blocking due to active reference), RN_IMP_010 (mandatory soft delete) |

### Dependencies

- **US-123 (Maintain)**: source screen ([Delete] button and confirmation modal).
- **US-124/US-125**: schema (`ativo`) must already exist via ADR-038.

### Definition of Done

- [ ] Acceptance criteria 1 to 4 implemented and tested
- [ ] Tested with an active reference in a Proposal with status EM_ELABORACAO (must block)
- [ ] Tested with a reference only in an Officialized/frozen Proposal (must not block — the snapshot is already immutable and no longer depends on the active parameter)
- [ ] Confirmed that no physical DELETE is executed in any scenario
- [ ] Audit log recorded with the full payload of the previous state
