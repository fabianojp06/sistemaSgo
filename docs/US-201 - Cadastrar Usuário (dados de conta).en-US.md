## [US-201] — Register User (account data)

**Module:** Administration — Operators and Permissions
**Epic:** EP085/24 — Administration Module
**Use case:** UC02.12 — Register Users
**Priority:** High
**Estimate:** G

**As an** SGO Administrator,
**I want** to register a new user by providing full name, email, login, and status,
**So that** I can grant a new operator access to the system, with the guarantee that the account
is created consistently between SGO and the identity provider (Clerk) and without me having to
set the password manually.

### Context and Business Rules

Covers the core of UC02.12. Registration is only complete when **three effects happen
atomically**:

1. creation of the **identity in Clerk with no email sent** (`IdentidadeUsuarioService.criarIdentidade` → `users.createUser({ skipPasswordRequirement: true })`);
2. persistence of the local `Usuario` record linked to `clerkUserId`;
3. a record in `HistoricoOperacao` (UC02.22, `TipoOperacao = USUARIO_CRIADO`).

Associating profiles is **mandatory** (RN0079) and detailed in [[US-202]]; access exceptions are
in [[US-203]]. This flow does not allow saving without at least one profile.

**Decision 2026-09-07 — no email sent at this stage.** Clerk remains the identity provider and
the user becomes able to authenticate right after registration, but the invitation/password-setup
email **is not sent**. The initial password is communicated/reset manually by the Administrator
(via UC02.13 — out of scope for this US). The user is created with
`situacaoAcesso = CONVITE_PENDENTE` (identity created, initial password not yet communicated). See
[[US-204]].

**Resilience order (compensation):** the call to Clerk happens **before** the local commit. If
Clerk fails, nothing is persisted. If the local persistence (or the log) fails **after** Clerk has
created the identity, the identity is removed (`IdentidadeUsuarioService.excluirIdentidade`) — no
orphaned account may remain on either side.

Applicable rules: RN0065 (unique login), RN0066 (login immutable after registration — enforced in
the edit US), REQ0074 (name, login, email, status mandatory), RN0059 (Administrator does not type
a password), RNF0004/EP085 + RN0022/EP083 (RBAC authorization revalidated on the backend — see
[[US-205]]).

Notes on adherence to the current schema (`prisma/schema.prisma`):
- `Usuario` today has no `login` field — **the foundation migration adds `login String @unique`**.
- `Usuario` receives `situacaoAcesso SituacaoAcessoUsuario @default(CONVITE_PENDENTE)`.
- The executing Administrator's `tenantId` is applied to the new `Usuario` (today `getTenantId()`
  returns `'default'` — provisional single-tenant).

### Acceptance Criteria

**Scenario 1 — Valid registration creates the identity in Clerk and the local record**
```gherkin
Given the authenticated user holds the "Administrador" profile in the current tenant
  And no user exists with login "j.silva" or with email "j.silva@fsg.org.br"
When they fill in Full Name="João da Silva", Email="j.silva@fsg.org.br", Login="j.silva", Status="Ativo"
  And select at least one Access Profile (per US-202)
  And click [Save]
Then the system creates the identity in Clerk WITHOUT sending an email
  And persists a Usuario record with clerkUserId, tenantId, nomeCompleto, email, login, status=ATIVO, situacaoAcesso=CONVITE_PENDENTE
  And persists the profile associations in the same transaction (US-202)
  And writes to HistoricoOperacao: tipoOperacao=USUARIO_CRIADO, usuarioId (executor), dataHoraEvento, descricao "Cadastrou o usuário [João da Silva]", ipEstacao, clerkSessionId, dadosSerializados with the created record (no secrets)
  And displays "User registered successfully. The initial password must be communicated to the user by the Administrator."
  And returns to the listing [UC02.11 — Manage Users]
```

**Scenario 2 — Required field left blank [ERROR LOCK]**
```gherkin
Given the Administrator is filling in the new-user form
When they leave any of the fields Full Name, Email, Login, or Status blank
  And try to save
Then the system blocks the persistence and creates nothing (neither in Clerk nor locally)
  And displays "Full Name, Email, Login, and Status are mandatory."
  And the form remains open with the data already entered intact
```

**Scenario 3 — Login already exists [ERROR LOCK] (RN0065)**
```gherkin
Given a user with login "j.silva" already exists in the tenant
When the Administrator enters Login="j.silva" and tries to save
Then the system blocks the operation
  And displays "This login is already in use. Choose another login."
  And no record is created in Clerk or in the local database
```

