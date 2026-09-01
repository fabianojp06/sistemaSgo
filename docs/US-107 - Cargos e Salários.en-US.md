## [US-107] — Register Cargo and Configure Salary Source

**Module:** Registrations — Employees / Cargo and Salary
**Epic:** EP118/24
**Priority:** High
**Estimate:** G

**As an** HR Manager (GRH) or Budget Analyst,
**I want** to register a Cargo linked to an Analytical node of the Functional Structure and define which salary source (Market or Rubi) will be the basis for the headcount calculation,
**So that** the headcount's personnel cost has a single, auditable origin that is never entered arbitrarily.

### Context and Business Rules

This US covers UC03.19 (Cargo and Salary) of Draft Spec V5, **restricted to blocks A (Identification and Functional Assignment) and B (Salary Sources Panel)**. Block C (Benefits and Payroll Charges Management Subscreen) is **explicitly out of scope** — a decision confirmed with the user: Benefits/Payroll Charges is the responsibility of a future US (US-107a, aligned with UC03.28 "Benefits", which already appears separately in the Draft Spec's index), not this one. This avoids a US that mixes two responsibilities (salary configuration vs. benefits costing) and keeps `Cargo` stable while `Beneficio` is not even designed yet.

Documentation quality findings for UC03.19 (the same care already recorded for UC03.07/03.09/03.10):
- The Business Rule numbering skips from RN_CAR_01 to RN_CAR_03 — RN_CAR_02 does not exist in the Draft Spec text. Treated as a drafting gap, not a lost rule.
- REQ_CAR_004/RN_CAR_05 (snapshot at the moment the Partnership Agreement is Officialized) and RN_CAR_06 (inheritance alert when a benefit is deactivated in the Master Table) belong to the Benefits/Officialization domain — they are not scenarios of this US; revisit when US-107a and the Officialization flow (Approvals Module) exist.

Decisions confirmed with the user for this US:
1. **Real Salary (Rubi) via a fictitious fixture** — there is no real integration with the Rubi ERP in the project (the same situation as the Chart of Accounts/Senior, which uses `PlanoContasFixtureProvider`). The field exists, is read-only on the screen, and its value comes from a `CargoRubiFixtureProvider` (example name — Tech Lead decides) until a real integration is specified. RN_CAR_03 (Rubi Immutability) applies from the start, even with fictitious data.
2. **The Cargo↔UnidadeFuncional link is a fixed 1:1** — a Cargo points to exactly one Analytical node (`ASSESSOR`, `COORDENADORIA`, or `SETOR`) of the Functional Structure (US-106). Percentage apportionment across multiple units (`CargoAlocacaoPercentual`, mentioned as pending item RN_EST_03 in US-106) is **not** implemented in this US — that is left for when a real use case requires splitting a Cargo across units.
3. **RN_EST_01** (US-106): "every Cargo must be linked to an analytical node, blocking officialization if there is an orphan Cargo" becomes partially applicable now that `Cargo` exists — but the Officialization-blocking check itself can only be implemented once the Officialization flow (Approvals Module) exists. In this US, the mandatory link is enforced at registration time (RN_CAR_01), not at Officialization.

### Acceptance Criteria

**Scenario 1 — Successfully register a Cargo (Active Source = Market)**
```gherkin
Given Proposal "PROP-2026-001" has a Functional Structure with the Analytical node "Setor de Compras" (SETOR)
And no Cargo has been registered for this Proposal yet
When the user registers a Cargo with:
  | Market Cargo Name     | Analista de Compras Pleno |
  | Functional Assignment | Setor de Compras          |
  | Minimum Market Salary | 4500.00                   |
  | Maximum Market Salary | 6200.00                   |
  | Active Source         | MERCADO_MAXIMO            |
Then the Cargo is persisted with an automatically generated, read-only "Cargo Code"
And the "Real Salary (Rubi)" field is filled in by the fixture provider and shown as read-only
And the Cargo appears in the listing linked to the "Setor de Compras" node
And a `CARGO_CRIADO` audit record is written to `HistoricoOperacao`
```

**Scenario 2 — Blocked: Cargo with no Functional Assignment [HARD ERROR / RN_CAR_01]**
```gherkin
Given the user is registering a new Cargo
When they try to save without selecting any Functional Structure node
Then the system blocks the save
And displays the message "Select a functional assignment (Analytical node) before saving the Cargo"
And no record is persisted to the database
```

**Scenario 3 — Blocked: link to a Synthetic node instead of an Analytical one [HARD ERROR]**
```gherkin
Given the Proposal has the Synthetic node "Diretoria Financeira" (DIRETORIA) in its Functional Structure
When the user tries to link a Cargo directly to "Diretoria Financeira"
Then the system blocks the save
And displays the message "A Cargo can only be linked to an Analytical node (Advisory, Coordination, or Sector)"
And no record is persisted to the database
```

**Scenario 4 — Blocked: attempt to manually edit Real Salary (Rubi) [HARD ERROR / RN_CAR_03]**
```gherkin
Given a Cargo has already been registered with "Real Salary (Rubi)" = 5300.00 (from the fixture provider)
When the user tries to submit a change sending a different value for "Real Salary (Rubi)"
Then the system ignores the received value for that field and keeps the value from the fixture provider's source
And no change is persisted for that field
And the rest of the request's editable fields are processed normally
```

**Scenario 5 — Automatic Total Salary calculation when there is a Gratified Function**
```gherkin
Given the user is registering a Cargo with "Gratified Function" filled in with value 800.00
And "Minimum Market Salary" = 4500.00 and "Maximum Market Salary" = 6200.00
And "Active Source" = MERCADO_MINIMO
When the user saves the Cargo
Then the system calculates "Total Salary" = 4500.00 + 800.00 = 5300.00
And the "Total Salary" field is read-only (calculated, never entered directly) [SHIELDED ORIGIN]
```

**Scenario 6 — Blocked: Officializing a Proposal with no Active Source defined on some Cargo [RN_CAR_04]**
```gherkin
Given the Proposal has at least one registered Cargo with no "Active Source" selected
When the system tries to transition the Proposal to OFICIALIZADO status
Then Officialization is blocked
And the system indicates which Cargos have no Active Source defined
```
*(Note: this scenario depends on the Officialization flow, not yet implemented — see Dependencies. Kept here as an already-validated specification, not as code scope for this US.)*

**Scenario 7 — Market deviation alert (RN0005/REQ_CAR_005)**
```gherkin
Given a Cargo has "Real Salary (Rubi)" = 7000.00
And "Minimum Market Salary" = 4500.00 and "Maximum Market Salary" = 6200.00
When the user views the Cargo in the listing or in the form
Then the system displays a visual alert indicator (outside the market range)
And the registration is not blocked — it is only an informational alert
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | New table `Cargo` (final name at the Tech Lead's discretion); no change to `UnidadeFuncional` |
| Fields changed | `Cargo`: nomeCargo, nomeCargoMercado, codigoCargo (generated), funcaoGratificada (nullable), periodoInicio, unidadeFuncionalId (FK, required, fixed 1:1 — no apportionment table in this US), salarioMercadoMinimo, salarioMercadoMaximo, salarioReal (fixture, read-only), salarioTotal (calculated), fonteAtiva (enum), ativo (soft delete) |
| Transaction? | Yes — creating/editing a Cargo is atomic; the `salarioTotal` calculation must happen in the same persistence transaction, never on the client |
| Requires lock? | Not at this time — a Cargo is not edited concurrently by multiple actors in the same flow (unlike ValorOrcadoConta/RateioImpostoGrade, which motivated US-105). Reassess if this scenario arises. |
| Audit | Record in `HistoricoOperacao`: `CARGO_CRIADO`, `CARGO_EDITADO`, `CARGO_INATIVADO` |
| Business rule | RN_CAR_01 (mandatory link to an Analytical node), RN_CAR_03 (Real Salary immutability), Total Salary calculation (block B requirement), market deviation alert (REQ_CAR_005) |

### Dependencies

- **US-106 (Functional Structure)**: a Cargo can only be linked to an existing `UnidadeFuncional` of the Analytical type — direct dependency, already satisfied.
- **US-107a (to be created) — Benefits and Payroll Charges (UC03.28)**: out of scope here; will be responsible for block C of UC03.19.
- **Officialization flow (Approvals Module, not yet started)**: Scenario 6 (blocking Officialization with no Active Source) and RN_CAR_05 (snapshot freeze) depend on it — kept as specification, not as code for this US.
- **US-108 (Empregados)** and **Qtde. Empregado**: depend on `Cargo` existing — this US unblocks them.

### Definition of Done

- [ ] Acceptance criteria 1 to 5 and 7 implemented and tested (Scenario 6 documented, not implemented — depends on Officialization)
- [ ] Cargo→UnidadeFuncional link accepts only Analytical nodes (`ASSESSOR`, `COORDENADORIA`, `SETOR`)
- [ ] Real Salary field is always read-only and comes from the fixture provider, never accepts a value from the client
- [ ] Total Salary is always calculated on the backend, never accepted as direct input
- [ ] Audit log generated for Cargo creation/editing/deactivation
- [ ] Tested with an attempted link to a Synthetic node (must block)
- [ ] Tested with an attempted manual edit of Real Salary (must be ignored, must not break the rest of the update)
