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

## 2026-07-26 — Clerk voltou para chaves de desenvolvimento; login em produção (Vercel) funcionando

Na sessão anterior o usuário havia trocado o Clerk do projeto na Vercel para chaves de **produção**, mas isso quebrou o app (`https://sistema-sgo.vercel.app`) porque a instância de produção do Clerk exige domínio próprio verificado (DNS), e o projeto só tem o domínio `*.vercel.app`. Foi decidido reverter para chaves de **desenvolvimento** (não exigem domínio) até que exista domínio próprio.

**O que foi feito:**
- Instalada a Vercel CLI globalmente (`npm install -g vercel`) e vinculado este diretório ao projeto `fabianojp06s-projects/sistema-sgo` (`vercel link`).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` trocadas na Vercel (Production + Preview) para a instância de desenvolvimento `wondrous-mink-17.clerk.accounts.dev` (`pk_test_...`/`sk_test_...`).
- Removida `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (variável órfã, apontava para rota `/sign-up` que não existe — o app só usa `/login`). Confirmado `NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"`.
- Redeploy de produção feito via `vercel deploy --prod`.

**Bug real encontrado (mascarado pela mensagem genérica "Não foi possível estabelecer conexão com o servidor"):** `AutenticarUsuarioUseCase.execute()` (`src/application/use-cases/auth/AutenticarUsuarioUseCase.ts:44`) busca o usuário na tabela `Usuario` do Supabase e usa o `clerkUserId` salvo lá para chamar `clerk.users.getUser()`. Esse ID havia sido criado na instância de **produção** do Clerk — inexistente na instância de desenvolvimento agora ativa (Clerk trata cada instância como um banco de usuários totalmente separado). Erro real nos logs da Vercel (`vercel logs`): `resource_not_found` / `No user was found with id user_...`.

**Correção aplicada:** usuário criou um novo usuário de teste na instância de desenvolvimento do Clerk (`user_3H3OtplL0Wi5Cv1rYHHLTPZsyXG`, e-mail `consultfabiano@gmail.com`) e rodou manualmente no Supabase SQL Editor:
```sql
UPDATE "Usuario" SET "clerkUserId" = 'user_3H3OtplL0Wi5Cv1rYHHLTPZsyXG' WHERE email ILIKE 'consultfabiano@gmail.com';
```
Senha resetada no Clerk. **Login confirmado funcionando em produção** (`https://sistema-sgo.vercel.app/login`) com esse usuário.

**Lição para o futuro:** ao trocar a instância do Clerk (dev ↔ produção) neste projeto, todo `clerkUserId` salvo em `Usuario` fica órfão e precisa ser resincronizado manualmente (não há job de sync automático). Antes de trocar de instância de novo, avaliar se vale a pena automatizar essa migração/sincronização de usuários.

**Decisão do usuário (2026-07-26):** login/autenticação em produção está **encerrado como resolvido** para os fins deste projeto de estudo. A suíte E2E Playwright (criada em `09003f7`) segue existindo no repo mas **nunca foi executada de fato** — decisão consciente de não rodá-la agora, pois o foco do projeto vai mudar para outro ponto. Não retomar a suíte E2E nem os gaps de implementação (P1: CT-003/CT-005/CT-008; link "esqueci senha", aviso de última tentativa, `notificarAdministrador()` stub) por iniciativa própria — só se o usuário pedir explicitamente.

---

## 2026-08-04 — registrada às 10:25 -03:00 — US-110, US-113, READMEs e tradução EN-US

Retomando de onde a sessão de 2026-08-03 parou (US-106→US-108a + US-112 concluídas, US-109
implementada em seguida).

**O que foi feito, em ordem:**

1. Sincronização inicial + ajuste solto de versão do Prisma (`^6.3.0`→`^6.19.3`), commit `9d60db1`.
2. **US-110 — Bens, Serviços e Equipamentos (ADR-023)**: refinada (AN/PO) → ADR-023 (Tech Lead) →
   implementada ponta a ponta (fullstack-dev). Novo model `ItemPatrimonial`: `metaId` **opcional**
   (obrigatório só quando `Proposta.categoria=POR_META`, diferente de `Viagem`/ADR-022, que exige
   Meta sempre). `contaId` aceita qualquer conta analítica, sem filtro de grupo
   "Imobilizado/Intangível" (tag não existe no schema). Exclusão sempre soft delete. Commit
   `02c676a`.
3. **README.md**: reescrito com layout moderno (badges, seções, arquitetura em camadas) em PT-BR
   + nova versão `README.en-US.md`, com link cruzado entre as duas. Commit `17dc03c`.