**Scenario 4 — Email already exists [ERROR LOCK]**
```gherkin
Given a user (local or in Clerk) already exists with email "j.silva@fsg.org.br"
When the Administrator tries to save with that email
Then the system blocks the operation
  And displays "This email is already associated with another user."
  And no record is created
```

**Scenario 5 — Invalid email format [ERROR LOCK]**
```gherkin
Given the Administrator enters Email="joao#fsg"
When they try to save
Then the system displays "Enter a valid email."
  And the operation is blocked
```

**Scenario 6 — Failure creating the identity in Clerk aborts the registration**
```gherkin
Given the form data is valid
When the users.createUser call to Clerk fails (network error or API rejection)
Then no Usuario record is persisted locally
  And the system displays "The access account could not be created right now. Please try again."
  And the exception is logged (console.error / SysLog — UC02.21)
```

**Scenario 7 — Failure in local persistence after the Clerk identity is created (compensation)**
```gherkin
Given the identity in Clerk was created successfully
When writing the Usuario record, the profile associations, or the HistoricoOperacao fails
Then the system deletes the newly created identity in Clerk (compensating rollback)
  And leaves no partial record on either side
  And displays "Failed to complete the registration. No account was created."
```

**Scenario 8 — Cancel registration (Alternative Flow A1)**
```gherkin
Given the Administrator has filled in part of the form
When they click [Cancel]
Then the system discards the entered data without creating anything
  And returns to the listing [UC02.11 — Manage Users]
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `Usuario` (INSERT), `UsuarioPerfil` (INSERT — via US-202), `UsuarioPerfilExcecao` (INSERT — via US-203), `HistoricoOperacao` (INSERT) |
| External service | Clerk — `IdentidadeUsuarioService.criarIdentidade` / `.excluirIdentidade` (port in `src/application/ports/IdentidadeUsuarioService.ts`). **No invitations / no email** at this stage |
| Transaction? | Yes — `prisma.$transaction`: `Usuario` + `UsuarioPerfil` + `UsuarioPerfilExcecao` + `HistoricoOperacao`. Call to Clerk **before** the commit; failure on commit ⇒ `excluirIdentidade` (compensation) |
| Requires lock? | No — INSERT. Uniqueness of `login` and `email` via a UNIQUE constraint + an upfront check for a friendly message (`isUniqueConstraintError` as a safety net) |
| Multi-tenant | `tenantId` from `getTenantId()` applied to the `Usuario` and to each `UsuarioPerfil` |
| Audit | `HistoricoOperacao`: tenantId, usuarioId (executor), tipoOperacao=USUARIO_CRIADO, descricao, ipEstacao, clerkSessionId, dadosSerializados (record snapshot, no password) |
| Layers | `CriarUsuarioUseCase` (`application/use-cases/administracao/`) orchestrates and opens the `$transaction`, calling `AssociarPerfisUsuarioUseCase` (US-202) and `DefinirExcecoesAcessoUsuarioUseCase` (US-203) with the `tx`. Action `criarUsuario` in `app/(autenticado)/administracao/usuarios/actions/criar.ts` |
| Business rule | RN0065, REQ0074, RN0059, RN0079 (≥ 1 profile, validated on the backend) |

### Dependencies

- **UC02.12 foundation** (merged, PR #22 + "no invitation" adjustment): schema/migration
  (`login`, `situacaoAcesso`, `TipoOperacao` enums), use-case stubs, `IdentidadeUsuarioService`
  port, `guardAdministrador()`, route scaffold
- [[US-202]] — profile association (same screen; saving requires ≥ 1 profile)
- [[US-204]] — reduced slice: only sets `situacaoAcesso = CONVITE_PENDENTE` + audit (email sending
  deferred)
- [[US-205]] — `guardAdministrador()` already protects the action

### Definition of Done

- [ ] Scenarios 1 through 8 implemented and approved in staging
- [ ] Account is never left orphaned: tested with a simulated failure in Clerk (Scenario 6) and
      with a simulated failure in local persistence (Scenario 7 — `excluirIdentidade` called)
- [ ] `login` and `email` with a UNIQUE constraint in the schema + an upfront check with a
      friendly message
- [ ] Administrator never sees a password field (RN0059) — UI inspection
- [ ] Audit log written on the success scenario with all mandatory fields
- [ ] Blocking validated on the backend, not only in the UI (covered jointly with US-205)
- [ ] Unit test of `CriarUsuarioUseCase` covering the compensation
