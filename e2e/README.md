# Testes E2E — Módulo de Autenticação (UC01)

Suíte Playwright cobrindo os cenários P0 definidos pela QA (ver `docs/CONTEXTO_SESSOES.md`).

## Pré-requisitos

1. `.env` preenchido com `DATABASE_URL`, `CLERK_SECRET_KEY` e `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` reais
   (instância de teste/free do Clerk e banco de teste — nunca produção).
2. Dois usuários de teste criados no Clerk **e** sincronizados na tabela `Usuario` (via seed ou webhook):
   - Usuário "feliz", usado em CT-001, CT-002, CT-006 — nunca deixe-o ser bloqueado.
   - Usuário "de bloqueio", usado exclusivamente em CT-004 (`lockout.spec.ts`) — o teste reseta
     `bloqueado`/`contadorFalhas` desse usuário antes e depois de rodar, então nunca reutilize
     esse usuário para outro cenário.
3. Variáveis de ambiente (ver `.env.example`):
   `E2E_CLERK_USER_USERNAME` / `E2E_CLERK_USER_PASSWORD`,
   `E2E_CLERK_LOCKOUT_USER_USERNAME` / `E2E_CLERK_LOCKOUT_USER_PASSWORD`, `E2E_TENANT_ID`.

## Rodar

```bash
npm run test:e2e
```

> **Não rode esta suíte em paralelo** contra o mesmo banco de teste (ex: dois workers de CI, ou CI
> e um dev local ao mesmo tempo). `lockout.spec.ts` manipula um usuário compartilhado
> (`resetarUsuarioDeBloqueio`) sem lock — `fullyParallel: false` no `playwright.config.ts` só
> serializa os testes dentro do mesmo processo Playwright, não impede que **outro processo**
> (outro job de CI, outra máquina) rode a suíte ao mesmo tempo contra o mesmo banco. Garanta
> execução serial no pipeline de CI (um job por vez para este banco de teste).

O Playwright sobe o `next dev` automaticamente (`webServer` em `playwright.config.ts`) e usa
`@clerk/testing` para autenticar sem depender da UI/captcha do Clerk.

## Cenários cobertos (P0)

| Spec | Caso de teste |
|---|---|
| `login.spec.ts` | CT-001 login válido, CT-002 senha inválida |
| `lockout.spec.ts` | CT-004 bloqueio após esgotar tentativas |
| `logoff.spec.ts` | CT-006 logoff encerra sessão |
| `route-protection.spec.ts` | CT-007 rota protegida sem sessão |

Cenários P1 (CT-003, CT-005, CT-008) ficam para a próxima iteração — ver `docs/CONTEXTO_SESSOES.md`.
