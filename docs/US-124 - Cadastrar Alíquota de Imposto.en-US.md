## [US-124] — Register Tax Rate

**Module:** Registrations — Tax Rates
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** M

**As an** Administrator or Budget Analyst with write permission in Registrations,
**I want** to formally register a new tax and its rate, with a validity history and legal limits,
**So that** the parameter becomes available for allocation in Proposals without depending on manual changes to the database/seed.

### Context and Business Rules

Covers UC03.40. Formalizes the registration of `AliquotaImpostoParametro`, currently only populatable via `prisma/seed.mjs` — there is no creation use case in the current code (verified: no file references `aliquotaImpostoParametro.create` outside of the seed).

Includes the (optional) `contaSinteticaId` field decided in **ADR-038**: the tax rate can carry a synthetic account as a *suggestion* of a default expense nature, used to pre-fill the Tax Allocation form (US-101, `RateioImpostoPanel.tsx`). This **does not replace** the mandatory nature of `RateioImpostoGrade.contaId` (analytical account, ADR-027) — the mandatory-account constraint remains entirely in the per-Proposal allocation, not in this registration.

### Form Fields

| Field | Type | Required | Rule |
|---|---|---|---|
| Tax Name | Text | Yes | Max. 20 chars, unique case-insensitive [RN_IMP_005] |
| Default Rate (%) | Numeric | Yes | 0.00–100.00%; ISS mandatorily 2.00–5.00% [RN_IMP_006] |
| Incidence Type | Combo | Yes | CONTRATO / TERMO_DE_PARCERIA / AMBOS [RN_PRO_010] |
| Validity Start Date | Date | Yes | Not retroactive to the server's date [RN_IMP_007] |
| Validity End Date | Date | No | NULL = open-ended validity; if informed, later than the Start Date |
| Minimum Limit (%) | Numeric | No | Relevant for ISS, default 2.00% |
| Maximum Limit (%) | Numeric | No | Relevant for ISS, default 5.00% |
| Synthetic Account (suggestion) | Select | No | ADR-038 — only a UX default in the allocation, does not enforce anything |
| Notes | Long text | No | Max. 500 chars |

### Acceptance Criteria

**Scenario 1 — Successful registration**
```gherkin
Given there is no tax rate named "COFINS"
When the user fills in Name = "COFINS", Rate = 3.00, Incidence Type = AMBOS, Start Date = today
And clicks [Save]
Then the system persists the record in AliquotaImpostoParametro with ativo = TRUE
And writes an ALIQUOTA_IMPOSTO_CRIADA log entry in HistoricoOperacao within the same transaction [RN0232]
And the new tax rate appears in the UC03.39 grid with a success message
```

**Scenario 2 — Blocked: duplicate name (case-insensitive) [ERROR LOCK]**
```gherkin
Given the tax rate "ISS" is already registered
When the user attempts to register "iss" (lowercase)
Then the system blocks the operation with "Operation Rejected [ERROR LOCK]: A tax rate named iss already exists. Use a unique name."
And no record is persisted
```

**Scenario 3 — Blocked: ISS rate outside the legal range [ERROR LOCK / RN_IMP_006]**
```gherkin
Given the user is registering a tax rate with Name = "ISS"
When they enter Rate = 6.50
And click [Save]
Then the system blocks the operation with "Invalid ISS Rate [ERROR LOCK]: The ISS rate must be between 2.00% and 5.00%, per LC 116/2003."
And no record is persisted
```

**Scenario 4 — Blocked: retroactive start date [ERROR LOCK / RN_IMP_007]**
```gherkin
Given the server's current date is 2026-08-07
When the user enters Validity Start Date = 2026-08-01
And clicks [Save]
Then the system blocks the operation with "Invalid Date [ERROR LOCK]: The validity start date cannot be retroactive to the current date."
And no record is persisted
```

**Scenario 5 — Rate outside the general range [ERROR LOCK]**
```gherkin
Given the user is registering a tax rate
When they enter Default Rate = 105.00
And click [Save]
Then the system blocks the operation with "Invalid Rate [ERROR LOCK]: The value must be between 0.00% and 100.00%."
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `AliquotaImpostoParametro` (new migration — see ADR-038 fields) |
| New fields | `ativo` (Boolean default true), `dataFimVigencia` (DateTime?), `limiteMinimoPct`/`limiteMaximoPct` (Decimal? 5,2), `observacao` (String? 500), `contaSinteticaId` (String?, FK ContaContabil), `version` (Int default 0) |
| Transaction? | Yes — INSERT + log entry in `HistoricoOperacao` within the same transaction [RN0232]; rollback if the log fails |
| Requires lock? | Not for this operation (creation, no concurrency over a record that doesn't yet exist) |
| Audit trail | `ALIQUOTA_IMPOSTO_CRIADA` |
| Business rule | RN_IMP_005 (uniqueness), RN_IMP_006 (ISS legal range), RN_IMP_007 (non-retroactivity), RN_TAX_06 (retroactive isolation — a new tax rate does not recalculate already-Officialized Proposals) |

### Dependencies

- **ADR-038**: schema migration is a shared prerequisite with US-123/125/126.
- **US-123 (Maintain)**: source screen ([New] button).

### Definition of Done

- [ ] Acceptance criteria 1 to 5 implemented and tested
- [ ] UC03.40 validations E1–E5 covered by a unit test on the use case
- [ ] Audit log generated within the same transaction as the INSERT
- [ ] Tested with a duplicate name in a different case (case-insensitive)
- [ ] Tested with ISS outside the 2–5% range
- [ ] `contaSinteticaId`, when filled in, is not validated as required anywhere in the flow (it is a suggestion, not a constraint)
