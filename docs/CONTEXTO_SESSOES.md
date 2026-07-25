# Contexto entre sessões

Este arquivo é a fonte de verdade **durável** de contexto de trabalho entre sessões do Claude Code neste projeto. Diferente da memória padrão (que fica em `~/.claude`, fora do repositório e pode se perder se o ambiente/container for recriado), este arquivo está versionado no git e sobrevive a qualquer reset de ambiente.

Atualize este arquivo (e faça commit) sempre que:
- Uma investigação ou decisão importante precisar ser retomada em uma sessão futura.
- O usuário pedir explicitamente para "salvar o contexto" ou "lembrar disso para a próxima vez".

## 2026-07-25 — Status dos Casos de Uso UC01 (Módulo de Autenticação e Tela Principal)

Levantamento de implementação + testes, feito com apoio das skills do time (fullstack-dev/techlead-fsg para implementação, analista-testes-qa para testes).

| UC | Implementado | Testes unitários | E2E | Verdict QA |
|---|---|---|---|---|
| UC01.01 Efetuar Login | Sim (`app/login/actions.ts`, `AutenticarUsuarioUseCase`) | Indireto via `AutenticarUsuarioUseCase.test.ts` (8/8) — a Server Action em si não tem teste próprio | Não | Parcialmente testado |
| UC01.02 Autenticar Usuário | Sim (`AutenticarUsuarioUseCase.ts`, `regras-bloqueio.ts`) | `AutenticarUsuarioUseCase.test.ts` (8/8) + `regras-bloqueio.test.ts` (6/6) | Não | Bem testado (nível unitário) |
| UC01.03 Exibir Tela Principal | Sim (`app/page.tsx`, `ObterMenuUsuarioUseCase`) | `ObterMenuUsuarioUseCase.test.ts` (2/2) — `page.tsx`/UI sem teste | Não | Parcialmente testado |
| UC01.04 Efetuar Logoff | Sim (`app/logoff/actions.ts`, `EfetuarLogoffUseCase`) | `EfetuarLogoffUseCase.test.ts` (3/3) — action layer sem teste próprio | Não | Parcialmente testado |
| UC01.05 Bloquear Usuário | Sim (`BloquearUsuarioUseCase.ts`) | `BloquearUsuarioUseCase.test.ts` (2/2) | Não | Bem testado (nível unitário) |

**Gaps de implementação conhecidos:**
- UC01.01: link "Esqueci minha senha" aponta para rota `/esqueci-minha-senha` inexistente.
- UC01.02: aviso de "última tentativa antes do bloqueio" (`ehUltimaTentativa`, CA-01.02.16) existe na regra mas não está conectado ao fluxo — usuário nunca recebe o aviso.
- UC01.05: `notificarAdministrador()` é stub vazio, sem envio real (e-mail/Slack).

**Gaps de teste (transversal a todos os UCs):** não existe nenhum teste E2E/integração (sem Playwright/Cypress no projeto). Toda a cobertura é unitária, na camada de use-case/domínio. `npx vitest run`: 6 arquivos, 22 testes, todos passando, 0 falhas/skips.

**Próximo passo combinado:** antes de qualquer nova implementação, priorizar (1) testes E2E do fluxo real de login/logoff via UI e (2) fechar os 3 gaps de implementação acima.

## 2026-07-25 (cont.) — Suíte E2E Playwright para os P0 do UC01 (commit `09003f7`)

QA definiu plano de testes E2E (Playwright, via `@clerk/testing` para evitar UI/captcha do Clerk) com 8 cenários (CT-001 a CT-008); os 5 P0 foram implementados pelo fullstack-dev e revisados/corrigidos após review da QA:

- `e2e/login.spec.ts` — CT-001 (login válido + menu carregado, UC01.01+UC01.03), CT-002 (senha inválida)
- `e2e/lockout.spec.ts` — CT-004 (bloqueio após esgotar tentativas; lê `ParametroSistema.limiteTentativasLogin` real do tenant em vez de hardcode)
- `e2e/logoff.spec.ts` — CT-006 (logoff via modal de confirmação)
- `e2e/route-protection.spec.ts` — CT-007 (acesso direto sem sessão → redirect)
- `e2e/support/{env,parametro-sistema,reset-lockout-user,global-setup}.ts` — infra de suporte

**Estado real:** código compila (`npx tsc --noEmit` limpo) e não quebrou a suíte unitária (`npx vitest run` — 22/22, após excluir `e2e/` do `vitest.config.ts`, que sem isso tentava rodar os specs do Playwright). **Mas a suíte E2E nunca foi executada de fato** — este ambiente (Codespace) não tem `.env` com credenciais reais de Clerk/Supabase, então `next dev` não sobe. Antes de confiar nela, alguém precisa: criar `.env` com instância Clerk de teste + banco de teste, dois usuários de teste sincronizados na tabela `Usuario` (um "feliz", um dedicado a bloqueio — nunca o mesmo), preencher as variáveis `E2E_*` (ver `.env.example` e `e2e/README.md`), e rodar `npm run test:e2e` de verdade pelo menos uma vez.

**Riscos conhecidos documentados (aceitos, não bloqueantes):** a suíte não pode rodar em paralelo contra o mesmo banco de teste (usuário de lockout é compartilhado, sem lock entre processos — só dentro do mesmo processo Playwright). Ver aviso em `e2e/README.md`.

**Pendente (P1, não implementado ainda):** CT-003 (usuário inexistente), CT-005 (mensagem específica de bloqueio), CT-008 (usuário em manutenção/inativo).

**Próximo passo combinado:** configurar `.env` de teste e rodar a suíte de verdade pela primeira vez; depois avaliar os P1 e os 3 gaps de implementação já conhecidos.

---

## Como usar este arquivo em sessões futuras

No início de uma sessão, se o usuário perguntar "qual o contexto/status de X", leia este arquivo antes de assumir que a memória padrão (`~/.claude/.../memory/`) está atualizada — o ambiente deste projeto (Codespace) pode ter sido recriado desde a última sessão, apagando a memória padrão sem apagar o repositório.
