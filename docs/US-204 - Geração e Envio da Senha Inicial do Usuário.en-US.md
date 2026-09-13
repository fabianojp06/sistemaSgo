## [US-204] — Initial User Access (email dispatch DEFERRED)

**Module:** Administration — Operators and Permissions
**Epic:** EP085/24 — Administration Module
**Use case:** UC02.12 — Register Users (implements UC02.18 — Generate User Password)
**Priority:** High (reduced slice) · Medium (deferred slice)
**Estimate:** P

**As an** SGO Administrator,
**I want** the system to record, when a user is registered, that the account has no password set yet, and to never set the password manually myself,
**So that** access control stays auditable (RN0050, RN0059) while automatic email dispatch is out of scope.

### Context and Business Rules

**Decision 2026-09-07:** Clerk remains the identity provider, but **automatic email/invitation dispatch is deferred**. Consequence for UC02.18:

- **Reduced slice (this phase — ships with US-201):** upon completing registration, the system sets `Usuario.situacaoAcesso = CONVITE_PENDENTE` and writes `HistoricoOperacao` (`USUARIO_ACESSO_GERADO`, RN0050). The Administrator communicates the initial password to the user through an external channel; **password reset** is handled by the edit US (UC02.13), not here. No password is generated, displayed, or logged by the SGO (RN0059).
- **Deferred slice (out of scope for now):** Clerk invitation email dispatch, the `CONVITE_ENVIADO` / `FALHA_ENVIO_CONVITE` states, the [Resend invitation] action, and `ReenviarConviteUsuarioUseCase`. Reopen when email dispatch enters the backlog.

Password policy (RN0039) remains Clerk's responsibility (dashboard configuration) and is applied when the user actually sets their password.

### Acceptance Criteria — reduced slice

**Scenario 1 — Registration records access status and audit**
```gherkin
Given the registration of user "João da Silva" was completed (US-201)
Then the Usuario record has situacaoAcesso = CONVITE_PENDENTE
  And HistoricoOperacao records tipoOperacao=USUARIO_ACESSO_GERADO, descricao "Gerou o acesso inicial do usuário [João da Silva]" (RN0050)
  And no plaintext password is displayed to the Administrator or written to a log
```

**Scenario 2 — The Administrator never provides a password (RN0059)**
```gherkin
Given the Administrator is on the user registration screen
Then there is no "Senha" or "Confirmar Senha" field in the form
  And there is no action that lets the Administrator type the user's password
```

**Scenario 3 — Access status visible in the listing**
```gherkin
Given there are users with situacaoAcesso = CONVITE_PENDENTE and = ACESSO_ATIVO
When the Administrator opens [UC02.11 — Maintain Users]
Then the "Access status" column shows each user's value with a badge
```

**Scenario 4 — Promotion to ACESSO_ATIVO on first login**
```gherkin
Given user "João da Silva" has situacaoAcesso = CONVITE_PENDENTE
When they authenticate for the first time (Clerk's session.created / user.updated event)
Then the webhook updates situacaoAcesso to ACESSO_ATIVO
```

### Acceptance Criteria — deferred slice (do not implement now)

- Invitation email dispatch at registration; `CONVITE_ENVIADO` / `FALHA_ENVIO_CONVITE` states.
- [Resend invitation] action and blocking it for `ACESSO_ATIVO`.
- Rejection of a weak password by Clerk on the password-setup link.

### Technical Impact (guidance for dev)

| Aspect | Detail |
|---|---|
| External service | Clerk — `IdentidadeUsuarioService.criarIdentidade` (no email). `reenviarConvite` does NOT exist in this phase |
| Tables affected | `Usuario.situacaoAcesso` (inside US-201's `$transaction`), `HistoricoOperacao` (INSERT) |
| Transaction? | Yes — part of `CriarUsuarioUseCase`'s (US-201) `$transaction` |
| Security | no password generated/transported/logged; no password field in the UI (RN0059) |
| Audit | RN0050 — `USUARIO_ACESSO_GERADO` at registration |
| Webhook | `session.created` / `user.updated` promotes `situacaoAcesso` → `ACESSO_ATIVO` (`app/api/webhooks/clerk/route.ts`) |
| Layers | `GerarAcessoInicialUsuarioUseCase` in `application/use-cases/administracao/` (reduced slice). `ReenviarConviteUsuarioUseCase` and `actions/convite.ts` remain a stub that throws "deferred" |
| Component | `BadgeSituacaoAcesso.tsx` |

### Dependencies

- **UC02.12 foundation** — `SituacaoAcessoUsuario`, `IdentidadeUsuarioService` port, `GerarAcessoInicialUsuarioUseCase` stub, `USUARIO_ACESSO_GERADO` enum
- [[US-201]] — the reduced slice runs inside the registration transaction
- Deferred slice: depends on a future decision about the email provider

### Definition of Done — reduced slice

- [ ] Scenarios 1 through 4 approved in staging
- [ ] No point in the code generates, displays, or logs a plaintext password
- [ ] Registration form has no password field
- [ ] `situacaoAcesso` reflected in the UC02.11 listing with a badge
- [ ] Webhook promotes `situacaoAcesso` to `ACESSO_ATIVO` on first access
- [ ] `USUARIO_ACESSO_GERADO` written at registration
- [ ] Unit test of `GerarAcessoInicialUsuarioUseCase`
- [ ] `ReenviarConviteUsuarioUseCase` documented as deferred (stub that throws an explicit error)