4. **US-113 — Qtde. Empregado (ADR-024)**: refinada (AN/PO), com achado estrutural relevante:
   `EmpregadoHeadcount` só tinha `propostaId`, sem `metaId` — usuário decidiu corrigir o gap (não
   simplificar a US). Segundo achado, ao acionar o dev: `CadastrarEmpregadoUseCase` bloqueava
   totalmente Proposta `POR_META` — usuário decidiu também liberar Empregado para `POR_META` na
   mesma rodada, para não deixar `metaId` como coluna morta. Resultado: `EmpregadoHeadcount.metaId`
   adicionado (sem backfill — confirmado 0 registros em produção antes de migrar); novo model
   `QtdeEmpregado` (snapshot de headcount por período e documento de respaldo, quantitativos
   sempre calculados por COUNT, nunca input direto). Commit `3beb9fc`. 187 testes passando,
   typecheck limpo.
5. **Tradução EN-US da documentação**: avançou de 6/21 para 12/21 (US-006, US-007, US-008,
   US-008a, US-101, US-102 traduzidos nesta sessão). Commits `6d33dea` e `a919afc`.
   Já traduzidos: UC03.00, US-001 a US-008, US-008a, US-101, US-102.
   Próximos 3: US-103, US-104, US-105.
   Faltam depois: US-106, US-107, US-107a, US-108, US-108a, US-112 (completando os 21 da lista
   original) — e, fora da lista original (criada depois do levantamento), a **US-113** ainda sem
   `.en-US.md`.
6. Criado (por engano, em local errado) um arquivo duplicado `CONTEXTO_SESSOES.md` na raiz do
   repo — corrigido nesta mesma sessão: o conteúdo foi movido para este arquivo (o real, em
   `docs/`) e o duplicado da raiz foi removido.

**Estado do repositório ao final desta sessão:** tudo commitado e enviado a `origin/master`.
Suíte de testes: 187 passando (`npm test`). Typecheck limpo (`npx tsc --noEmit`).

**Nenhuma US refinada e desbloqueada aguardando dev no momento deste registro** — US-008a segue
bloqueada por decisão de produto pendente (não liberar semáforo com `valorRealizado` parcial);
US-111 (Termo de Ajuste) segue bloqueada por gaps de arquitetura (conta Nível 7, entidade Termo
de Parceria, perfil Gestor Master).

**Próximo passo combinado (menor esforço primeiro):** (1) continuar a tradução EN-US
(US-103/104/105, depois seguir a lista); (2) traduzir a US-113 (pendente, fora da lista original);
(3) revisitar as decisões de produto/arquitetura pendentes de US-008a/US-111 se houver novidade.

---

## 2026-08-04 — registrada às 18:08 -03:00 — US-111 desbloqueada (ADR-025)

Continuação da sessão da manhã do mesmo dia (registro acima, 10:25). O usuário respondeu aos 3
bloqueios de US-111 (Termo de Ajuste entre Contas Analíticas, UC03.13) e pediu que o Tech Lead
(skill `techlead-fsg`) produzisse o ADR de desbloqueio.

**Achado principal:** 2 dos 3 gaps registrados na memória/backlog **já não existiam** — a memória
estava desatualizada em relação ao schema real, não o código:

1. **Nível 7 de conta**: falso gap. O gate real de "conta analítica" é
   `ContaContabil.isAnalitica: Boolean`, não `nivel` (que só vai até 4). Esse mapeamento já
   estava aplicado em US-110, só não tinha sido propagado para US-111.
2. **"Termo de Parceria" como entidade**: falso gap. Já existe como
   `enum TipoProposta { CONTRATO, TERMO_DE_PARCERIA }`, em uso desde US-101/US-102. Não precisa
   de entidade nova — o botão "Criar → Contrato / Termo de Parceria" do menu só popula
   `Proposta.tipo`.
3. **Perfil "Gestor Master"**: único gap genuíno. Resolvido **sem mudar o schema de `Perfil`**
   (que já é nome livre por tenant) — "Gestor Master" nasce como uma linha de dado, não migration.
   A "aprovação em dois níveis" do Gherkin vira uma nova tabela `TermoAjuste` com
   `status: PENDENTE_APROVACAO_N1 → PENDENTE_APROVACAO_GESTOR_MASTER → HOMOLOGADO | REJEITADO`,
   cada transição checando `PerfilFuncionalidade` de uma `Funcionalidade` própria por etapa.

**Decisão (ADR-025):** US-111 sai de "🔴 Bloqueado" para "🔜 Próximo da Fila" (item 9) no
`docs/BACKLOG - Kanban EP118-24 Módulo de Cadastros.md`. Sem itens em aberto para o AN/PO —
só um ponto de refinamento não-bloqueante (nomes exatos das 2 `Funcionalidade` de aprovação e
se o 1º nível usa perfil já existente ou novo).

