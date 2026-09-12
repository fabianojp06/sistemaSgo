## [US-202] — Associate Access Profiles with the User at Registration

**Module:** Administration — Operators and Permissions
**Epic:** EP085/24 — Administration Module
**Use case:** UC02.12 — Register Users (implements UC02.14 — Associate users with a Profile)
**Priority:** High
**Estimate:** M

**As an** SGO Administrator,
**I want** to select one or more access profiles for the user during registration,
**So that** I can define the set of modules and functionalities they will be able to access,
ensuring that no user exists without at least one profile (RN0079).

### Context and Business Rules

Implements UC02.14 in the context of registration ([[US-201]]). The "User access profile" panel
lists all **active** profiles of the tenant. When a profile is checked, the "Profile
Functionality(ies)" panel displays that profile's functionalities — the basis for exceptions
([[US-203]]).

Rules: RN0079 (at least 1 profile), RN0083 (a user may have several profiles), RN0056 (history per
association), RN0078 (only active functionalities of active modules — already guaranteed by
`ObterMenuUsuarioUseCase`/`usuarioTemFuncionalidade`). RN0040 (disconnect on associating a
profile) **does not apply** here — a newly created user has no active session; RN0040 applies to
the edit US.

Notes on schema adherence:
- `Perfil` today **does not have** `ativo` or `descricao` — **the foundation migration adds
  `ativo Boolean @default(true)` and `descricao String?`**.
- `UsuarioPerfil` already exists with `@@id([usuarioId, perfilId])` and a redundant `tenantId` —
  use as is.
- This use case receives the `tx` from the transaction opened in `CriarUsuarioUseCase` (US-201) —
  it does not open its own transaction.

### Acceptance Criteria

**Scenario 1 — Associating a single profile**
```gherkin
Given the Administrator is on the user registration screen with the account data filled in
  And the active profiles "Orçamentista" and "Consulta" exist in the tenant
When they check the "Orçamentista" profile in the User access profile panel
Then the Profile Functionality(ies) panel starts displaying, checked, all active functionalities of the "Orçamentista" profile
  And upon saving, the system persists a UsuarioPerfil association (usuario, profile "Orçamentista", tenantId)
  And writes to HistoricoOperacao tipoOperacao=USUARIO_PERFIL_ASSOCIADO, descricao "Perfil [Orçamentista] associado ao usuário [João da Silva]" (RN0056)
```

**Scenario 2 — Associating multiple profiles (RN0083)**
```gherkin
Given the Administrator checked "Orçamentista" and "Consulta"
When they save the registration
Then the system persists two UsuarioPerfil associations
  And writes one HistoricoOperacao record (USUARIO_PERFIL_ASSOCIADO) per association
```

**Scenario 3 — Saving without any profile [ERROR LOCK] (RN0079)**
```gherkin
Given the Administrator filled in the account data but did not check any profile
When they click [Save]
Then the system blocks the persistence (UsuarioSemPerfilError)
  And displays "The user must be associated with at least one access profile."
  And no account is created (neither in Clerk nor locally)
```

**Scenario 4 — Only active profiles are selectable**
```gherkin
Given the profile "Auditoria Externa" exists with ativo=false in the tenant
When the Administrator opens the User access profile panel
Then the profile "Auditoria Externa" is not shown in the list of available profiles
```

**Scenario 5 — Attempt to associate an inactive profile via a direct request [ERROR LOCK]**
```gherkin
Given the payload sent to the backend contains the id of an inactive profile or one from another tenant
When the action processes the request
Then the system rejects the operation (PerfilInativoError)
  And no record is created
```

**Scenario 6 — Unchecking a profile before saving**
```gherkin
Given the Administrator had checked "Orçamentista" and "Consulta"
When they uncheck "Consulta"
Then the Profile Functionality(ies) panel stops displaying "Consulta"'s functionalities
  And upon saving, only the association with "Orçamentista" is persisted
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `UsuarioPerfil` (INSERT — 1..N rows), `HistoricoOperacao` (INSERT — 1 per association) |
| Transaction? | Yes — receives and uses the `tx` from `CriarUsuarioUseCase`'s (US-201) `$transaction` |
| Data source | `ListarPerfisAtivosUseCase` — `Perfil` with `ativo:true` and the executor's `tenantId`; the functionalities panel reuses `ObterMenuUsuarioUseCase`'s projection |
| Backend validation | every `perfilId` in the payload must exist, be `ativo`, and belong to the `tenantId` (Scenario 5) |
| Business rule | RN0079 (≥ 1 profile, backend), RN0083 (N profiles), RN0078 (active only) |
| Audit | description in the format "Perfil [nome] associado ao usuário [nome]" per association (RN0056) |
| Layers | `AssociarPerfisUsuarioUseCase` + `ListarPerfisAtivosUseCase` in `application/use-cases/administracao/`; action `listarPerfisAtivos` in `.../usuarios/actions/perfis.ts`; component `PainelPerfisAcesso.tsx` (self-contained, emits a `string[]` of perfilIds) |

### Dependencies

- **UC02.12 foundation** — `Perfil.ativo`/`descricao`, `AssociarPerfisUsuarioUseCase` stub,
  `USUARIO_PERFIL_ASSOCIADO` enum
- [[US-201]] — owns the transaction and the screen; consumes `PainelPerfisAcesso` via props
- Profiles registered and active in the tenant (the seed already creates "Administrador" and
  "Gestor Master")

### Definition of Done

- [ ] Scenarios 1 through 6 approved in staging
- [ ] "Minimum 1 profile" validation on the backend (not only in the UI)
- [ ] Only active profiles listed; an inactive profile/one from another tenant is rejected on the
      backend
- [ ] 1 audit record per associated profile
- [ ] Associations persisted in the same transaction as the user creation
- [ ] Unit test of `AssociarPerfisUsuarioUseCase` and `ListarPerfisAtivosUseCase`
