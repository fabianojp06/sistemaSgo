## [US-134] — Official Snapshot with Position Cost DNA

**Module:** Registrations — Positions and Salaries (UC03.19, REQ_CAR_004/RN_CAR_05/RN_CAR_07)
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M
**Known blocker:** depends on US-131/US-132/US-133 being implemented (there is no new cost DNA to freeze without the fields they introduce).

**As a** Common User (GFIN) / Auditor,
**I want** the official approval of a Proposal to freeze the complete "cost DNA" of each Position (Active Source, value, benefits, functional assignment and salary origin),
**So that** any future audit can see exactly what data underpinned the cost, even if the market Salary Table or the Master Table's benefits change later.

### Context and Business Rules

Source document: REQ_CAR_004, RN_CAR_05 (Historical Freeze), RN_CAR_07 (Benefit Value Origin),
RN_TAB_05 (Origin Persistence in the Snapshot). The project already has the frozen-snapshot pattern
in `EmpregadoHeadcount` (ADR-018) and in the 9 cost components of ADR-029 — this US extends that same
pattern to the moment the Proposal is officially approved, not to the moment the Employee is
registered.

**Important difference from the existing pattern:** ADR-018 freezes at the moment the *Employee is
assigned to the Position*. This US requests freezing at the moment the *Proposal is officially
approved* — these are two distinct, non-interchangeable freeze events; the official approval needs to
capture the state of the Position (Active Source, salary origin, Rubi components) exactly as it was
at that instant, even if the Employee had already been registered earlier.

### Acceptance Criteria

**Scenario 1 — Snapshot generated on official approval**
```gherkin
Given a Proposal with configured Positions (Active Source, benefits, Rubi Salary Table/Range/Level) is being officially approved
When the user confirms the official approval
Then the system writes, per Position, an immutable snapshot with:
  | Active Source                                                              |
  | Resulting value from the Active Source                                     |
  | Each active benefit, with its value and origin (Master Table or Manual)    |
  | Functional Assignment (allocation, if applicable — see gap on RN_CAR_02 below) |
  | Min/Max Salary Origin (Salary Table or Manual)                             |
  | Rubi Salary Table/Range/Level (code + description) in effect at that time  |
```

**Scenario 2 — Snapshot does not change with a later update**
```gherkin
Given a Proposal was officially approved with the snapshot from Scenario 1
When the market Salary Table or the benefits Master Table changes afterward
Then the snapshot of the already-approved Proposal remains unchanged
And only new registrations/approvals reflect the updated values
```

**Scenario 3 — Blocked: approving with no Active Source on some Position**
```gherkin
Given there is at least 1 headcount Position with no Active Source selected
When the user tries to officially approve the Proposal
Then the system blocks with a message indicating which Positions have no Active Source (RN_CAR_04)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | New table or serialized JSON field on `VersaoProposta`/official-approval event — modeling decision belongs to the Tech Lead |
| Transaction? | Yes — the snapshot of all headcount Positions is written atomically together with the Proposal's status change to OFICIALIZADA |
| Audit trail | `HistoricoOperacao` records the official approval; the snapshot itself is the cost audit record |
| Business rule | RN_CAR_04 (block with no Active Source) must be checked before any write |

### Dependencies

- US-131, US-132, US-133 (the fields that make up the cost DNA need to exist before they can be frozen)
- Tech Lead decision on where/how to persist the snapshot (dedicated table vs. JSON), given that the project already has other "freeze" points (ADR-018, ADR-029) — evaluate whether it makes sense to reuse a single snapshot mechanism instead of a third pattern

### Definition of Done

- [ ] Acceptance criteria implemented
- [ ] Snapshot proven immutable after official approval (test changing source data afterward and confirming the snapshot does not change)
- [ ] RN_CAR_04 blocking official approval with no Active Source