**O que foi feito:**
- ADR-025 produzido pela skill `techlead-fsg`.
- Memória atualizada: nova entrada do ADR-025, `us111_termo_ajuste_refinamento.md` marcado como
  desbloqueado, backlog kanban de memória atualizado, índice `MEMORY.md` atualizado.
- `docs/BACKLOG - Kanban EP118-24 Módulo de Cadastros.md` editado (US-111 movida de coluna).
- Commit `525ae3f`, enviado a `origin/master`.

**Estado do repositório ao final desta sessão:** tudo commitado e enviado a `origin/master`
(commit `525ae3f`). Nenhuma implementação de código feita ainda — só a decisão de arquitetura
(ADR) e a atualização de backlog/memória. Usuário avisou que retorna em ~90 minutos (a partir de
18:08 -03:00, ou seja, por volta de 19:38 -03:00).

**Próximo passo combinado:** implementar US-111 (model `TermoAjuste`, use cases das 2 etapas de
aprovação, linha de `Perfil` para Gestor Master) seguindo o desenho do ADR-025 — ou, se o usuário
preferir menor esforço primeiro, continuar a tradução EN-US (US-103/104/105 seguem pendentes,
ver [[tarefa_traducao_docs_en_us_pendente]] na memória padrão).

---

## 2026-08-06 — registrada às 09:15 -03:00 — US-111 implementada (ADR-025) + ADR-026 fecha gaps de US-105/US-106

Continuação da sessão de 2026-08-04 18:08 (US-111 desbloqueada via ADR-025, sem código ainda).

**O que foi feito, em ordem:**

1. **Tradução EN-US**: US-103, US-104 e US-105 traduzidas, avançando de 12/21 para 15/21.
   Commit `764d68b`.
2. **US-111 — Termo de Ajuste entre Contas Analíticas (UC03.13)**: implementada ponta a ponta
   seguindo o desenho da ADR-025 (model `TermoAjuste`, aprovação em duas etapas
   `PENDENTE_APROVACAO_N1 → PENDENTE_APROVACAO_GESTOR_MASTER → HOMOLOGADO | REJEITADO`, linha de
   dado para perfil "Gestor Master", sem migration em `Perfil`). Commit `d2597b0`.
3. Ajuste de formatação do cabeçalho em `CA_UC01_ajustado_Clerk.md`. Commit `9e53700`.
4. **ADR-026 — fecha 2 gaps remanescentes de US-105 e US-106**:
   - **US-105 (UC03.10)**: Optimistic Locking (`tokenConcorrencia`/`updatedAt`,
     `ConflitoConcorrenciaError`) estendido de `ValorOrcadoConta`/`RateioImpostoGrade`/
     `TermoAjuste` para as guias analíticas restantes — `Meta`, `Viagem`, `ItemPatrimonial`,
     `Empregado`, `QtdeEmpregado`. US-105 fica **completa** (antes só parcial).
   - **US-106 (UC03.18, RN_EST_03)**: `Cargo↔UnidadeFuncional` migrado de vínculo 1:1 (ADR-016)
     para **N:M com rateio percentual** via nova tabela `CargoAlocacaoPercentual` (soma sempre
     100%). Migration em 2 passos (cria+backfill, depois drop da coluna antiga).
     `EmpregadoHeadcount.vinculoFuncionalHerdado` passou a refletir múltiplas alocações.
     RN_EST_01 já era satisfeita por construção; RN_EST_05 (saneamento na importação Rubi) fica
     para quando existir integração real. US-106 fica **completa**.
   - 215 testes passando, `tsc --noEmit` limpo. Commit `92f48b0`.
5. `docs/BACKLOG - Kanban EP118-24 Módulo de Cadastros.md` atualizado para refletir US-105 e
   US-106 como completas e US-107 com o novo vínculo N:M (ADR-026).

**Estado do repositório ao final desta sessão:** commit do backlog kanban + registro desta
sessão em `CONTEXTO_SESSOES.md` feitos juntos, após `92f48b0`. Ver hash do commit deste registro
no histórico do git (`git log --oneline -1`).

**Próximo passo combinado:** nenhuma US refinada e bloqueada pendente de decisão de produto no
momento (US-008a segue como único item bloqueado, aguardando decisão sobre `valorRealizado`
parcial no semáforo). Continuar a tradução EN-US (US-106 em diante, mais US-111 e US-113 que
ficaram fora da lista original de 21) é o item de menor esforço disponível.

---

## Como usar este arquivo em sessões futuras

No início de uma sessão, se o usuário perguntar "qual o contexto/status de X", leia este arquivo antes de assumir que a memória padrão (`~/.claude/.../memory/`) está atualizada — o ambiente deste projeto (Codespace) pode ter sido recriado desde a última sessão, apagando a memória padrão sem apagar o repositório.
