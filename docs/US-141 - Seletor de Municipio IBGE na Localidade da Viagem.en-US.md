# US-141 — Municipality Selector (IBGE) for the Trip's Location

**Module:** Registrations / Proposals — Trips Tab
**Epic:** EP118-24 — Registrations Module
**Priority:** Medium
**Estimate:** M (~1.5 to 2 days)
**Status:** ✅ Delivered — PR #17 (`54d5298`, 2026-09-02), migration applied in production. ADR: `docs/ADR-048 ...md`. Light follow-up still open: removing the municipality (only swapping is supported today), the snapshot is re-resolved on every edit, `migrate resolve` pending — see `docs/STATUS_PROJETO.md` pending item #7.
**Origin:** requested by the user on 2026-09-02, stemming from US-109 (UC03.29-33)

**As a** CTCEA Financial Management (GFIN) analyst registering the trips of a Proposal,
**I want** to select the destination municipality from a standardized list (every municipality in
Brazil), instead of typing the location as free text,
**So that** trip destinations are consistent and groupable (reports by destination, average cost
comparison by city, and the foundation for a future geographic visualization).

---

## Context and business rules

### Current situation

Today `Viagem.descricao` is a **free-text** field (string, max. 100, required), shown in the UI
with the label **"LOCATION (COUNTRY)"**. There is no standardization: one user writes "Brasília",
another "Brasília/DF", another "Mission Brasília — training." This blocks any reliable
aggregation by destination and is the root of the data-quality blocker.

### What changes

A **structured** municipality field is introduced, based on the IBGE code (7 digits), sourced
from a built-in catalog of all 5,570 Brazilian municipalities. The free-text field
**does not disappear** — its role changes.

| Field | Before | After | Required? |
|---|---|---|---|
| Municipality (new, structured) | does not exist | `Viagem.municipioIbge` (IBGE code) + `municipioNome`, `uf` snapshot | **Yes, when registering a new Trip** |
| Free text (`Viagem.descricao`) | "LOCATION (COUNTRY)" — required | **"Reason / trip notes"** — becomes **optional** | No |

New labels on screen:
- Municipality field: **"MUNICIPALITY (BRAZIL)"**
- Text field: **"REASON / TRIP NOTES"** (optional)
- The label **"LOCATION (COUNTRY)"** no longer exists.

### Source-of-truth rule

- The **client sends only the selected IBGE code**. The server resolves `municipioNome`, `uf`,
  `latitude`, and `longitude` from the built-in catalog — it never trusts a name/UF/coordinates
  coming from the client.
- `municipioNome` and `uf` are written as a **frozen snapshot** on the Trip (the same pattern
  used for Position/Employee elsewhere in the project): the trip list and reports display the
  name without depending on the catalog file at runtime.
- The municipality's `latitude` / `longitude` are also stored. **There is no map display in this
  US** — the coordinates are persisted to unblock, without geocoding, a future geographic
  visualization US (see ADR-048 / "Out of scope").

### Municipality catalog

- Source: <https://github.com/kelvins/municipios-brasileiros> (**MIT** license, 5,570
  municipalities; fields: IBGE code, name, latitude, longitude, capital, UF code, SIAFI code,
  area code, time zone).
- Embedded in the code as a **static TS module**, generated from a **pinned commit** of that
  repository (the same pattern already used for `cargo-mercado-raw.ts` in the project).
- **No "Synchronize" button, no job.** Brazilian municipalities practically never change
  (constitutional moratorium on the creation of new ones since 2013). A future catalog update, if
  needed, is a manual file swap in a new code release.
- The MIT license notice + attribution lives in the data's directory.
- The catalog is **global reference data** (not per tenant), read-only.

### What does NOT change

- `src/domain/plano-contas/calcularCustoEstimadoViagem.ts` (**[SHIELDED SOURCE]**) — the Trip's
  Estimated Cost remains = Airfare + Per Diem + Transportation. Neither `municipioIbge` nor
  `descricao` enter the cost calculation.
- US-109 rules: a Trip belongs exclusively to a `POR_META` Proposal (a Goal is required); the
  Proposal/Version/Goal links are frozen on edit; editing is blocked if the Version is not
  `RASCUNHO`/`EM_ELABORACAO`. **The municipality IS editable** (it is a descriptive attribute,
  not a link).
- No new permission — it uses the existing permissions for registering/editing a Trip.

---

## Acceptance Criteria

