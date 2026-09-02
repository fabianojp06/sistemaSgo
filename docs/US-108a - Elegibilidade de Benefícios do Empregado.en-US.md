## [US-108a] — Individual Empregado Benefit Eligibility

**Module:** Registrations — Employees / Benefits
**Epic:** EP118/24
**Priority:** Medium
**Estimate:** G

**As an** HR Manager (GRH),
**I want** to individually activate/deactivate each benefit for an Empregado, with a validity period and number of dependents per benefit,
**So that** benefit costs reflect exactly what each employee actually uses, not the Cargo's whole package.

### Context and Business Rules

This US covers UC03.28 (Benefits) of Draft Spec V5 — the Empregado's individual eligibility, distinct from the Cargo's Master Table (US-107a, already completed). The user confirms, benefit by benefit, whether that specific Empregado uses that allowance, within what the Cargo already makes available.

Documentation quality findings and decisions closed with the user in this session:

1. **Transportation Allowance did not exist in `Cargo`** (US-107a modeled only VA, VR, Health, Dental, Life, Daycare — 6 benefits; the Draft Spec mentions Transportation in UC03.28, but it never appeared in block C of UC03.19). Decision: **it is a real 7th benefit, added retroactively to Cargo in this US** (a targeted rework of US-107a/ADR-019, not a new US). It follows the same formula as VA/VR (`unitValue × standardBusinessDays`), and `Cargo.custoTotalCargo` now also sums Transportation.
2. **Dependents are now per benefit, no longer a single number on the Empregado.** The Draft Spec's RN0253 talks about dependents "per allowance" — user decision: create `numeroDependentes` inside the new eligibility record (one value per Empregado × Benefit), no longer relying solely on the existing single field on `EmpregadoHeadcount.numeroDependentes`. **The old field (`EmpregadoHeadcount.numeroDependentes`) is kept in the schema for backward compatibility (already in production, US-108), but stops being the source of truth for benefit calculation** — it becomes a loose registration field with no functional use in this US. This is flagged to the Tech Lead as a divergence to document (ADR), not removed in this US.
3. **New table `EmpregadoBeneficioElegibilidade`**, 1 row per Empregado × TipoBenefício (enum with the 7 values: VA, VR, PLANO_SAUDE, PLANO_ODONTO, SEGURO_VIDA, AUXILIO_CRECHE, VALE_TRANSPORTE). This avoids 21 loose fields (7 benefits × active/period/dependents) on `EmpregadoHeadcount`, which already has a sizable number of fields since US-108/ADR-018.
4. **RN0274 (recalculation of the Proposal's Benefit Totalizers) is out of scope** — same pattern as every previous US that mentions a "Totalizer"/"batch recalculation": the formal `TotalizerService` does not yet exist as a centralized architectural service in the project.
5. **Eligibility is only possible for benefits active on the Empregado's Cargo** — if the Cargo does not have an active Dental Plan, an Empregado on that Cargo cannot mark Dental eligibility. Financial values shown in the eligibility screen are always read-only, inherited from the Cargo (not duplicated/snapshotted — for eligibility, unlike the Empregado's cost, it makes sense to read the Cargo's live value, since the eligibility record itself is not a "freeze" of historical cost, it is a usage record).
6. **RN0253 — period/dependents required for the "Empregado" category, except Transportation Allowance**: kept as-is from the Draft Spec. Estagiário and Jovem Aprendiz do not have this requirement (the Draft Spec does not make the behavior clear for these categories — treated as "not required" by exclusion, since RN0253 specifically talks about "Empregado").

### Acceptance Criteria

**Scenario 1 — Activate eligibility for a benefit available on the Cargo**
```gherkin
Given Empregado "Maria da Silva" is linked to Cargo "CARGO-2026-0001", which has an active Health Plan (value 450.00)
And the Empregado's category is EMPREGADO
When the user activates Health Plan eligibility for Maria, with Start Period=2026-02-01, End Period=2026-12-31, Number of Dependents=2
Then the eligibility is persisted in EmpregadoBeneficioElegibilidade
And a `BENEFICIO_ELEGIBILIDADE_CONFIGURADA` audit record is written to HistoricoOperacao
```

**Scenario 2 — Blocked: benefit is not active on the Empregado's Cargo**
```gherkin
Given the Empregado's Cargo does not have an active Dental Plan
When the user tries to activate Dental Plan eligibility for that Empregado
Then the system blocks the save
And displays the message "This benefit is not available on this employee's Cargo."
```

**Scenario 3 — Blocked: validity period outside the Proposal's validity (RN0252)**
```gherkin
Given the Empregado's Proposal has dataInicio=2026-01-01 and dataFim=2026-12-31
When the user tries to activate a benefit with End Period=2027-01-15
Then the system blocks the save
And displays the message "Benefit period cannot extend beyond the Proposal's validity."
```

**Scenario 4 — Blocked: category EMPREGADO with no period/dependents on a mandatory benefit (RN0253)**
```gherkin
Given the Empregado's category is EMPREGADO
And the user is activating Meal/Food Allowance eligibility
When they try to save without filling in Start Period or Number of Dependents
Then the system blocks the save
And displays the message "Validity Period and Number of Dependents are required for this benefit."
```

**Scenario 5 — Exception: Transportation Allowance can be deactivated without the Scenario 4 requirements**
```gherkin
Given the Empregado's category is EMPREGADO
When the user deactivates Transportation Allowance eligibility, without filling in period or dependents
Then the system accepts the save normally
And the Transportation Allowance eligibility is marked as inactive
```

**Scenario 6 — Deactivate a previously active benefit**
```gherkin
Given the Empregado has active Meal/Food Allowance, with period and dependents filled in
When the user unchecks the Meal/Food Allowance eligibility
Then the system saves the eligibility as inactive
And a `BENEFICIO_ELEGIBILIDADE_EDITADA` audit record is written with the previous and the new state
```

**Scenario 7 — Blocked: attempt to edit a benefit's financial value [SHIELDED ORIGIN]**
```gherkin
Given the Empregado's Cargo's Health Plan is worth 450.00
When the user tries to submit a different value for the benefit's value field on the eligibility screen
Then the system ignores that value
And keeps showing the live value inherited from the Cargo (450.00), never a value typed on the eligibility screen
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | New table `EmpregadoBeneficioElegibilidade`; `Cargo` gains `transporteAtivo`/`transporteValorUnitario` (rework of US-107a/ADR-019); `Cargo.custoTotalCargo` now sums Transportation as well |
| Fields of `EmpregadoBeneficioElegibilidade` | tenantId, empregadoId (FK), tipoBeneficio (enum TipoBeneficioElegibilidade), ativo (Boolean), periodoInicio (nullable), periodoFim (nullable), numeroDependentes (Int, default 0) |
| Transaction? | Yes — availability validation against the Cargo + writing the eligibility record in the same transaction |
| Requires lock? | No — same transactional simplicity as Cargo/Empregado, no relevant concurrency |
| Audit | `BENEFICIO_ELEGIBILIDADE_CONFIGURADA`, `BENEFICIO_ELEGIBILIDADE_EDITADA` in HistoricoOperacao |
| Business rule | Benefit must be active on the Cargo (Scenario 2); RN0252 (validity within the Proposal); RN0253 (requirement by category, except Transportation); financial values always read from the Cargo, never duplicated |

### Dependencies

- **US-107a (Cargo Master Table)**: satisfied, with a targeted rework to add Transportation Allowance.
- **US-108 (Empregado)**: satisfied — `EmpregadoBeneficioElegibilidade` references `EmpregadoHeadcount`.
- **Note for the Tech Lead**: `EmpregadoHeadcount.numeroDependentes` (already in production) becomes functionally unused as of this US — document this divergence (legacy field vs. new per-benefit granular field) in an ADR, decide whether to mark it deprecated or remove it in a future cleanup.

### Definition of Done

- [ ] Acceptance criteria 1 to 7 implemented and tested
- [ ] Eligibility is only accepted for benefits active on the Empregado's current Cargo
- [ ] Financial values on the eligibility screen are always read live from the Cargo, never duplicated/typed in
- [ ] Transportation Allowance has an exception to the period/dependents requirements (RN0253)
- [ ] `Cargo.custoTotalCargo` recalculated to include Transportation Allowance (ADR-019 rework)
- [ ] Audit log generated for eligibility configuration/editing
- [ ] Tested with a category other than EMPREGADO (RN0253 requirement does not apply)
- [ ] Tested with an attempted eligibility for a benefit inactive on the Cargo (must block)
