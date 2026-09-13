## [US-203] — Define Access Permission Exceptions at Registration

**Module:** Administration — Operators and Permissions
**Epic:** EP085/24 — Administration Module
**Use case:** UC02.12 — Register Users (Alternative Flow A2; implements UC02.10 — Define Access Permission)
**Priority:** Medium
**Estimate:** M

**As an** SGO Administrator,
**I want** to uncheck specific functionalities of a profile associated with the user during registration,
**So that** I can withdraw access to individual profile items from that user without having to create a new profile (REQ0080), keeping the RBAC model with per-user exceptions.

### Context and Business Rules

Implements Alternative Flow A2 of UC02.12 and REQ0080/REQ0081. The exception **only withdraws** access — it never grants beyond what the profile gives.

If every functionality of a profile is unchecked, the profile itself is unchecked (REQ0081), which re-triggers the minimum-1-profile lock from [[US-202]].

**Architectural risk (P1) — blast radius of the permission resolver.** This US changes the effective permission calculation, today in `usuarioTemFuncionalidade()` and `ObterMenuUsuarioUseCase` — code shared with the menu and feature access control that is **already in production**. Mandatory mitigation:

- the exception is **additive by absence**: no row in `UsuarioPerfilExcecao` ⇒ current behavior stays intact (LEFT JOIN / `NOT EXISTS`);
- the foundation freezes the signature of `resolverPermissaoEfetiva(...)` and makes `ObterMenuUsuarioUseCase` + `usuarioTemFuncionalidade` already call this helper as a *passthrough*; this US only swaps the body;
- this US's PR **must** run and attach the result of `ObterMenuUsuarioUseCase.test.ts` and of the `verificarPermissao` tests as a regression gate.

Effective resolution model:
```
funcionalidades_efetivas(usuario) =
   ⋃ (active functionalities of the user's profiles)
   −  { (perfilId, funcionalidadeId) ∈ UsuarioPerfilExcecao of the user }
```

Notes on schema adherence:
- **The foundation migration creates `model UsuarioPerfilExcecao`** with `@@id([usuarioId, perfilId, funcionalidadeId])` and `tenantId`.
- This use case receives the `tx` from `CriarUsuarioUseCase`'s ([[US-201]]) transaction.

### Acceptance Criteria

**Scenario 1 — Creating an exception by unchecking a functionality (A2)**
```gherkin
Given the Administrator checked the "Orçamentista" profile, whose active functionalities include "Lançar Despesa" and "Emitir Relatório"
When they click the "Emitir Relatório" functionality in the Profile Functionality(ies) panel
Then the system unchecks "Emitir Relatório"
  And upon saving, persists a row in UsuarioPerfilExcecao (usuario, profile "Orçamentista", functionality "Emitir Relatório", tenantId)
  And writes HistoricoOperacao tipoOperacao=USUARIO_PERFIL_EXCECAO_DEFINIDA describing the access withdrawal
  And the created user does NOT have "Emitir Relatório" in the menu nor passes usuarioTemFuncionalidade("...emitir-relatorio"), even though they belong to the "Orçamentista" profile
```

**Scenario 2 — A functionality without an exception remains accessible**
```gherkin
Given the user was created with an exception only on "Emitir Relatório" in the "Orçamentista" profile
Then "Lançar Despesa" remains in the menu and usuarioTemFuncionalidade returns true for it
```

**Scenario 3 — Unchecking every functionality unchecks the profile (REQ0081)**
```gherkin
Given the "Consulta" profile has exactly two active functionalities and both are checked
When the Administrator unchecks both
Then the system automatically unchecks the "Consulta" profile in the user's Access profile panel
  And if "Consulta" was the only profile, the US-202 "at least one profile" lock applies upon saving
```

**Scenario 4 — Reverting the exception before saving**
```gherkin
Given the Administrator had unchecked "Emitir Relatório"
When they check "Emitir Relatório" again
Then no UsuarioPerfilExcecao row is persisted for that functionality
  And access follows entirely what the profile defines
```

**Scenario 5 — Regression: a user with no exceptions has unchanged behavior**
```gherkin
Given an existing user with no rows in UsuarioPerfilExcecao
When the menu and permission checks are recalculated after this US
Then the result is identical to before (ObterMenuUsuarioUseCase and verificarPermissao suites green)
```

**Scenario 6 — An exception does not grant access beyond the profile**
```gherkin
Given the payload contains an "exception" for a functionality the profile does not have
When the action processes it
Then the row is ignored/rejected (the exception only removes; it never adds)
```

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| Tables affected | `UsuarioPerfilExcecao` (INSERT), `HistoricoOperacao` (INSERT — 1 per exception) |
| Transaction? | Yes — receives the `tx` from `CriarUsuarioUseCase` (US-201) |
| Shared code changed | `domain/.../resolverPermissaoEfetiva.ts` (actual body); `ObterMenuUsuarioUseCase` and `usuarioTemFuncionalidade` already delegate to it since the foundation |
| Business rule | an exception only **withdraws** access (REQ0080); unchecking all ⇒ unchecks the profile (REQ0081); resolution = profiles − exceptions |
| Index | `UsuarioPerfilExcecao @@index([tenantId])` + composite PK covers the per-user LEFT JOIN |
| Audit | 1 `USUARIO_PERFIL_EXCECAO_DEFINIDA` record per exception created |
| Layers | `DefinirExcecoesAcessoUsuarioUseCase` in `application/use-cases/administracao/`; `PainelExcecoesPerfil.tsx` component (self-contained, emits `ExcecaoInput[]`) |
| PR gate | run the menu + permission `npm test`; attach the result |

### Dependencies

- **UC02.12 foundation** — `model UsuarioPerfilExcecao`, `resolverPermissaoEfetiva` signature frozen + passthrough delegation already done, `USUARIO_PERFIL_EXCECAO_DEFINIDA` enum
- [[US-202]] — parent panel of functionalities already rendered and the "selected profile" concept
- [[US-201]] — owns the transaction and the screen

### Definition of Done

- [ ] Scenarios 1 through 6 approved in staging
- [ ] Effective permission calculation considers exceptions (test: access denied in the menu and in `usuarioTemFuncionalidade`)
- [ ] Menu/permission regression suite green and attached to the PR
- [ ] Unchecking every functionality unchecks the profile
- [ ] Exceptions persisted in the same transaction as the registration
- [ ] Audit per exception
- [ ] Unit test of `DefinirExcecoesAcessoUsuarioUseCase` and of `resolverPermissaoEfetiva` (with and without exceptions)