**Scenario 1 — Register a Trip with a selected municipality**
```gherkin
Given the Proposal is POR_META, in RASCUNHO or EM_ELABORACAO, with a registered Goal
And the user has permission to manage Trips
When the user opens "New Trip" and types "brasil" in the MUNICIPALITY (BRAZIL) field
And the list shows at most 20 results (e.g., "Brasília — DF", "Brasil Novo — PA", "Brasilândia — MS", ...)
And the user selects "Brasília — DF"
And fills in Number of People, Average Days, and the airfare/per diem/transportation costs and accounts
And the REASON / TRIP NOTES field is left empty
When the user clicks "Register"
Then the Trip is created with municipioIbge = "5300108", municipioNome = "Brasília", uf = "DF"
And Brasília's latitude and longitude are stored from the catalog
And descricao is stored empty (optional field)
And the Estimated Cost is calculated normally (Airfare + Per Diem + Transportation), unaffected by the municipality
And the Trip appears in the list as "Brasília — DF"
```

**Scenario 2 — Municipality is required when registering a new Trip**
```gherkin
Given the user is filling in "New Trip"
And has not selected any municipality
When they click "Register"
Then the system displays "Select the trip's destination municipality."
And no Trip is created
```

**Scenario 3 — Edit a Trip and change the municipality**
```gherkin
Given the Trip "Brasília — DF" exists in a Version in EM_ELABORACAO
When the user clicks "Edit," types "curitiba," and selects "Curitiba — PR"
And clicks "Save changes"
Then the Trip now has municipioIbge = "4106902", municipioNome = "Curitiba", uf = "PR"
And latitude/longitude are rewritten with Curitiba's values
And the links to Proposal / Version / Goal remain unchanged
And the Estimated Cost is recalculated only based on the quantities/costs (not the municipality)
And the operation history records the municipality change (from "Brasília/DF" to "Curitiba/PR")
```

**Scenario 4 — Editing a Trip in an approved Version is blocked (rule inherited from US-109)**
```gherkin
Given the Trip belongs to an OFICIALIZADA / approved Version
When the user tries to edit the municipality
Then the system displays "Maintenance Rejected: this snapshot is approved and has become permanently immutable by lifecycle rule."
And the municipality is not changed
```

**Scenario 5 — Legacy Trip without a municipality**
```gherkin
Given a Trip registered before this US exists, with municipioIbge null and descricao = "Mission Recife 2025"
When the user opens the Trips tab
Then the Trip appears in the list as "— (no municipality)" followed by the text "Mission Recife 2025"
And when clicking "Edit," the MUNICIPALITY (BRAZIL) field appears empty
And the system displays the notice "This trip was registered without a municipality. Select one to standardize it."
And the user CAN save the edit without selecting a municipality (does not block correcting legacy data)
And if the user selects a municipality, the name/uf/coordinates snapshot is stored normally
```

**Scenario 6 — Combo box search is accent- and case-insensitive**
```gherkin
Given the user is in the MUNICIPALITY (BRAZIL) field
When they type "sao paulo"
Then the list includes "São Paulo — SP" as well as namesakes from other states (e.g., "São Paulo do Potengi — RN")
And each item shows the municipality name followed by the state, to disambiguate namesakes
When they type fewer than 2 characters
Then no search is performed and the list stays empty
```

**Scenario 7 — Nonexistent IBGE code (server-side defense)**
```gherkin
Given a Trip registration/edit request arrives with municipioIbge = "9999999" (does not exist in the catalog)
When the server processes the request
Then the operation is rejected with "Municipality not found in the catalog."
And no Trip is created or changed
```

**Scenario 8 — A new Proposal Version copies the Trip's municipality**
```gherkin
Given Version 1 has the Trip "Curitiba — PR" (with coordinates)
When the user creates Version 2 (CriarVersaoPropostaUseCase / duplication)
Then the Trip copied into Version 2 keeps municipioIbge = "4106902", municipioNome = "Curitiba", uf = "PR", latitude, and longitude
```

---

## Confirmed edge-case rules

| Situation | Behavior |
|---|---|
| IBGE code does not exist in the catalog | The Server Action rejects with: "Municipality not found in the catalog." Nothing is written. |
| The client sends a name/UF/coordinates that diverge from the catalog | The server **ignores** what came from the client and writes based on the catalog (the client should only send the code). |
| The Trip's `municipioNome`/`uf` snapshot later diverges from the catalog | Does not happen in practice — the catalog is static/pinned. If the catalog is ever updated and a name changes, the Trip **keeps the snapshot from the moment it was registered** (correct, auditable behavior). |
| Legacy Trip (`municipioIbge` null) | Shown as "— (no municipality)" + free text. Editable without requiring a municipality. |
| Empty `descricao` | Allowed (the field is now optional). |

---

## Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| **Schema migration** | `Viagem`: `+ municipioIbge String?`, `+ municipioNome String?`, `+ uf String?`, `+ latitude Decimal? @db.Decimal(9,6)`, `+ longitude Decimal? @db.Decimal(9,6)` + index `(tenantId, municipioIbge)` (type and DDL pinned in **ADR-048**). Additive migration, all nullable, **no backfill**. Written by hand and applied via the Supabase SQL Editor (environment without `.env`); `migrate resolve --applied` via the Session Pooler. |
| Catalog | New static module `src/infrastructure/integrations/municipios-br/municipios-brasileiros-raw.ts` (or similar), generated from the CSV/JSON of the `kelvins/municipios-brasileiros` repo at a pinned commit. + MIT `LICENSE`/attribution. Read provider (`MunicipioBrasileiroCatalogo`) for the server to resolve code → name/uf/lat/long. |
| `CadastrarViagemUseCase` | Receives `municipioIbge` (required). Validates against the catalog. Resolves and stores `municipioNome`/`uf`/`latitude`/`longitude`. `descricao` becomes optional (adjust validation). |
| `EditarViagemUseCase` | Receives `municipioIbge` (optional on edit, so as not to lock out legacy trips). Same validation/resolution. Includes the municipality change in `HistoricoOperacao` (`dadosSerializados`). Keeps all inherited rules (Version status, frozen links, optimistic locking). |
| `CriarVersaoPropostaUseCase` | **Must** propagate the 5 new fields in the `tx.viagem.createMany` call that copies Trips into the new Version (`src/application/use-cases/plano-contas/CriarVersaoPropostaUseCase.ts`, `viagensOrigem` block). Without this, the municipality is lost when creating a new Version / duplicating. |
| Server Actions | `cadastrarViagem` / `editarViagem` (`plano-contas/actions.ts`): new `municipioIbge` field in the input and the Zod schema; `descricao` is no longer `.min(1)`. |
| `ViagemResultado` (type) | `+ municipioIbge: string \| null`, `+ municipioNome: string \| null`, `+ uf: string \| null`, `+ latitude: string \| null`, `+ longitude: string \| null`. |
| `page.tsx` (trips tab) | `select` of the `prisma.viagem.findMany` query includes the new columns; mapped to `ViagemResultado`. |
| `ViagemPanel.tsx` | Municipality combo box field in `ViagemForm` (client-side search, accent-insensitive, capped at 20, shows "Name — UF"). List shows "Name — UF" or "— (no municipality)." Notice for legacy trips. The 5,570 records go to the client via dynamic `import` (lazy-loaded on the tab). Labels: "MUNICIPALITY (BRAZIL)" and "REASON / TRIP NOTES." |
| Transaction? | Not a balance operation. The writes already occur inside the existing `$transaction` of the Trip use cases. |
| Requires a lock? | No, beyond the optimistic locking already present on edit. |
| Audit | `HistoricoOperacao` is already written by Register/Edit Trip; include the municipality code+name in the payload. |
| Multi-tenant | The catalog is global (no `tenantId`), read-only, embedded. `Viagem` keeps `tenantId` in every `where`. No new query crosses tenants. |
| How it is undone | Edit the Trip and change/clear the municipality (within the Version's status rules). No formal reversal — it is not a financial entry. |

---

## Dependencies

- **ADR-048** (`techlead-fsg`) — formal decision on: the coordinate columns' type
  (`Decimal(10,7)` vs. `Float`), whether `municipioIbge` is required at registration, the name/
  location of the catalog module, the migration strategy. **Blocks the start of implementation.**
- US-109 — Trips (foundation; already delivered).
- The `municipios-brasileiros-raw.ts` catalog, to be generated and committed.
- Git flow: migration + use case contract change → **branch + PR + `/code-review`**.

---

## Out of scope (not to be implemented in this US)

- Map display (SVG or tiles). The coordinates are persisted for a future US.
- International trips / country selection (`paisIso`). The model does not lock this out: when it
  comes up, `paisIso` is added and `municipioIbge` becomes a detail of the Brazil case.
- Backfilling `municipioIbge` for legacy trips (text-to-code heuristic). Legacy data stays null;
  the user assigns it manually when editing.
- Making `municipioIbge` required also for **editing** a legacy trip (to be evaluated in a future
  US once the data set is mature).

---

## Definition of Done

- [ ] Additive migration applied (5 nullable columns on `Viagem`), no impact on existing data
- [ ] Catalog of 5,570 municipalities embedded, with MIT license/attribution in the repository
- [ ] Registering a new Trip requires a municipality; `descricao` becomes optional
- [ ] Editing allows changing the municipality; a legacy trip can be saved without a municipality (with a notice)
- [ ] The server resolves name/UF/coordinates from the catalog — it ignores those values coming from the client
- [ ] A nonexistent IBGE code is rejected server-side with the specified message
- [ ] `CriarVersaoPropostaUseCase` propagates the 5 new fields when copying Trips (regression test)
- [ ] Combo box search is accent- and case-insensitive, capped at 20 results, showing the state
- [ ] `HistoricoOperacao` records the municipality change on edit
- [ ] `calcularCustoEstimadoViagem` and the persisted Estimated Cost remain unchanged (regression test)
- [ ] Multi-tenant isolation preserved (global catalog; `Viagem` always scoped by `tenantId`)
- [ ] Acceptance criteria validated in staging
