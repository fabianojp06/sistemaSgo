## [US-127] — Quick Tax Registration from the Allocation Screen (Flow C)

**Module:** Registrations — Tax Rates (consumed from Proposals)
**Epic:** EP118/24
**Priority:** Low
**Estimate:** S

**As a** Budget Analyst filling out the Tax Allocation of a Proposal,
**I want** to register a new tax without leaving the Proposal screen,
**So that** I don't lose the context of the allocation I'm building when the tax I need doesn't yet exist in Tax Rates.

### Context and Business Rules

Covers "Flow C" (inline shortcut) described in the specification `UC03.39_a_UC03.42_Aliquotas_Impostos.md` for UC03.01 — Tax Tab: *"Flow C of UC03.01 (inline modal) remains a shortcut for quick registration — points to the same database."* The same shortcut was already mentioned as out of scope in `US-101 - Parametrizar Impostos em Proposta do Tipo Contrato.pt-BR.md` (line 41: *"Previously registered by the Administration Module or via the [New Tax] inline shortcut (UC03.01, Alt. Flow C — out of scope for this US)"*), at a time when the Tax Rate Hub (US-123 to US-126) did not yet exist. With the Hub implemented and `CadastrarAliquotaImpostoUseCase` already available, this shortcut becomes feasible: it reuses the same use case, without duplicating business rules.

**Concrete trigger:** today, in `RateioImpostoPanel.tsx` (the Proposal's Tax Allocation screen, US-101/US-101a), the "Tax" combo only lists tax rates already registered (`aliquotas: AliquotaOpcao[]`) — if it is empty, the entire panel is blocked with the message *"No tax parameterized in this tenant yet."* (lines 53-55 of the component), forcing the user to leave the Proposal, go to Registrations > Tax Rates, register the tax, and come back. This US adds a `[+ New Tax]` shortcut next to the "Tax" combo that opens a quick registration modal without leaving the screen.

### ⚠️ Open decision — resolve during refinement before coding

It has not been decided whether the quick registration modal uses:
- **(a) All the fields** from the full registration form (US-124): Name, Rate, Incidence Type, Validity Start/End Date, Min/Max Limits, Synthetic Account, Notes; or
- **(b) A reduced subset** — only the fields indispensable for immediate use in the allocation (Name, Rate, Incidence Type, Validity Start Date), leaving the rest as `null`/default, editable later via the Tax Rate Hub (US-125).

Option (b) is more consistent with the nature of a "quick shortcut", but needs confirmation from the PO/user — the scenarios below assume (b) as the working hypothesis; adjust before implementing if the decision is (a).

### Acceptance Criteria

**Scenario 1 — Successful quick registration, without leaving the Proposal**
```gherkin
Given the user is on the Tax Allocation screen of a Proposal (RateioImpostoPanel)
And no tax rate named "IPTU" exists
When the user clicks [+ New Tax]
And fills in Name = "IPTU", Rate = 1.00, Incidence Type = AMBOS, Start Date = today
And clicks [Save] in the modal
Then the system persists the record in AliquotaImpostoParametro with ativo = TRUE, using the same CadastrarAliquotaImpostoUseCase as US-124
And writes a log entry ALIQUOTA_IMPOSTO_CRIADA in HistoricoOperacao within the same transaction [RN0232]
And the modal closes automatically
And the "Tax" combo in the Allocation is refreshed and already comes with "IPTU" pre-selected
And the user remains on the Tax Allocation screen, without losing the Analytical Account/Reference Period/Amount fields already in progress
```

**Scenario 2 — Blocked: duplicate name (case-insensitive) [ERROR LOCK]**
```gherkin
Given the tax rate "ISS" already exists
And the user opened the [+ New Tax] modal from the Tax Allocation
When they try to register "iss" (lowercase)
Then the system blocks the operation with "Operation Rejected [ERROR LOCK]: A tax rate named iss is already registered. Use a unique name." (same message as US-124, Scenario 2)
And no record is persisted
And the modal remains open for correction
```

**Scenario 3 — Blocked: ISS rate outside the legal range [ERROR LOCK / RN_IMP_006]**
```gherkin
Given the user is registering, via the inline modal, a tax rate with Name = "ISS"
When they enter Rate = 6.50
And click [Save]
Then the system blocks the operation with "Invalid ISS Rate [ERROR LOCK]: The ISS rate must be between 2.00% and 5.00% under LC 116/2003." (same validation as US-124, reused from the use case)
And no record is persisted
```

**Scenario 4 — Blocked: user without registration permission**
```gherkin
Given the user has access permission to the Proposal's Tax Allocation (plano-contas.configurar-rateio-imposto)
But does not have the aliquotas-impostos.criar permission
When they access the Tax Allocation screen
Then the [+ New Tax] button is not displayed
And, if the "Tax" combo is empty, the current blocking message ("No tax parameterized in this tenant yet.") remains without a registration shortcut
```

**Scenario 5 — Canceling the modal preserves the Allocation's state**
```gherkin
Given the user has already filled in Analytical Account, Reference Period, and Declared Amount in the Allocation
And opened the [+ New Tax] modal
When they click [Cancel] in the modal, without saving
Then the modal closes
And no record is persisted
And the fields already filled in the Tax Allocation (Analytical Account, Reference Period, Declared Amount) remain intact
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | None new — reuses `AliquotaImpostoParametro` (US-124/ADR-038), no dedicated migration |
| Components | New modal (e.g., `NovoImpostoInlineModal.tsx`) invoked from `RateioImpostoPanel.tsx`; reuses the existing `cadastrarAliquotaImposto` Server Action in `src/app/aliquotas-impostos/actions.ts` — **do not duplicate** validation logic |
| Transaction? | Same transaction already implemented in `CadastrarAliquotaImpostoUseCase` (INSERT + `HistoricoOperacao`) — no change to the transactional protocol |
| Requires lock? | No (same nature as the creation flow in US-124) |
| Audit trail | `ALIQUOTA_IMPOSTO_CRIADA` (identical to US-124 — there is no new operation type, it's the same registration via a different access path) |
| Permission | Reuses `aliquotas-impostos.criar` (US-124/US-123) — **do not create a new permission**; the user needs both permissions (allocation + create tax rate) to see the shortcut |
| Data refresh | After saving, `RateioImpostoPanel` needs to reload the `aliquotas` list (revalidation or refetch) and pre-select the newly created item — today the list is received via a prop, so evaluate whether it should be fetched client-side or whether the parent component needs `revalidatePath` |

### Dependencies

- **US-124 (Register Tax Rate)**: provides the use case and the Server Action reused here — direct prerequisite.
- **US-101/US-101a (Tax Allocation)**: provides the screen (`RateioImpostoPanel.tsx`) where the shortcut is inserted.
- **Open decision** (see section above): full vs. reduced fields in the modal — blocks the start of coding until resolved in refinement.

### Definition of Done

- [ ] Decision on the modal's field scope (full vs. reduced) made and recorded before coding
- [ ] Acceptance criteria 1 to 5 implemented and tested
- [ ] No duplicated validation rule — the modal calls the same Server Action/use case as US-124
- [ ] The `[+ New Tax]` button only appears for users with `aliquotas-impostos.criar`
- [ ] After registration, the new tax rate appears pre-selected in the "Tax" combo without reloading the page
- [ ] Canceling the modal does not change any field already filled in the Tax Allocation
- [ ] Tested with a duplicate name (case-insensitive) and with ISS outside the 2–5% range, reusing the same error messages as US-124
