## [US-205] — Access Restriction and Backend RBAC Validation for User Registration

**Module:** Administration — Operators and Permissions
**Epic:** EP085/24 — Administration Module
**Use case:** UC02.12 — Register Users (cross-cutting guard; foundation for UC02.10/UC02.11/UC02.13)
**Priority:** High
**Estimate:** P

**As the** person responsible for SGO security,
**I want** user registration to be executable only by someone with the Administrator profile, validated on the backend,
**So that** account creation by unauthorized users is prevented, even via a direct call to the Server Action / API (RNF0004 of EP085, RN0022 of EP083).

### Context and Business Rules

The Administration module is accessible **only** to the Administrator profile (RN_SEED_003, EP085 general considerations). Hiding the button/menu in the UI is not enough: every write and sensitive-read Server Action of the module must revalidate authorization on the server on every request.

The `guardAdministrador()` helper (created in the **foundation** and already called by every action of [[US-201]], [[US-202]], [[US-204]]) performs:

1. Clerk's `auth()` — requires a valid session (`userId`);
2. `ehAdministrador(user)` — `publicMetadata.role === 'ADMIN'` (source: `src/infrastructure/auth/clerk.ts`);
3. database revalidation: a `UsuarioPerfil` for `usuarioId` exists with `Perfil.nome = "Administrador"` in the current `tenantId`;
4. returns `{ tenantId, usuarioId, clerkSessionId }` or throws `NaoAutorizadoError`.

This US delivers the guard's **hardening and E2E coverage**; the helper's core already ships in the foundation so it doesn't block the other workstreams.

### Acceptance Criteria

**Scenario 1 — A user without the Administrator profile does not see the functionality**
```gherkin
Given the authenticated user only has the "Orçamentista" profile
When they navigate through the system
Then the "Administração" menu is not shown (ObterMenuUsuarioUseCase does not return the module)
  And the /administracao/usuarios route is not reachable through navigation
```

**Scenario 2 — Direct Server Action call by a non-Administrator [ERROR LOCK]**
```gherkin
Given a user without the Administrator profile triggers the registration Server Action with a valid payload
When the backend processes the request
Then guardAdministrador() throws NaoAutorizadoError before any side effect
  And the action responds { sucesso: false, mensagem: "Você não tem permissão para esta operação." }
  And no account is created, neither in Clerk nor in the local database
  And the attempt is logged (console.error / SysLog — UC02.21)
```

**Scenario 3 — publicMetadata.role tampered with but no profile in the database [ERROR LOCK]**
```gherkin
Given the token carries publicMetadata.role="ADMIN" but the user has no "Administrador" UsuarioPerfil in the tenant
When the action processes it
Then the database revalidation (step 3) fails and the operation is blocked
```

**Scenario 4 — Expired / missing session**
```gherkin
Given the Administrator's session has expired
When they try to save a registration
Then guardAdministrador() throws NaoAutorizadoError (auth() without a userId)
  And the UI redirects to /login
  And no data is persisted
```

**Scenario 5 — Tenant isolation**
```gherkin
Given the Administrator of tenant A triggers the action with data intended for tenant B
When the backend processes it
Then the tenantId used is always the one resolved by getTenantId() from the request (tenant A)
  And it is not possible to create a user in another tenant via the payload
```

**Scenario 6 — System INATIVO (UC02.01 / RN0060)**
```gherkin
Given the SGO has status INATIVO
When the executing Administrator accesses /administracao/usuarios
Then registration remains accessible to them (access restricted to the Administration module, RN0060)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Component | `guardAdministrador()` in `app/(autenticado)/administracao/usuarios/actions/guard.ts` (or `lib/auth/` if reused by other modules) |
| Layers | the guard runs at the top of every action in the module, before the use case/DB. Never trust `publicMetadata` alone — always revalidate against the database (step 3) |
| Multi-tenant | `tenantId` always from `getTenantId()`, never from the payload (Scenario 5) |
| Route protection | `app/(autenticado)/administracao/layout.tsx` (or the existing layout + a check) denies Server Component rendering for a non-Administrator; complements (does not replace) the guard in the actions |
| Audit | denied attempt ⇒ `console.error` + (once SysLog/UC02.21 exists) a record with actor, IP, timestamp |
| Business rule | RNF0004 (EP085), RN0022 (EP083), RN_SEED_003, RN0060 |
| Tests | E2E with a non-Administrator user calling the action directly; unit test of the guard covering all 4 failure paths |

### Dependencies

- **UC02.12 foundation** — `guardAdministrador()` core + `NaoAutorizadoError` + `layout.tsx` scaffold for the `/administracao` route
- `ehAdministrador()` and `auth()` already exist
- The seed already creates the "Administrador" profile per tenant and assigns it to anyone with `role: 'ADMIN'`

### Definition of Done

- [ ] Scenarios 1 through 6 approved in staging
- [ ] Backend blocking validated with an automated test of a direct call to the action (Scenarios 2 and 3)
- [ ] Database revalidation beyond `publicMetadata` (Scenario 3)
- [ ] `tenantId` always from the request, never from the payload (Scenario 5)
- [ ] Menu and route hidden/denied for a non-Administrator
- [ ] Denied attempts logged
- [ ] The Administrator keeps access to the module with the system INATIVO (RN0060)
