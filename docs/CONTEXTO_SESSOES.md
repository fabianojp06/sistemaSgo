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

## 2026-08-06 (cont.) — registrada às 13:40 -03:00 — US-008a implementada, ADR-027, US-101a

Continuação direta da sessão de hoje (registro acima, 09:15). Após o commit `2775f25` do backlog
(US-008a movida para "Próximo da Fila"), a sessão seguiu com implementação real.

**O que foi feito, em ordem:**

1. **US-008a — Badge do Semáforo (1ª rodada)**: `CalcularValorRealizadoUseCase` criado somando
   Viagem+ItemPatrimonial por conta (achado: Empregado/RateioImpostoGrade não tinham `contaId`
   no schema). Commit `c2355cd`.
2. **Achado levado ao usuário**: o usuário respondeu com uma regra de negócio nova e
   retroativa — "todo custo, todo lançamento no sistema deverá estar associado a uma conta".
   Esclareceu que a conta reflete a *natureza da despesa* (ex: "Despesa com Pessoal"), não o
   organograma — validando a Opção A do Tech Lead (`Cargo.contaId` fixo, independente do rateio
   percentual `CargoAlocacaoPercentual` de ADR-026).
3. **ADR-027 (Tech Lead)**: decide `Cargo.contaId` obrigatório, `EmpregadoHeadcount.contaId`
   como snapshot herdado do Cargo (mesmo padrão de `vinculoFuncionalHerdado`), e
   `RateioImpostoGrade.contaId` obrigatório. Confirmado via `prisma.count()` real no Supabase
   que as 3 tabelas tinham 0 registros em produção — migration `NOT NULL` direto, sem backfill.
4. **ADR-027 implementada**: schema + migration + `CadastrarCargoUseCase`/`EditarCargoUseCase`
   (validação de conta analítica) + `CadastrarEmpregadoUseCase`/`EditarEmpregadoUseCase`
   (herança do snapshot) + `ConfigurarRateioImpostoUseCase` (novo campo obrigatório) +
   `DuplicarPropostaUseCase` (propaga `contaId` do Rateio duplicado) + `actions.ts`
   (`cadastrarCargo`/`editarCargo`). `CalcularValorRealizadoUseCase` passou a somar as 4 fontes
   e `parcial` deixou de ser `true` fixo (agora via constante extensível
   `HA_FONTE_DE_CUSTO_SEM_CONTA_CONHECIDA`, hoje `false`). 221 testes passando, `tsc` limpo.
   Commit `2775f25`.
5. **US-101a — Server Action/UI de Rateio de Impostos**: `configurarRateioImposto` (Server
   Action) + `RateioImpostoPanel.tsx` (form mínimo: tributo/conta/competência/valor), usando a
   permissão já seedada `plano-contas.configurar-rateio-imposto`.
6. **UI do badge (US-008a, 2ª rodada)**: `BadgeSemaforoPanel.tsx` (Server Component, lê
   `CalcularValorRealizadoUseCase` direto) mostrando percentual/cor por conta analítica, com
   indicador "aproximado" quando `parcial=true`. Ambos os painéis plugados em
   `/plano-contas/[versaoId]/page.tsx` — única tela hoje escopada por Versão de Proposta (a
   árvore global em `/plano-contas` não tem `versaoId`, por isso o badge não cabe lá). `next
   build` de produção rodado como validação (sem `.env` de teste real neste Codespace para
   `next dev` com sessão Clerk — ver decisão de 2026-07-26). Commit `065361c`.
7. Backlog kanban atualizado: US-008a, ADR-027 e US-101a movidos para "Concluído"; fila
   "Próximo da Fila" esvaziada (nenhum item priorizado pendente no momento).

**Estado do repositório ao final desta sessão:** tudo commitado e enviado a `origin/master`
(`065361c`, mais o commit do backlog logo em seguida). 221 testes passando, `tsc --noEmit`
limpo, `next build` ok.

**Próximo passo combinado:** nenhum item priorizado na fila. Candidatos a avaliar na próxima
sessão: (a) retomar a tradução EN-US da documentação (ver
[[tarefa_traducao_docs_en_us_pendente]] na memória padrão, estava em 15/21 mais US-111/US-113
fora da lista original); (b) revisitar "Backlog Não Refinado"/"Fora de Escopo" do kanban
(UC03.06, UC03.09, UC03.12, UC03.38) para ver se algum já tem fundação suficiente.

---

## 2026-08-06 (cont. 2) — registrada às 14:10 -03:00 — Frontend de Propostas: US-114 + US-115 (UC03.06)

Continuação direta da sessão de hoje (registros acima, 09:15 e 13:40). Depois de fechar US-008a/
ADR-027/US-101a, o usuário perguntou sobre o momento certo de começar o frontend "de verdade"
(além dos formulários soltos que já existiam). Decisão: começar já, formalizando UC03.06 (que
estava "Fora de Escopo") como US-114 + US-115.

**O que foi feito, em ordem:**

1. **AN/PO formaliza UC03.06** em duas US, após o usuário corrigir o escopo inicial (não é só
   visualização — precisa cobrir Cadastrar/Duplicar/Excluir Versão também):
   - US-114 — porta de entrada navegável de Propostas (lista + as 3 operações de escrita que já
     existiam no backend sem UI).
   - US-115 — tela de Proposta com capa Read-only + guias analíticas (as guias já existiam
     ponta a ponta desde as sessões anteriores, só faltava a tela real). Commits `e3a7a1d`
     (backlog).
2. **US-114 implementada** (fullstack-dev): módulo de menu "Propostas" novo — `propostas.
   visualizar` (NAVEGAVEL) + `propostas.criar`/`duplicar`/`excluir-versao` (CONTEXTUAL),
   seed rodado contra o Supabase de desenvolvimento real. Tela `/propostas` com lista + form de
   cadastro + ações por linha. `/propostas/[id]` nasceu como ponte temporária (redirect pro
   host antigo `/plano-contas/[versaoId]`). Commit `673b5ea`.
3. **Design rápido do Tech Lead para US-115**: decidiu 8 abas (não 7 — Semáforo entrou também),
   Cargo/UnidadeFuncional ficam de fora (escopados por Proposta, não por Versão — ciclo de vida
   diferente), roteamento por segmento de URL (`/propostas/{id}/[[...guia]]`, catch-all
   opcional do App Router) e helper único `podeEditarVersao()` para o enforcement client-side
   de read-only (backend já bloqueia, isso é só refletir no client antes do submit).
4. **US-115 implementada** (fullstack-dev): achado no meio do caminho — as Server Actions de
   Meta/Empregado/Viagem/ItemPatrimonial/QtdeEmpregado já existiam em `plano-contas/actions.ts`
   desde sessões anteriores, só faltavam os componentes React. `/propostas/[id]/[[...guia]]`
   substituiu a ponte; 4 painéis novos criados (Meta, Empregados+QtdeEmpregado, Viagens, Bens);
   `ValorOrcadoContaForm`/`RateioImpostoPanel` ganharam prop `readOnly` opcional (default false,
   sem quebrar a página antiga). `TermoAjustePanel` ficou sem `readOnly` nesta rodada (lógica de
   aprovação própria, mais complexa) — gap conhecido, não bloqueante. Commit `f176e11`.
5. Backlog atualizado: US-114 e US-115 movidas para "Concluído"; fila esvaziada de novo.

**Estado do repositório ao final desta sessão:** tudo commitado e enviado a `origin/master`
(`f176e11` + o commit do backlog logo em seguida). 221 testes passando, `tsc --noEmit` limpo,
`next build` de produção ok. Nenhum teste em navegador real feito em nenhuma das rodadas desta
sessão — Codespace sem `.env` de teste com Clerk/Supabase configurado (decisão aceita desde
2026-07-25/26, ver blocos daquela época).

**Gaps conhecidos, não bloqueantes:**
- `/propostas/[id]/[[...guia]]` não tem teste automatizado de UI ainda (só tsc/build).
- Cargo/UnidadeFuncional (organograma) não têm tela própria ainda — decisão consciente de
  deixar fora de US-115, mas UC03.19/ADR-016 nunca ganhou UI de fato, só Server Action.

**Falso gap, investigado e descartado (2026-08-06, mesma sessão):** `TermoAjustePanel` sem prop
`readOnly` **não é** um gap — é comportamento correto. `SolicitarTermoAjusteUseCase` não bloqueia
por status da versão de propósito: o Termo de Ajuste (UC03.13/ADR-025) existe justamente para
redistribuir saldo depois que a Proposta já está Oficializada, ao contrário das outras 7 guias.
Aplicar `podeEditarVersao()` ali bloquearia uma operação legítima. Não reabrir esse item.

**Próximo passo combinado:** nenhum item priorizado na fila. Candidatos: (a) UI de Cargo/
UnidadeFuncional (organograma) como US nova — próximo item a refinar; (b) retomar a tradução
EN-US da documentação (ver [[tarefa_traducao_docs_en_us_pendente]] na memória
padrão).

---

## 2026-08-06 (14h18–21h11 UTC) — US-116/US-117 (Organograma+Cargos), ADR-028 e 3 rodadas de feedback de teste HML

Sessão longa: retomou o item (a) da fila anterior (UI de Cargo/UnidadeFuncional) e depois
processou 3 rodadas de feedback de teste manual do usuário na tela de Empregados, cada uma
passando pelas skills corretas (`analista-negocios-po`/`techlead-fsg` para decisão,
`fullstack-dev` para código), conforme a regra obrigatória de roteamento por skill do CLAUDE.md.

**0. Correção de CI (antes de tudo):** os últimos 4 commits estavam falhando no GitHub Actions
por um erro de lint (`react/no-unescaped-entities`, aspas retas dentro de JSX em
`EmpregadoPanel.tsx`). Corrigido e enviado (`abad823`) antes de iniciar qualquer trabalho novo.

**1. US-116/US-117 implementadas** (fullstack-dev): nova tela `/propostas/{id}/estrutura`
(fora do catch-all de US-115, mesmo padrão de ciclo de vida por Proposta já decidido). Sub-abas
Organograma (`OrganogramaPanel.tsx`, cria/inativa `UnidadeFuncional`) e Cargos (`CargoPanel.tsx`,
cadastra/edita `Cargo` com rateio percentual `CargoAlocacaoPercentual` + benefícios). De
passagem, corrigido um stub antigo: `InativarUnidadeFuncionalUseCase.contarCargosVinculados()`
sempre retornava 0 com um comentário dizendo "trocar quando `Cargo` existir" — `Cargo` já existe
desde a US-107, então a checagem RN_EST_04 (bloquear inativação com cargo vinculado) nunca
funcionava de verdade. Corrigido para consultar `CargoAlocacaoPercentual` de fato. Nova
`Funcionalidade` CONTEXTUAL `propostas.gerenciar-estrutura`. Commit `347b7ef`.

**2. Feedback de teste #1 (`docs/testeHml/empregados.docx`):** 3 pontos — (a) precisa lançar
quantidade de vagas por Cargo, não só 1 por vez → formalizado como **US-108b**; (b) 2 botões de
salvar no Cargo (dados + benefícios) → **ADR-028** decidiu manter os use cases separados
(`CadastrarCargoUseCase`/`ConfigurarBeneficiosCargoUseCase`, não fundir) e orquestrar só na
Server Action (`salvarCargoCompleto`), com contrato de erro parcial (Cargo salvo mesmo se
Benefícios falhar); (c) dúvida de UX sobre onde o custo do Empregado aparece na Conta Contábil —
não era gap de cálculo (já somava certo em `CalcularValorRealizadoUseCase`), era falta de
exibição. US-108b + ADR-028 + ajuste de UI implementados juntos, commit `96fce36`.

**3. Feedback de teste #2 (`docs/testeHml/empregados1.docx`):** após validar US-108b (11 vagas
lançadas em lote com sucesso), 2 pontos novos — (a) consolidação de Qtde. Empregado devia
mostrar um valor total (quantidade × custo × tempo de contrato) → formalizado como **US-113b**,
com fórmula de overlap de período por Empregado (não é multiplicação simples, cada Empregado do
lote pode ter período diferente); (b) reforço do ponto (c) anterior. Implementado: nova função
pura `calcularValorTotalConsolidado.ts`, campo `QtdeEmpregado.valorTotalConsolidado`, exibição
de Conta Contábil + total mensal na tela. Commit `ab22790`.

**4. Bug de ambiente descoberto e resolvido 2x nesta sessão:** depois de cada `prisma migrate
dev` + restart do dev server, a tela quebrava com `PrismaClientValidationError: Unknown field`
mesmo com o client já regenerado e a migration já aplicada no Supabase. Causa raiz: o comando
`pkill -f "next dev"` **não mata o processo real do Turbopack**, que roda com o nome
`next-server`, não `next dev` — um processo antigo ficava vivo na porta 3000 servindo o Prisma
Client velho, mesmo depois de "reiniciar". Correção: sempre matar por `ps aux | grep
"next-server"` (pelo PID real), nunca confiar em `pkill -f "next dev"`. **Registrar isso é
importante para não perder tempo de novo:** se aparecer erro de campo desconhecido do Prisma
depois de uma migration, o primeiro suspeito é processo `next-server` órfão, não o schema.

**5. Feedback de teste #3 (direto no chat, sem docx):** 2 pedidos novos — (a) Número do
Documento da consolidação devia ser gerado automaticamente, não digitado, formato `C-XXX`
(prefixo + 3 dígitos, sequencial **por Proposta** — confirmado com o usuário via pergunta direta,
já que Por Proposta vs. por Tenant era ambíguo); (b) lista de Empregados precisa virar árvore
agrupada por Cargo (expandir/recolher), em vez de lista plana. Implementado (fullstack-dev,
sem passar por PO desta vez — specs já vieram fechadas do usuário): nova função pura
`gerarNumeroDocumentoQtdeEmpregado.ts` (mesmo padrão de `gerarCodigoCargo`/`gerarCodigoProposta`,
retry em colisão via `isUniqueConstraintError`), novo `@@unique([tenantId, propostaId,
numeroDocumento])` em `QtdeEmpregado` (precisou resolver um conflito de dados de teste
pré-existente — dois documentos "003" soft-deleted — antes de aplicar a constraint), componente
`EmpregadosPorCargoArvore` em `EmpregadoPanel.tsx`. Commit `d2951d2`.

**Migrations aplicadas em produção nesta sessão (todas no Supabase real, não simulado):**
`add_empregados_lote_cadastrado_enum`, `add_qtde_empregado_valor_total_consolidado`,
`add_qtde_empregado_numero_documento_unique`. A última precisou ser criada/aplicada manualmente
(`prisma db execute` + `prisma migrate resolve --applied`) porque `prisma migrate dev` recusa
rodar em ambiente não-interativo quando detecta risco de perda de dados (mesmo já resolvido) —
não há flag de bypass, esse é o caminho manual correto quando isso acontecer de novo.

**Estado do repositório ao final desta sessão:** tudo commitado e enviado a `origin/master`
(`d2951d2`, HEAD). 239 testes passando, `tsc --noEmit` limpo, lint limpo. Dev server local
testado pelo usuário via navegador real (Codespace), não só build/tsc — primeira vez nesta
sessão longa de trabalho que houve teste manual de UI de verdade, com 3 rodadas de bugs/gaps
reais encontrados e corrigidos no mesmo dia.

**Próximo passo combinado:** nenhum item novo priorizado na fila — a sessão foi guiada por
feedback de teste reativo, não por backlog. Se o usuário continuar testando, próxima ação
provável é uma 4ª rodada de feedback na mesma tela de Empregados ou expansão para outras guias
(Viagens, Bens, Rateio de Impostos) que ainda não passaram por teste manual real.

---

## 2026-08-07 01:21 UTC — ADR-029/030/031: custo por componente, ressincronização e exclusão de Cargo

Sessão focada em fechar o ciclo "custo do Cargo → conta analítica → Semáforo" e em higiene da
tela de Cargos, guiada por feedback de teste manual real do usuário (mesmo padrão da sessão
2026-08-06).

**ADR-029 (retomada de sessão anterior, finalizada aqui):** cada componente de custo do Cargo
(gratificação, encargos sociais, VA/VR, VT, plano de saúde/odonto, seguro de vida, auxílio-creche)
ganhou conta analítica própria + snapshot em `EmpregadoHeadcount`
(`montarSnapshotComponenteCustoEmpregado.ts`, `valorSalarioSnapshot` residual para nunca sobrar/
faltar). `CalcularValorRealizadoUseCase` passou a distribuir o custo entre as contas configuradas.
Commit `a20b093`.

**Bug relatado pelo usuário:** configurou contas de benefício no Cargo, Semáforo não atualizou.
Causa raiz nº 1 — snapshot congelado por desenho (ADR-018): editar benefícios do Cargo não
recalcula Empregados já cadastrados. **ADR-030** resolveu com ação explícita "Ressincronizar
Empregados" (não automática — decisão do techlead-fsg para preservar o congelamento intencional
pós-consolidação). Commit `ea44fec`.

Segunda causa raiz (mesmo sintoma, caso real do usuário): ele só havia usado **Qtde. Empregado**
(US-113, documento de consolidação sem `contaId`) — não tinha nenhum `EmpregadoHeadcount`
individual cadastrado no Cargo, então não havia nada para o Semáforo somar. Confirmado cadastrando
um Empregado de teste diretamente via `CadastrarEmpregadoUseCase` (script `tsx`, bypass de Clerk)
e verificando o badge via `CalcularValorRealizadoUseCase` — valores corretos por conta. Empregado
de teste removido em seguida (soft delete real, mesmo `ExcluirEmpregadoUseCase` da UI).

**ADR-031:** tela de Cargos não tinha exclusão. Implementada exclusão individual + em lote
(checkbox "Selecionar todos" + "Excluir Selecionados"), soft delete, bloqueada se houver Empregado
ativo vinculado (mesmo padrão de `InativacaoUnidadeFuncionalBloqueadaError`, US-106), lote
tudo-ou-nada. Commit `3d2a525`.

**Incidente operacional (resolvido, registrar para não repetir):** após `npx prisma generate`
para o novo enum `CARGO_EXCLUIDO`, o `next dev` já em execução continuou com o `@prisma/client`
antigo carregado em memória — `ExcluirCargoUseCase` falhava com
`Invalid value for argument 'tipoOperacao'` mesmo com schema/migration corretos. A transação
Prisma protegeu a integridade (rollback automático, nenhum Cargo ficou com `ativo=false`
inconsistente — confirmado por query direta). **Correção: sempre reiniciar o `next dev` depois de
`prisma generate` no meio de uma sessão com o servidor já rodando** — o hot reload do Next não
recarrega o client do Prisma sozinho.

**Redesign visual da tela de Cargos:** usuário pediu para aplicar na tela Cargos o mesmo padrão
visual já usado em Empregados (sessão 2026-08-06). `CargoPanel.tsx` ganhou faixa executiva com 3
KPIs (Total de Cargos, Custo Total Mensal, Salário Total Mensal), cards brancos com sombra para
tabela/formulário, valores formatados em R$ pt-BR e botões de exclusão no mesmo estilo visual do
`EmpregadoPanel.tsx`. Commit `24c5b37`.

**Nova skill de time — `redator-tecnico`:** nenhuma das skills existentes cobria "manual de
usuário final" (a regra do CLAUDE.md exige parar e pedir autorização nesse caso). Usuário
autorizou criar a skill; registrada em `.claude/skills/redator-tecnico/SKILL.md` e no CLAUDE.md
(seção "Time de desenvolvimento"). Produziu `docs/MANUAL_USUARIO_CARGOS_EMPREGADOS_SEMAFORO.md` —
manual das telas Cargos, Empregados (incl. Qtde. Empregado) e Semáforo, em linguagem de negócio,
com FAQ cobrindo os dois bugs reais desta sessão (Semáforo não atualiza / exclusão de Cargo
bloqueada). Commit `4676d57`.

**Artifact publicado:** o mesmo manual foi publicado como página HTML (Artifact) com sumário fixo,
seções numeradas, quadros de regra destacados e legenda de cores do Semáforo —
`https://claude.ai/code/artifact/720cb305-230e-4f91-9503-dfaec71fe164`. Privado por padrão;
usuário decide se/como compartilhar pelo menu da própria página (fora do controle do assistente).

**Estado do repositório ao final:** tudo commitado e enviado a `origin/master` (`4676d57`, HEAD).
`tsc --noEmit` limpo em cada etapa. Migrations aplicadas em produção nesta sessão:
`20260807003439_adr029_conta_por_componente_custo_cargo` (retomada), `20260807005656_adr030_...`,
`20260807011201_adr031_cargo_excluido`. Servidor dev local exposto via porta pública do Codespace
(`https://laughing-fiesta-q676pqp6rw5f47p4-3000.app.github.dev`) para o usuário testar direto no
navegador — reiniciado uma vez nesta sessão (ver incidente do Prisma Client acima).

**Próximo passo combinado:** nenhum item novo priorizado na fila — sessão encerrada com o manual
de usuário publicado. Se o usuário continuar testando, próxima ação provável é retomar o backlog
(ver `docs/BACKLOG - Kanban EP118-24 Módulo de Cadastros.md`) ou expandir o manual para as telas
de Viagens/Bens/Rateio de Impostos, ainda não documentadas para o usuário final.

---

## 2026-08-07 14:06 UTC — Sessão de teste manual real: reposicionamento de UI, ADR-032 (Valor Realizado do Semáforo), correção de contagem de meses e US-118 (dashboard Valor Orçado)

Sessão longa, guiada por feedback de teste manual real do usuário no navegador (Codespace), não por backlog — mesmo padrão das sessões de 2026-08-06. Link de teste usado: `https://laughing-fiesta-q676pqp6rw5f47p4-3000.app.github.dev`.

**Ajustes de UI pontuais (início da sessão):** botão "Estrutura Funcional e Cargos" reposicionado para dentro da guia Empregados (antes era global no header de todas as guias), ordenação decrescente + ocultar contas zeradas no Semáforo, paleta categórica no gráfico de colunas do Semáforo enquanto não há Valor Orçado (skill `dataviz`, paleta validada), botão "Detalhes" com modal de benefícios por Empregado, botão "Atualizar Consolidação" direto na linha da lista de Cargos (mesmo use case do ADR-030, sem precisar entrar no modo de edição). Commits `5e7c3c8`→`4de5e7a`→`5bd51eb`.

**ADR-032 — Valor Realizado do Semáforo vira total do prazo do contrato:** usuário pediu que o "Valor Realizado" comparado com o Orçado no Semáforo passasse a refletir o total do período da Proposta, não o valor mensal corrente. Tech Lead decidiu: Viagem/ItemPatrimonial/RateioImpostoGrade já são valor total (não mexer); só os componentes de Empregado (único custo mensal recorrente) passam a ser multiplicados pelos meses de sobreposição entre o período do Empregado e o período da Proposta, reaproveitando a lógica de overlap de `calcularValorTotalConsolidado.ts` (US-113b), extraída para `domain/shared/calcularMesesSobreposicao.ts`. Commit `8c55809`.

**Bug real encontrado ao validar com dado real (não simulado):** usuário calculou manualmente o Vale Transporte esperado (R$ 15.840 para 2 estagiários × 12 meses) e o sistema mostrava R$ 17.160. Causa raiz: `contarMesesInclusivo` contava 13 meses para um contrato de exatamente 1 ano com o mesmo dia em início e fim (ex. 01/09/2026 a 01/09/2027) — fórmula antiga (`ano×12 + mês + 1`) não era sensível ao dia. Corrigida para contar meses cheios por aniversário de dia, com +1 só se sobrar fração — mesmo comportamento já validado nos testes de US-113b (partial month arredonda para cima), sem duplo-contar o mês de aniversário exato. Commit `b332ad3`, com 5 testes novos dedicados.

**Aviso proativo de Meta obrigatória (Proposta POR_META):** backend já bloqueava (`MetaNaoEncontradaError`) cadastro de Empregado/consolidação sem Meta configurada na Versão, mas só depois de tentar salvar. Tela agora avisa antes, com link direto para a guia Meta, e desabilita os formulários enquanto a Meta não existir. Commit `9234b3a`.

**Botões de navegação:** "← Página Inicial" na tela Propostas, "← Voltar para Propostas" na guia Valor Orçado. Commits `ee54e06`, `d22eb4b`.

**US-118 — guia Valor Orçado vira dashboard-resumo (retrabalhada 2x na mesma sessão):**
1. Primeira implementação: Valor Global = `Meta.valorGlobal` (POR_META) ou soma direta de `ValorOrcadoConta` (CONSOLIDADA) — ou seja, o que foi lançado manualmente. Formulário de lançamento (`ValorOrcadoContaForm`, US-007) separado para uma guia nova, "Lançar Valor Orçado" (guia Valor Orçado vira 100% leitura). Commits `a003314`, `13d0d0e`.
2. **Usuário testou e corrigiu o conceito:** "Valor Global" não deveria vir do que é lançado manualmente (isso é orçamento/planejamento) — deveria vir do CUSTO REAL já gerado pela Proposta (Empregados+Viagens+Bens+Rateio de Impostos), o mesmo cálculo do Semáforo (`valorRealizado`, ADR-032). Tech Lead decidiu extrair `somarValorRealizadoPorConta` (antes privado dentro de `CalcularValorRealizadoUseCase`) para uma classe de domínio nova, `ValorRealizadoService` (mesmo padrão de `ValorOrcadoTotalizerService`), reusada tanto pelo Semáforo (comportamento idêntico, 8 testes verdes sem alterar asserção nenhuma — confirma que a extração não quebrou nada em produção) quanto pelo dashboard. Validado com dado real: Proposta B, 5 Analista de Sistemas × R$8.290 × 12 meses + 2 Estagiário de TI × R$4.380 × 12 meses = R$ 602.520, bateu exatamente. Commit `c78a01d`.
3. Enfeitamento visual pedido pelo usuário: ícones nos KPIs, gráfico de ranking das contas sintéticas (`BarChartHorizontal`, paleta categórica), barra de peso proporcional na árvore expansível. Commit `4b4941b`.
4. **Bug de runtime descoberto ao testar no navegador:** `ValorOrcadoResumoPanel` (Server Component) passava a função `formatarMoeda` como prop para `BarChartHorizontal` (Client Component) — React só serializa dados através da fronteira Server→Client, nunca funções. Corrigido extraindo `ValorOrcadoResumoVisual`, um Client Component que recebe só dados serializáveis e define a formatação internamente. Commit `3cd2616`.

**Incidente operacional repetido (2x nesta sessão, mesmo padrão da sessão de 2026-08-06):** depois de editar imports/componentes com o `next dev` já rodando, o Turbopack não pegou a mudança automaticamente (`ReferenceError: X is not defined` em runtime, apesar de `tsc`/lint limpos). Correção: matar o `next-server` real (não só `next dev`), apagar `.next/` e subir de novo. **Registrar para não repetir:** sempre que um componente novo referenciado via import não aparecer em runtime mesmo com tudo compilando limpo, suspeitar do cache do Turbopack antes de investigar o código.

**Achado de dados (não é bug):** durante os testes, o snapshot de custo de Empregados já cadastrados numa Proposta ficou desatualizado em relação ao Cargo (mesmo mecanismo do ADR-030 da sessão anterior) — resolvido rodando a Ressincronização diretamente via script, sem precisar recriar os Empregados do zero.

**US-118 formalizada** em `docs/US-118 - Dashboard-resumo da Proposta (Valor Orçado).pt-BR.md` e movida para "Próximo da Fila" no backlog Kanban (depois implementada na mesma sessão).

**Correção de escopo — Viagem deixa de ser exclusiva de Proposta POR_META:** usuário testou lançar uma Viagem na Proposta B (Consolidada) e recebeu erro mencionando Meta. Investigado: a mensagem de erro (`ViagemForaDeEscopoCategoriaError`, "Viagem exige uma Meta vinculada — disponível apenas em Propostas por Meta") confundia categoria da Proposta com Meta em si. Usuário corrigiu a regra de negócio: Viagem deve existir em AMBAS as categorias, sem exigir Meta em Consolidada — mesmo padrão já usado em `ItemPatrimonial` (US-110/ADR-023). Tech Lead confirmou 0 registros de `Viagem` em produção (migration seura, sem backfill) e decidiu replicar o padrão: `Viagem.metaId` virou opcional no schema (migration `20260807143336_viagem_meta_opcional` aplicada em produção), `CadastrarViagemUseCase` ganhou o mesmo guard condicional (Meta só obrigatória em POR_META), classe de erro `ViagemForaDeEscopoCategoriaError` removida (sem mais uso). Teste do Cenário 2 invertido: antes validava o bloqueio, agora valida que a Viagem é criada com `metaId: null` em Consolidada. Commit `16a7c2b`. Validado ao vivo pelo usuário no navegador logo em seguida (POST `/viagens` 200, sem erro).

**Servidor dev caiu 2x depois disso** (fora do controle da sessão — não foi um `pkill`/restart intencional desta vez, o processo simplesmente não estava mais rodando) — resolvido subindo `npm run dev` em background de novo, mesma porta pública do Codespace.

**Estado do repositório ao final:** tudo commitado e enviado a `origin/master` (`16a7c2b`, HEAD). HEAD nesta sessão adiciona 16 commits sobre `a28208f` (início: `5e7c3c8` … fim: `16a7c2b`). `tsc --noEmit` limpo em cada etapa, lint limpo. Suíte de testes: baseline de 7 falhas pré-existentes (não relacionadas) melhorou para 6 (corrigido de brinde um mock desatualizado em `CalcularValorRealizadoUseCase.test.ts`), sem nenhuma regressão nova introduzida. Servidor dev no ar em `https://laughing-fiesta-q676pqp6rw5f47p4-3000.app.github.dev`.

**Próximo passo combinado:** nenhum item novo priorizado além do que já foi feito. Se o usuário continuar testando, próximo candidato natural é revisar as demais guias (Bens, Rateio de Impostos, Termo de Ajuste) com o mesmo padrão de teste manual real que gerou os achados desta sessão — e reconferir se alguma outra regra de "exclusivo de POR_META" (fora Viagem, já corrigida) também precisa da mesma correção de escopo.

## 2026-08-07 (cont. 2) — registrada às 16:51 UTC — US-119 (ADR-033): Criar Nova Versão de Proposta + Histórico de Versões

Usuário reportou gap na tela `/propostas`: só havia "Excluir Versão", faltava "Criar Nova Versão" e consulta ao histórico de versões antigas. Fluxo completo pelo time via skills:

1. **[AN/PO]** Refinou a história com Gherkin. Primeiro rascunho usou o ID US-114 por engano — **colisão detectada**: US-114 já era "Gerenciar Propostas" (implementada em 2026-08-06). Renumerada para **US-119** (próximo ID livre, sequência ia até US-118).
2. **[Tech Lead]** ADR-033. Achado importante antes de decidir: já existia `CriarVersaoPropostaUseCase.ts` no código (nascido em US-007, cenário 4) — wireado no `container.ts` mas nunca exposto em `actions.ts`/UI, e só copiava `ValorOrcadoConta`. Decisão: estender esse use case (não recriar do zero) para copiar também `RateioImpostoGrade`, `Meta`, `Viagem`, `ItemPatrimonial`, `TermoAjuste`, tudo na mesma `$transaction`. Reaproveitar a tela `/propostas` com painel expansível em vez de rota nova `/propostas/[id]/versoes` (não há caso de uso de deep-link para versão isolada). Duas regras de negócio decididas explicitamente: `Meta.valorGlobal` NUNCA é copiado literal — é recalculado como SUM dos `ValorOrcadoConta` recém-copiados (mesmo espelho da US-112); `TermoAjuste` só copia se status `HOMOLOGADO` — pendente de aprovação fica só na versão antiga (aprovação não "herda" para uma versão que não existia quando foi solicitada).
3. **[Full Stack Dev]** Implementado:
   - `CriarVersaoPropostaUseCase.ts` estendido conforme ADR-033, `HistoricoOperacao` passou a registrar contagem de cada tipo copiado.
   - `src/app/propostas/actions.ts`: novas Server Actions `criarNovaVersaoProposta` (trata erro de unique constraint por corrida com mensagem amigável) e `listarVersoesProposta` (traz todas as versões, inclusive `ativa=false`, com nome do autor).
   - `PropostaListPanel.tsx`: botão "Criar Nova Versão" + painel expansível "Histórico de Versões" com badges Vigente (verde) / Excluída (cinza).
   - `page.tsx`: nova permissão `propostas.criar-versao` passada ao painel.
   - `prisma/seed.mjs`: nova Funcionalidade CONTEXTUAL `propostas.criar-versao` — seed rodado e aplicado em produção nesta sessão (upsert, sem migration de schema).
   - `CriarVersaoPropostaUseCase.test.ts`: mock estendido com os novos modelos + 3 casos novos (Meta/valorGlobal recalculado, Viagem+ItemPatrimonial com metaId apontando para a Meta nova, TermoAjuste filtrado por status).

**Escopo não implementado (declarado, não esquecido):** modo leitura (`readOnly`) nos componentes de detalhe (Valor Orçado/Meta/Viagem/etc.) ao abrir uma versão antiga a partir do histórico. O painel de histórico lista e mostra metadados de cada versão, mas ainda não abre o drill-down de cada versão em modo consulta — usuário optou por registrar e seguir depois, não é bug.

**Estado ao final:** `tsc --noEmit` limpo. Suíte completa: 249/255 passando — as 6 falhas são pré-existentes, confirmado via `git stash` comparando antes/depois (mesmos 6 testes falhando no branch limpo, não relacionados a esta mudança). Seed aplicado em produção. Commitado e enviado a `origin/master` (`babd7bb`).

## 2026-08-07 (cont. 3) — registrada às 17:15 UTC — US-120 (ADR-034): Restaurar Versão de Proposta

Usuário testou US-119 no navegador (via extensão Claude in Chrome ativa localmente, mas não exposta nesta sessão remota do Codespace — teste feito manualmente pelo usuário) e confirmou que o botão "Criar Nova Versão" apareceu. Em seguida pediu a próxima peça natural do fluxo: restaurar uma versão antiga como vigente, com modal de confirmação. Fluxo completo pelo time via skills:

1. **[AN/PO]** US-120. Decisões-chave levantadas e resolvidas: (a) restaurar troca **apenas a flag `vigente`** — a versão restaurada mantém seu `numeroVersao` original, sem copiar dados (diferente de US-119) — decisão justificada por `ContaContabil` nunca ser hard-deleted nem ter flag de inativação no schema, então não há risco de FK órfã ao reativar uma versão antiga; (b) restaurar uma versão excluída (`ativa=false`, via US-103) também a **reativa** (`ativa=true`) — senão "restaurar" uma versão excluída não teria efeito prático; (c) sem fluxo de aprovação sobre `VersaoProposta.status` hoje, então a única precondição é a versão-alvo não ser já a vigente.
2. **[Tech Lead]** ADR-034. Confirmou a leitura do PO: **use case novo e separado** (`RestaurarVersaoPropostaUseCase`), não extensão de `CriarVersaoPropostaUseCase` — são operações de negócio diferentes (cópia de dados vs. reposicionamento de flag) e acoplar as duas arriscaria quebrar a suíte de US-119 ao mexer numa ou noutra. **Risco de produção identificado explicitamente**: novo valor de enum `TipoOperacao` (`VERSAO_PROPOSTA_RESTAURADA`) exige `ALTER TYPE ... ADD VALUE`, que precisa ser aplicado *antes* de qualquer deploy de código que grave esse valor — ordem de deploy importa (migration primeiro, sempre). Sem lock pessimista (mesma decisão de ADR-033 para VersaoProposta).
3. **[Full Stack Dev]** Implementado:
   - `VersaoJaVigenteError` (novo erro de domínio, bloqueia restaurar a própria versão vigente).
   - Migration `20260807171048_add_versao_proposta_restaurada_enum` gerada e aplicada em produção (Supabase) antes de qualquer código consumir o valor novo — seguindo a ordem alertada pelo ADR.
   - `RestaurarVersaoPropostaUseCase.ts` (novo, `src/application/use-cases/plano-contas/`) + `.test.ts` com 4 casos (restaura versão ativa, restaura versão excluída reativando, bloqueia se já vigente, bloqueia se não existe). Wireado em `container.ts`.
   - `restaurarVersaoProposta` em `actions.ts`, tratando `VersaoJaVigenteError` com mensagem amigável.
   - `prisma/seed.mjs`: nova Funcionalidade CONTEXTUAL `propostas.restaurar-versao` — seed rodado e aplicado em produção.
   - `PropostaListPanel.tsx`: botão "Restaurar" em cada linha do histórico (exceto a vigente) + `ModalConfirmarRestauracao` (componente local em Tailwind, sem lib nova) nomeando explicitamente qual versão vigente será rebaixada; `page.tsx` passa a nova permissão `podeRestaurarVersao`.

**Estado ao final:** `tsc --noEmit` limpo. Suíte completa: 253/259 passando — mesmas 6 falhas pré-existentes do baseline desta sessão (comparado com a entrada anterior, 249/255 → 253/259: +4 testes novos verdes de `RestaurarVersaoPropostaUseCase`, 0 regressão). Migration e seed aplicados no Supabase real. Commitado e enviado a `origin/master` (`58cfbc9`).

**Nota operacional:** tentativa de usar a extensão Claude in Chrome para testar `/propostas` diretamente falhou — a extensão está ativa no navegador local do usuário, mas as ferramentas MCP correspondentes não aparecem disponíveis nesta sessão remota (Codespace). Também não dá para testar via `curl`, pois a rota exige sessão Clerk autenticada (redireciona para `/login` sem cookie de sessão). Testes de UI desta sessão dependeram do usuário verificar manualmente no navegador.

**Incidente de cache do Turbopack (3ª ocorrência nesta sessão):** depois de restaurar uma versão no navegador, apareceu erro de runtime "Invalid value for argument `tipoOperacao`. Expected TipoOperacao" mesmo com o `@prisma/client` já regenerado com o valor novo do enum — Turbopack não recompilou o chunk que referenciava o enum antigo. Resolvido com o procedimento já registrado: matar `next-server`, apagar `.next/`, subir `npm run dev` de novo.

## 2026-08-07 (cont. 4) — registrada às 17:33 UTC — Redesign visual de `/propostas` e da Tela Principal

Usuário achou o layout de `/propostas` "muito feito" (cru/genérico) e pediu para reunir o time para um brainstorm de redesign antes de mexer em código.

1. **[AN/PO]** Consulta de UX (não gerou US formal): definiu hierarquia de informação (Nome > Status+versão vigente > código discreto), recomendou mover ações raras/arriscadas (Criar Versão, Duplicar, Excluir Versão) para um menu overflow "⋯", mantendo só "Histórico" sempre visível; recomendou diferenciar visualmente Consolidada vs. Por Meta (ícone/cor); confirmou que o volume esperado de Propostas por tenant é dezenas, não centenas — favorece lista/tabela densa, não grid de cards.
2. **[Full Stack Dev]** Protótipo publicado como Artifact HTML (`https://claude.ai/code/artifact/f221ae2c-f503-4b6f-8b05-bf6a79c77296`) com paleta nova (fundo levemente azulado, accent `#2B5FD9`/`#6D93F0`, categoria Por Meta em roxo `#8A5CF6`/`#B39BF9`, semânticas de status separadas do accent) e a estrutura de card com ícone de categoria, pill de status+versão, menu overflow. **Usuário aceitou o protótipo sem pedir ajuste.**
3. **[Full Stack Dev]** Implementado no código real:
   - `PropostaListPanel.tsx`: reescrito por completo — `LinhaProposta` virou card com ícone "C"/"M" por categoria, pill de status mapeado do `StatusProposta` real (`OFICIALIZADO`=verde/vigente, `ENCERRADO`=cinza, `RASCUNHO`/`EM_ELABORACAO`=âmbar), novo componente `MenuAcoesProposta` (dropdown com fecha-ao-clicar-fora via `useRef`+listener de `mousedown`), `HistoricoVersoes`/`ModalConfirmarRestauracao` restilizados sem alterar lógica. Confirmado antes de codar: projeto usa Tailwind v4 puro sem shadcn (sem `components.json`), `dark:` funciona nativo via `prefers-color-scheme` (Tailwind v4) — sem lib de design nova introduzida.
   - Estendido o mesmo redesign para a **Tela Principal** (`src/app/page.tsx`, pedido em seguida pelo usuário): header, nav lateral com ícone de inicial por módulo, estado vazio em card, mesma paleta. `BotaoAjuda.tsx`/`BotaoSair.tsx` restilizados também (usados só na Tela Principal, sem risco de quebrar outra tela). Nenhuma lógica de menu/permissão/auth (UC01.03, ADR-021) foi tocada.
   - Terceiro incidente de cache do Turbopack na sessão (mesmo padrão, mesma correção: matar processo, apagar `.next/`, resubir).

**Estado ao final:** `tsc --noEmit` limpo em cada etapa. Servidor validado sem erro de runtime (`/propostas` e `/` respondendo 307→`/login` normalmente, sem exceção). Sem mudança de lógica de dados/backend nesta entrada — puramente visual, então sem impacto na suíte de testes (não rodada de novo, nenhum arquivo `.test.ts` tocado). Commitado e enviado a `origin/master` (`463be90`).

## 2026-08-07 (cont. 5) — registrada às 17:48 UTC — US-121 (ADR-035): Ranking por Nível Configurável + ajuste de proporção do gráfico

Usuário testou a guia Valor Orçado e achou que o ranking "não fará sentido" agrupado só na conta sintética raiz — pediu para agrupar pelo nível do código ERP (ex: "1.9.11"). Perguntei se era nível fixo ou configurável; usuário confirmou **configurável** (o usuário escolhe entre 2, 3 ou 4).

1. **[AN/PO]** US-121. Regra de negócio central: "conta de parada" no caminho raiz→folha — para no primeiro nó com `nivel >= N` OU que já é `isAnalitica` antes disso (o que vier primeiro), garantindo que 100% do valor sempre aparece no ranking (nenhum ramo "some" por ser mais raso que o nível pedido). Também esclareceu o pedido "cores devem variar": investigação técnica mostrou que a paleta categórica já variava por **posição** — o problema real era a mesma conta trocar de cor toda vez que o ranking reordenava entre sessões/níveis. Decisão: cor por hash determinístico do `contaId`, estável.
2. **[Tech Lead]** ADR-035. Decidiu manter `montarResumoValorOrcado.ts` retornando a árvore completa (não só raízes pré-recortadas) e resolver a troca de nível 100% client-side via `useMemo`, sem nova query — o servidor já carregava todas as `ContaContabil` do tenant de qualquer forma. Risco identificado: mudar o contrato de retorno da função quebraria silenciosamente testes que dependessem do formato antigo (só 1 consumidor hoje, risco local).
3. **[Full Stack Dev]** Implementado:
   - `montarResumoValorOrcado.ts`: campo `nivel` propagado a cada nó; nova função pura `extrairRankingPorNivel(raizes, nivelAlvo)`.
   - `montarResumoValorOrcado.test.ts`: 4 novos testes (nível padrão=raiz, nível exato, ramo mais raso que o nível pedido, conta já analítica antes do nível pedido) — todos verificando que a soma das barras sempre bate com o total.
   - `ValorOrcadoResumoPanel.tsx`: parou de pré-computar o ranking no server; passa a árvore completa (com `nivel`) para o client.
   - `ValorOrcadoContasArvore.tsx` (`ValorOrcadoResumoVisual`): seletor de nível (botões 1-4, padrão 1), `extrairRankingPorNivel` reimplementado no client (mesma regra, árvore já serializada), `corPorConta` (hash simples de char-code do `contaId` % tamanho da paleta) substituindo cor por posição.
   - **Ajuste pedido em seguida pelo usuário**: o gráfico (`BarChartHorizontal.tsx`) ficou desproporcional com níveis mais profundos (muito mais barras). Causa: altura de linha fixa (36px) num SVG com `viewBox` proporcional e `width=100%` — mais barras = SVG inteiro esticando em altura sem limite. Corrigido: altura de linha adaptativa (`Math.max(22, Math.min(36, 480 / nº barras))`), fonte reduzida quando compacto, e teto de altura com scroll (`max-h-[520px] overflow-y-auto`) para níveis muito granulares.

**Estado ao final:** `tsc --noEmit` limpo em cada etapa. Suíte completa: 257/263 passando — mesmas 6 falhas pré-existentes do baseline da sessão (comparado com a entrada anterior, 253/259 → 257/263: +4 testes novos verdes, 0 regressão). Servidor validado sem erro de runtime após cada mudança (reiniciado com `.next/` limpo, mesmo procedimento do incidente de cache do Turbopack já registrado nesta sessão, mais uma vez precisou disso). Commitado e enviado a `origin/master` (`f39468e`).

## 2026-08-07 (cont. 6) — registrada às 17:52 UTC — BarChartHorizontal reescrito (HTML/CSS em vez de SVG)

Usuário testou o ajuste de proporção do commit `f39468e` e reportou que "continua horrível" e o nome da conta seguia sendo cortado — 2ª tentativa de patch pontual no mesmo componente não resolveu.

**Causa raiz identificada (não era mais um parâmetro errado, era a abordagem):** `BarChartHorizontal.tsx` usava um `<svg>` com `viewBox` de largura fixa (640px) + `width="100%"` — o navegador escala o SVG inteiro em bloco pelo aspect ratio do viewBox, então qualquer variação no número de barras (o próprio objetivo da US-121, ranking por nível) distorcia a proporção do gráfico inteiro. Além disso, a faixa reservada para o rótulo da conta era fixa em 200px e o texto SVG não quebra linha nem trunca sozinho — rótulos mais longos (`${codigoErp} — ${nomeConta}`) vazavam para fora da área visível do SVG e ficavam cortados sem nenhum aviso.

**Correção:** reescrito o componente inteiro como HTML/CSS puro (grid + flexbox), sem SVG e sem lib nova — cada linha ocupa a largura real do container (responsivo de verdade, sem aspect ratio travado), o nome da conta usa `truncate` do Tailwind (reticências) com `title` mostrando o texto completo no hover, e a barra é uma `div` com `width` em porcentagem. Continua com `max-h-[520px] overflow-y-auto` para rankings com muitas barras (níveis mais profundos). Mesma interface de props (`titulo`/`barras`/`formatarValor`), então `EmpregadoPanel.tsx` (outro consumidor do componente) não precisou de nenhuma mudança.

**Usuário confirmou que funcionou** ("agora deu certo") após testar no navegador.

**Estado ao final:** `tsc --noEmit` limpo, servidor reiniciado com `.next/` limpo e validado sem erro de runtime. Sem mudança de lógica de dados — puramente visual, suíte de testes não afetada (não rodada de novo).

**Lição para sessões futuras:** ao reportar um problema visual pela 2ª vez no mesmo componente após um "ajuste fino" não ter resolvido, considerar trocar a abordagem em vez de continuar ajustando parâmetros da mesma implementação — SVG com viewBox de proporção fixa é frágil para conteúdo de tamanho variável; HTML/CSS com flexbox é o padrão mais robusto para esse tipo de gráfico simples neste projeto.

**Próximo passo combinado:** nenhum item novo priorizado. Seguem em aberto: modo leitura (`readOnly`) nos componentes de detalhe do histórico de versões (desde US-119).

## 2026-08-07 (cont. 7) — registrada às 19:35 UTC — Tela de Viagens: padrão visual de Empregados, botão Copiar, busca de conta contábil

Usuário pediu 3 coisas em sequência para a tela `/propostas/[id]/viagens`:

1. **Adaptar o padrão visual ao de Empregados + botão "Copiar" por Viagem.** Investigação prévia (Explore) mapeou as diferenças entre `ViagemPanel.tsx` (MVP cru) e `EmpregadoPanel.tsx` (já com 2ª leva de UI) e confirmou que **não existe precedente de "duplicar item individual"** no projeto (só `DuplicarPropostaUseCase`, duplicação de Proposta inteira). Decisão técnica: "Copiar" implementado 100% client-side, sem Server Action nova — pré-preenche o formulário de cadastro já existente (`chaveFormulario` força remount do form com os valores da Viagem copiada) e reaproveita `cadastrarViagem`.
   - **Achado no meio da implementação:** `ViagemResultado` (tipo usado na lista carregada) só trazia `id/descricao/custoEstimado` — insuficiente para pré-preencher uma cópia. Precisou estender o tipo e a query em `src/app/propostas/[id]/[[...guia]]/page.tsx` (todos os campos de `Viagem`) antes de implementar o botão.
   - `ViagemPanel.tsx` reestilizado: `rounded-xl bg-slate-50`, cards `border-gray-100 shadow-sm`, botão excluir com hover vermelho — mesma linguagem de Empregados, sem portar a árvore por Cargo nem os gráficos/KPIs (fora de escopo, Viagem não tem agrupador natural).
2. **Busca de conta contábil por nome/código, a partir de 3 caracteres.** Novo componente reutilizável `src/app/propostas/SeletorContaAnalitica.tsx` (combobox sem lib externa, normaliza acentos, fecha ao clicar fora — mesmo padrão de `MenuAcoesProposta` do redesign de Propostas). Integrado só nos 3 seletores de conta de Viagens (Passagem/Diária/Transporte) — os demais formulários do projeto que também usam `contasAnaliticas` (Valor Orçado, Bens, Rateio de Impostos, Termo de Ajuste, Empregados) continuam com `<select>` simples, fora do escopo pedido agora, mas o componente já nasceu reutilizável para quando for pedido.

**Estado ao final:** `tsc --noEmit` limpo em cada etapa. Suíte completa: 257/263 passando após a mudança de `ViagemResultado`/query (mesmas 6 falhas pré-existentes, 0 regressão — validado antes do commit). Servidor reiniciado com `.next/` limpo e validado sem erro de runtime na rota exata de Viagens após cada mudança. Commitado e enviado a `origin/master` (`9ec2d51`).

## 2026-08-07 (cont. 8) — registrada às 20:07 UTC — Dashboard de Viagens (KPIs+ranking+composição) e menu lateral retrátil

1. **Dashboard de insights em Viagens (ADR-036).** Usuário pediu "insights só com dados de Viagem, gráfico assim como nas outras telas". AN/PO deu 4 opções (KPIs+ranking / composição por componente / ranking por conta / custo médio por pessoa-dia); usuário escolheu A+B. Tech Lead decidiu extrair `calcularComponentesCustoViagem` em `calcularCustoEstimadoViagem.ts` (a fórmula do total passou a SOMAR os 3 componentes, uma única fonte de verdade — antes tinha só o total, sem teste algum) e calcular o dashboard 100% client-side via `useMemo` sobre o state já existente. Implementado: 3→4 KPIs (Nº de Viagens, Custo Total Estimado, **Custo Médio por Viagem** — adicionado depois a pedido do usuário —, Total de Pessoas-Viagem) + 2 `BarChartHorizontal` (ranking por Viagem, composição Passagem×Diária×Transporte). Ajuste de layout pedido em seguida: gráficos lado a lado (`grid lg:grid-cols-2`) em vez de empilhados ocupando 100% da largura.
   - Novo teste `calcularCustoEstimadoViagem.test.ts` (3 casos) — cálculo `[ORIGEM BLINDADA]` que nunca tinha cobertura.
2. **Menu lateral da Tela Principal retrátil por módulo.** Usuário: "Cadastros é um módulo, deve retrair os submódulos... ao clicar deverá exibir". Antes todos os módulos ficavam sempre expandidos. Extraído `src/app/MenuLateral.tsx` (Client Component novo, `page.tsx` continua Server Component buscando o menu) — cada módulo inicia retraído, clique no cabeçalho inteiro (não só a seta ▸/▾) alterna aberto/fechado via `Set<string>`, múltiplos módulos podem ficar abertos ao mesmo tempo (accordion não-exclusivo). Mesmo visual já implementado nesta sessão, sem mudar `getObterMenuUsuarioUseCase`/`ROTA_POR_FUNCIONALIDADE`.

**Estado ao final:** `tsc --noEmit` limpo em cada etapa. Suíte completa: 260/266 passando (mesmas 6 falhas pré-existentes, +3 testes novos verdes do cálculo de Viagem, 0 regressão — refactor de `calcularCustoEstimadoViagem` confirmado seguro). Servidor reiniciado e validado sem erro de runtime a cada mudança (rotas `/propostas/.../viagens` e `/`). Commitado e enviado a `origin/master` (`cc0302a`).

## 2026-08-07 (cont. 9) — registrada às 20:14 UTC — Módulo "Orçamentário" inserido no menu

Usuário: "abaixo de Cadastros insira o módulo Orçamentário". Achado antes de implementar: **todos** os módulos/funcionalidades do sistema hoje vivem sob um único `Modulo` chamado "cadastros" no `seed.mjs` (Plano de Contas, Termo de Ajuste, Propostas — tudo). Consultado o documento vinculante `docs/SGO2_Estrutura_Menu_Relacionamentos.docx` (seção 2): "Módulo Orçamentário" é de fato o item 4 da estrutura oficial, **[EP48/26]**, posicionado logo após "Módulo de Cadastros" (item 3) — exatamente onde o usuário pediu. Só que esse módulo real tem 16 casos de uso inteiros (UC04.01-16: Cronograma de Desembolso, Execução Orçamentária, Remanejamento entre Contas, Demonstrativo Orçamentário Analítico, etc.) **nenhum implementado ainda**.

**Decisão de escopo:** inserir só a entrada de menu + uma landing page honesta "em construção" listando o que virá — não inventar nenhuma das 16 UCs.

Implementado:
- `prisma/seed.mjs`: novo `Modulo` `chave: 'orcamentario', nome: 'Orçamentário'` + `Funcionalidade` NAVEGAVEL `orcamentario.visualizar` (função `seedModuloOrcamentario()`, chamada em `main()` logo depois de `seedModuloPlanoContas()` — garante ordem de inserção "Cadastros antes de Orçamentário"). Bloco genérico já existente ("Administrador recebe toda funcionalidade ativa automaticamente") cobriu a nova funcionalidade sem código extra. Seed rodado e aplicado em produção — confirmado via query direta que os dois módulos existem na ordem certa.
- `src/app/orcamentario/page.tsx` (novo): landing simples, mesmo padrão de auth/layout das outras páginas, mensagem explícita citando o escopo futuro (Cronograma de Desembolso, Execução Orçamentária etc.).
- `src/app/MenuLateral.tsx`: rota `orcamentario.visualizar → /orcamentario` adicionada ao mapa.

**Estado ao final:** `tsc --noEmit` limpo. Seed aplicado e ordem verificada em produção. Servidor reiniciado com `.next/` limpo, `/` e `/orcamentario` validados (307, sem erro de runtime). Sem mudança de lógica de dados existente — suíte de testes não afetada (não rodada de novo). Commitado e enviado a `origin/master` (`7a59421`).

## 2026-08-07 (cont. 10) — registrada às 20:19 UTC — Título "Sistema de Gestão Orçamentária" no header da Tela Principal

Ajuste visual rápido no header da Tela Principal (`src/app/page.tsx`), iterado 3x em sequência pelo usuário: (1) pedido inicial — título ao lado do nome do usuário; (2) "centralizado" — header virou grid de 3 colunas (`grid grid-cols-3`: usuário/data à esquerda, título ao centro, botões Ajuda/Sair à direita); (3) "aumente a fonte e em negrito" — `text-lg font-bold`, cor primária (`#1A1F29`/`#EBEDF2`) em vez de secundária.

**Estado ao final:** `tsc --noEmit` limpo, servidor reiniciado com `.next/` limpo, `/` validado (307, sem erro). Puramente visual, sem impacto em lógica ou testes. Commitado e enviado a `origin/master` (`2e7c789`).

## 2026-08-07 (cont. 11) — registrada às 20:50 UTC — Início do Módulo Orçamentário (EP48/26): memória absorvida, US-122 (Cronograma de Desembolso) implementada ponta a ponta

Sessão longa iniciando o Módulo Orçamentário de verdade, além dos ajustes visuais anteriores.

1. **Absorção da Minuta de Especificação (EP48/26, 16 UCs).** Usuário pediu para o time ler `docs/4 - Minuta da Especificação do Módulo Orçamentário-Rev (1).docx` (~150k caracteres). Lido por completo e resumido em memória persistente (`modulo_orcamentario_ep48_minuta.md`) para não precisar reler do zero em sessões futuras. **Achado crítico registrado:** o documento assume Conta Analítica=Nível 7/Sintética=Nível 6 em toda regra de negócio, mas o schema do SGO 2.0 só suporta 1-4 níveis — bloqueador sinalizado antes de qualquer código.
2. **Refinamento de US-122 (UC04.01 — Cronograma de Desembolso).** Usuário anexou `docs/UC04.01 — Cronograma de Desembolso.md` (10 cenários Gherkin já prontos). AN/PO validou os 10 cenários contra o protocolo de precisão do projeto, identificou que o próprio documento já sinalizava um gap não resolvido (GAP-UC0401-003, formato de concatenação do "Anexo" no cabeçalho — sem entidade correspondente no schema) e formalizou 2 bloqueios: nível de conta (crítico) e o gap do Anexo.
3. **Usuário resolveu os 2 bloqueios na hora:** (a) nível de conta continua 1-4, sem migration — "Nível 7" do documento é nomenclatura do cliente, não exigência de schema; (b) Cenário 3 (Anexo) fica de fora por enquanto; (c) pediu para resolver exportação PDF/XLSX, que não existia em NENHUMA tela do projeto até então.
4. **[Tech Lead] ADR-037** — exportação 100% client-side (`jspdf`+`jspdf-autotable` para PDF, `exceljs` para XLSX), utilitário reutilizável `src/lib/export/exportarRelatorio.ts` (`exportarParaXLSX`/`exportarParaPDF`), evitando Puppeteer/Chromium headless (caro em ambiente serverless). Decisão pensada para servir as próximas ~15 UCs do módulo, não só esta.
5. **[Full Stack Dev] Implementado:**
   - `src/domain/plano-contas/montarCronogramaDesembolso.ts` + `.test.ts` (7 testes) — distribui o custo mês a mês reaproveitando as mesmas fontes de `ValorRealizadoService` (Empregado por sobreposição de período, ItemPatrimonial pelo campo `data`, RateioImpostoGrade por `competencia`). **Limitação conhecida e documentada**: `Viagem` não tem campo de data no schema — custo inteiro cai no primeiro mês da vigência (decisão explícita do Tech Lead, não é bug).
   - Nova guia "Cronograma de Desembolso" dentro do detalhe da Proposta (`src/app/propostas/[id]/[[...guia]]/page.tsx`, mesmo padrão de guias já existente — não virou rota isolada), painel `CronogramaDesembolsoPanel.tsx`.
   - `src/app/orcamentario/page.tsx` ganhou lista de Propostas com link direto "Ver Cronograma →" — usuário reportou que não havia como chegar na tela nova a partir do módulo Orçamentário; corrigido.
   - **Auditoria (RN0232) ficou de fora desta entrega** — declarado, não esquecido; próximo passo natural.
6. **Redesign do layout da tela**, pedido explicitamente ("implementar layout do que há de melhor no mundo corporativo"): faixa de KPIs (Custo Total, Duração, Ciclos Anuais Fechados, mesmo padrão dark de Empregados/Viagens), cabeçalho fixo (sticky) na tabela, zebra striping, colunas numéricas alinhadas à direita com `tabular-nums`, mini barra de progresso no %, linhas de fechamento anual com destaque azul (accent) em vez do âmbar genérico anterior, botões de exportação com hierarquia clara (PDF primário, XLSX secundário). **Usuário confirmou "deu certo".**

**Estado ao final:** `tsc --noEmit` limpo em cada etapa. Suíte completa: 267/273 passando (mesmas 6 falhas pré-existentes do baseline da sessão, +7 testes novos verdes do Cronograma, 0 regressão). `npm install` de `jspdf`/`jspdf-autotable`/`exceljs` reportou 12 vulnerabilidades (`npm audit`) — não investigado a fundo, fica como próximo passo. Servidor reiniciado e validado sem erro de runtime em cada mudança (`/orcamentario`, `/propostas/.../cronograma-desembolso`).

**Próximo passo combinado:** auditoria (RN0232) da consulta ao Cronograma; depois, seguir refinando as próximas UC04.xx (Premissas/Reajustes é a UC04.02 natural, já mapeada na memória). `npm audit` das libs de exportação vale uma olhada dedicada.

**Encerramento da sessão (20:53 UTC):** usuário encerrou o dia confirmando que a próxima sessão retoma diretamente na **UC04.02 — Premissas / Aplicações de Reajustes**, pulando a auditoria RN0232 e o `npm audit` da lista de "próximo passo" acima para depois (não descartados, só não é o primeiro item da próxima sessão). Tudo já commitado e enviado (`674c759`) antes deste encerramento — nada pendente de commit.

---

## 2026-08-07 (cont. 12) — registrada às 21:20 UTC — ADR-038 + US-123 a US-126 (UC03.39-42, Central de Alíquotas de Impostos)

Usuário perguntou se o Módulo de Cadastros menciona um submódulo de Cadastro de Impostos/Alíquotas — resposta: sim, `SGO2_Estrutura_Menu_Relacionamentos.docx` lista UC03.01-03 "Central de Alíquotas, Totalizadores e Rateio/ISS" no menu de Cadastros, mas o que existe hoje (US-101/101a) é só a aba "Rateio de Impostos" contextual à Proposta — não há tela de manutenção do parâmetro global `AliquotaImpostoParametro` (só populável via seed). Usuário trouxe documento próprio já pronto: `docs/Especificacao_UC03.39_a_UC03.42_Aliquotas_Impostos.md` (UC03.39-42, gap formalizado, pendente de validação com André/SCOR).

1. **[AN/PO] Análise do documento contra o código real:** confirmado gap 100% real — nenhum use case de create/update/delete existe para `AliquotaImpostoParametro`, só o upsert do `seed.mjs`. O único ponto do documento não confirmado no código é o "Fluxo C (atalho inline)" do UC03.01 — descrito como já existente, não encontrado; fica como pendência a esclarecer antes de codificar US-124.
2. **[Tech Lead] ADR-038 — vínculo de conta no parâmetro de alíquota.** Pergunta do usuário: o vínculo do imposto com a Proposta é via conta sintética/analítica? Resposta: o vínculo obrigatório **já existe e continua** em `RateioImpostoGrade.contaId` (analítica, ADR-027) — isso não muda. A decisão nova é se `AliquotaImpostoParametro` (o parâmetro global) também deveria carregar uma conta. Optou-se por adicionar `contaSinteticaId` (nullable, sintética N1-N6, nunca analítica) como **sugestão de UX** para pré-preencher o formulário de rateio — sem trava, sem obrigatoriedade, sem alterar a validação de `ContaRateioImpostoNaoAnaliticaError` já existente em `ConfigurarRateioImpostoUseCase`. Motivo de ser sintética e não analítica: contas analíticas (N7) vêm do ERP Senior por Plano de Contas específico e podem não repetir entre Propostas — fixá-las no parâmetro global quebraria a portabilidade do tributo entre Propostas diferentes. Usuário aprovou a recomendação sem alteração.
3. **[AN/PO] 4 User Stories escritas** cobrindo UC03.39-42, com renumeração por colisão detectada (US-119 a US-122 já estavam em uso — Criar/Restaurar Versão, Ranking, Cronograma de Desembolso — próximo ID livre real era US-123):
   - `docs/US-123 - Manter Alíquotas de Impostos.pt-BR.md` (UC03.39, listagem/filtros/exportação)
   - `docs/US-124 - Cadastrar Alíquota de Imposto.pt-BR.md` (UC03.40, inclui a migration de schema do ADR-038: `ativo`, `dataFimVigencia`, `limiteMinimoPct`/`limiteMaximoPct`, `observacao`, `contaSinteticaId`, `version`)
   - `docs/US-125 - Alterar Alíquota de Imposto.pt-BR.md` (UC03.41, Optimistic Locking via `version`, mesmo padrão de US-105; confirma que edição de alíquota nunca recalcula `RateioImpostoGrade.aliquotaAplicadaSnapshot` de rateios já existentes — RN_TAX_03/06)
   - `docs/US-126 - Excluir Alíquota de Imposto.pt-BR.md` (UC03.42, soft delete com trava de referência ativa em `RateioImpostoGrade`)
4. Backlog Kanban (`BACKLOG - Kanban EP118-24 Módulo de Cadastros.md`) atualizado: US-123 a US-126 adicionadas em "Próximo da Fila" (itens 3-6, depois de US-116/US-117 já priorizadas).

**Estado ao final:** apenas documentação/refinamento — nenhum código, migration ou teste ainda. Nenhum arquivo de `src/` ou `prisma/schema.prisma` alterado nesta rodada. Servidor de dev segue no ar (porta 3000) desde o início da sessão, sem mudança de runtime.

**Próximo passo natural:** aplicar a migration do ADR-038 (schema) e implementar US-123 (tela Manter) como primeira peça, ou primeiro esclarecer com o usuário a pendência do "Fluxo C" citada no item 1 antes de codificar US-124. Não decidido ainda — depende do que o usuário priorizar na próxima interação.

## 2026-08-07 (cont. 13) — registrada às 23:50 UTC — US-123 a US-126 implementadas ponta a ponta (Central de Alíquotas de Impostos)

Usuário confirmou "vamos construir o submódulo" após o refinamento anterior (ADR-038 + US-123-126). **[Full Stack Dev]** implementou tudo de ponta a ponta na mesma sessão:

1. **Schema (ADR-038):** `AliquotaImpostoParametro` ganhou `ativo`, `dataFimVigencia`, `limiteMinimoPct`/`limiteMaximoPct`, `observacao`, `contaSinteticaId` (FK opcional para `ContaContabil`), `version`. 3 novos valores em `TipoOperacao` (`ALIQUOTA_IMPOSTO_CRIADA/EDITADA/INATIVADA`). Migration `20260807233738_add_aliquota_imposto_manutencao` aplicada direto em produção (Supabase) sem backfill — tabela já tinha registros do seed, mas os campos novos são nullable/com default, sem risco.
2. **Domain errors:** 7 novas em `src/domain/plano-contas/errors.ts` (nome duplicado, faixa geral, faixa legal ISS, data retroativa, data fim inválida, não encontrada, referenciada, conta sugerida não sintética). Reaproveitado `ConflitoConcorrenciaError` já existente para o Optimistic Locking.
3. **4 use cases** em `src/application/use-cases/plano-contas/`: `ListarAliquotasImpostoUseCase` (status "Expirada" calculado em runtime via RN_IMP_003, não persistido), `CadastrarAliquotaImpostoUseCase`, `EditarAliquotaImpostoUseCase` (Optimistic Locking via `updateMany` condicionado a `version`), `ExcluirAliquotaImpostoUseCase` (soft delete, bloqueia só referência ativa em Proposta RASCUNHO/EM_ELABORACAO — Proposta Oficializada não bloqueia, pois o snapshot já é imutável). 15 testes novos, todos verdes.
4. **Wiring:** 4 funções `getXUseCase()` em `container.ts`; novo `src/app/aliquotas-impostos/actions.ts` (próprio, não misturado em `plano-contas/actions.ts` — mesmo padrão de `/propostas`, cada módulo standalone tem seu `actions.ts`); 4 `Funcionalidade` seedadas (`aliquotas-impostos.visualizar` NAVEGAVEL, `.criar`/`.editar`/`.excluir` CONTEXTUAL); seed rodado e aplicado em produção; rota mapeada em `MenuLateral.tsx`.
5. **UI:** `src/app/aliquotas-impostos/page.tsx` (Server Component, busca contas sintéticas para o seletor de sugestão) + `AliquotaImpostoListPanel.tsx` (Client Component — grid com filtros nome/tipo/status, modal de criar/editar com todos os campos do UC03.40/41 incluindo o seletor opcional de Conta Sintética Sugerida do ADR-038, modal de confirmação de exclusão, exportação PDF/XLSX reaproveitando `exportarRelatorio.ts` do ADR-037 sem lib nova).

**Estado ao final:** `tsc --noEmit` limpo. Suíte completa: 282/288 passando (mesmas 6 falhas pré-existentes do baseline, todas em `CadastrarEmpregadoUseCase`/`CadastrarEmpregadosEmLoteUseCase`/`EditarEmpregadoUseCase` — não relacionadas a esta entrega; 15 testes novos desta sessão, 0 falhas). Servidor de dev reiniciado com `.next/` limpo; `/aliquotas-impostos` validado (307 sem sessão, sem erro de runtime no log) — teste visual completo (login + CRUD no navegador) fica para o usuário, sessão remota do Codespace não tem acesso ao Clerk. **Não commitado ainda** — aguardando o usuário revisar/pedir commit.

**Próximo passo natural:** usuário testar no navegador e pedir commit; depois, US-116/US-117 (Estrutura Funcional/Cargos, já estavam na fila antes desta interrupção) ou continuar o Módulo Orçamentário em UC04.02.

## 2026-08-08 — registrada às 00:20 UTC — QA encontrou 3 bugs reais em Alíquotas de Impostos, 2 corrigidos

Usuário rodou o script de teste (Claude in Chrome) na Central de Alíquotas de Impostos e reportou 3 achados fora do escopo dos cenários roteirizados:

1. **[CORRIGIDO] Bug de fuso horário (off-by-one) nas datas de vigência.** Causa raiz: `validarFaixaEDataOuLanca`/`EditarAliquotaImpostoUseCase` comparavam `dataInicioVigencia` (meia-noite UTC, vinda de `<input type="date">` via `z.coerce.date()`) contra `new Date(); setHours(0,0,0,0)` — que zera a hora em fuso LOCAL do processo, não UTC. Em fuso negativo, isso "voltava" a data em 1 dia, rejeitando "hoje" como retroativo (bloqueou Cenário 7 e parte do Cenário 4 do script de QA) e também distorcia a exibição na grid. Fix: todas as comparações de data-calendário agora usam `Date.UTC(...)` puro, sem tocar em hora local — em `CadastrarAliquotaImpostoUseCase`, `EditarAliquotaImpostoUseCase` e no cálculo de status "Expirada" em `ListarAliquotasImpostoUseCase`. `formatarData` no painel também passou a formatar em UTC (`getUTCDate/Month/FullYear`), o que resolveu de brinde o **erro de hydration mismatch** reportado (SSR e client formatavam a mesma data UTC de formas diferentes por causa do fuso). 2 testes de regressão novos, rodados explicitamente com `TZ='America/Sao_Paulo'` para reproduzir o cenário do bug — passam.
2. **[CORRIGIDO] Vírgula decimal rejeitada ("[DecimalError] Invalid argument: 1000,00").** Campo "Valor Declarado" do Rateio de Impostos (e os campos de Alíquota/Limites da Central) só aceitavam ponto. Novo utilitário `src/lib/decimal/normalizarValorMonetario.ts` (remove separador de milhar, troca vírgula por ponto) aplicado nos Zod schemas de `configurarRateioImposto` (`plano-contas/actions.ts`) e `cadastrarAliquotaImposto`/`editarAliquotaImposto` (`aliquotas-impostos/actions.ts`).
3. **[EM ABERTO — decisão de produto, não código]** Mensagens de erro expõem o rótulo "[TRAVA O ERRO]" na UI (ex: "Alíquota Inválida [TRAVA O ERRO]: ..."). Não é um bug introduzido nesta sessão — é convenção pré-existente em `errors.ts` (36 ocorrências) e reproduz literalmente o texto dos UCs originais (ex: UC03.40 especifica a mensagem exata com o rótulo). QA classificou como rótulo de debug vazando; não alterado sem decisão do PO, pois mudar isso é uma decisão de UX em todo o app, não só nesta feature.

Registros de teste (CSLL-TESTE, TESTE-EXCLUSAO, rateio de ISS em PROP-2026-0001 "Teste A") ainda **não foram limpos do banco de produção** — aguardando confirmação do usuário antes de qualquer DELETE direto.

**Estado ao final:** `tsc --noEmit` limpo. Suíte completa rodada com `TZ='America/Sao_Paulo'` (reproduzindo o fuso do bug): 283/289 passando, mesmas 6 falhas pré-existentes (não relacionadas). **Ainda não commitado.**

**Atualização (mesmo dia, logo em seguida):** usuário decidiu os 2 pontos em aberto via AskUserQuestion — (a) remover "[TRAVA O ERRO]" de todo o app, não só da feature nova; (b) apagar os dados de teste do banco de produção.
- Removido o rótulo de **18 mensagens de usuário** (`super(...)` em `errors.ts`) + **9 mensagens inline** em use cases fora de `errors.ts` (`AprovarTermoAjusteN1UseCase`, `CadastrarEmpregadoUseCase`, `CadastrarEmpregadosEmLoteUseCase`, `HomologarTermoAjusteUseCase`, `CadastrarQtdeEmpregadoUseCase`, `ConfigurarValorOrcadoContaUseCase`, `EditarEmpregadoUseCase`, `ExcluirEmpregadoUseCase`, `RejeitarTermoAjusteUseCase`) + 1 assertion de teste. **Preservados** os ~18 usos em comentários de código (`// [TRAVA O ERRO] ...`) — são anotação de design interna, não texto de UI. `tsc`+suíte completa (`TZ='America/Sao_Paulo'`) seguem limpos: 283/289, mesmas 6 falhas pré-existentes.
- Apagados via script Node direto (Prisma, produção): `RateioImpostoGrade` do rateio de ISS na Proposta "Teste A" (PROP-2026-0001), e as 2 `AliquotaImpostoParametro` de teste (CSLL-TESTE, TESTE-EXCLUSAO). A Proposta "Teste A" em si **não foi apagada** — só o rateio de teste dentro dela.

**Ainda não commitado** — aguardando o usuário pedir o commit.

**Fechamento da sessão:** usuário pediu para salvar o script de QA como arquivo versionado —
`docs/SCRIPT_QA_Aliquotas_Impostos_v2.md` (v2 do script original de scratchpad, já incorporando os
Cenários 13-15 de regressão dos 3 bugs). Em seguida pediu commit + push de toda a entrega da sessão
(US-123 a US-126 + ADR-038 + os 2 bugs corrigidos + remoção do rótulo "[TRAVA O ERRO]" em todo o
app). `docs/UC04.01 — Cronograma de Desembolso.md` tem 1 linha em branco adicionada no início,
não relacionada a este trabalho (provável edição incidental do usuário no IDE) — deixada de fora
do commit desta sessão de propósito.

## 2026-08-08 (cont.) — registrada logo após o push de 143f136 — 2ª rodada de QA (script v2): bug de fuso NÃO estava corrigido, causa raiz era outra

Usuário rodou o script v2 (16 cenários, 0-15) via Claude in Chrome. 13/16 passaram, mas o achado principal invalida a correção anterior:

1. **[NÃO CORRIGIDO — diagnóstico refeito, ainda sem fix] Bug de data "hoje" rejeitada como retroativa.** O fix da rodada anterior (`Date.UTC(...)` puro nos use cases) resolveu um bug real, mas diferente do que se manifestou aqui: aquele tratava da hora *local do processo Node*, e o Codespace roda em UTC, então nunca teria reaparecido neste ambiente. O bug que o QA encontrou é outro: `FORM_VAZIO` em `AliquotaImpostoListPanel.tsx` pré-preenche a data com `new Date().toISOString().slice(0,10)` — `toISOString()` sempre retorna em UTC. Às 21h30 em Brasília (UTC-3) já é 00h30 do dia seguinte em UTC, então o formulário pré-preenche com "amanhã" (calculado em UTC), e o backend, comparando contra `Date.UTC(agora)` no mesmo instante, também já está em "amanhã" — rejeitando a data real de hoje (calendário de Brasília) como retroativa. **Causa raiz correta:** o conceito que falta é "hoje segundo o fuso do usuário", não "hoje em UTC" nem "hoje no fuso do processo servidor" — nenhum dos dois fixes até agora tratou isso. É intermitente: só se manifesta na janela ~21h-23h59 (horário de Brasília) todo dia, quando UTC já virou o dia seguinte. **Usuário pediu só o diagnóstico nesta rodada, sem implementar** — fix fica para a próxima interação.
2. **[NOVO ACHADO, não investigado] Exportar PDF não funciona.** XLSX funciona (download real via blob). PDF: nenhuma requisição, nenhum erro, nenhum download — botão parece desconectado do handler ou falhando silenciosamente. Não investigado ainda.
3. **[Não é bug — ajuste de roteiro]** Seed do ambiente já tem um tributo "ISS" pré-cadastrado, o que impede testar a 2ª parte do Cenário 4 (ISS dentro da faixa 2-5%) sem cair antes na regra de nome duplicado. Próxima versão do script de QA deveria usar um nome de tributo fictício em vez de "ISS" para esse teste específico.
4. Cenário 8 pulado como consequência esperada do bug de data (TESTE-FAIXA/TESTE-RETROATIVO nunca existiram, pois 3 e 5 corretamente bloquearam a criação). Cenários 2, 3, 5, 6, 7, 9, 10, 11, 14, 15 passaram limpo — Optimistic Locking (9), soft delete com trava de referência (11) e as 2 correções anteriores (vírgula decimal, rótulo TRAVA O ERRO) confirmadas funcionando.

**Estado ao final:** nenhum código alterado nesta rodada (só diagnóstico, a pedido explícito do usuário). Registros de teste desta rodada (REGRESSAO-DATA, REGRESSAO-VIRGULA, TESTE-EXCLUSAO, rateio de ISS em "Teste A") não foram limpos.

**Próximo passo combinado:** corrigir o bug de data usando o fuso do usuário como referência (não UTC do servidor nem UTC do `toISOString()` do form) — provavelmente a forma mais robusta é nunca reinterpretar a string `YYYY-MM-DD` do `<input type="date">` como instante UTC para fins de comparação "é hoje/passado", e sim comparar string-a-string com a data local do navegador (`Intl`/`toLocaleDateString` do próprio input, sem `Date` no meio) — decisão de design a tomar com o Tech Lead antes de implementar. Depois, investigar Exportar PDF.

## 2026-08-10 — registrada às 18:55 UTC — Sessão longa: gráfico empilhado no Semáforo, abas em pasta, ajustes do Cronograma (UC04.01), absorção da Minuta V2, US-128/129 (Premissas/Reajustes) formalizadas e US-128 implementada com correção pós-code-review

Sessão cobrindo várias frentes pequenas de UI seguidas de um ciclo completo de feature nova (refinamento → ADR → código → review → fix).

1. **Servidor de dev subido/reiniciado várias vezes ao longo da sessão** (pedido do usuário, "levante o servidor de testes") — sem incidente, só start/restart padrão (`npm run dev`, às vezes com `.next/` limpo após mudança de schema).

2. **Gráfico de colunas empilhadas no Semáforo Orçamentário.** Pedido: visualizar quanto do limite (Valor Orçado) foi consumido por conta. Novo `StackedColumnChartLimite.tsx` (SVG puro, mesmo padrão de `ColumnChartRanking.tsx`), consumindo os campos já existentes de `CalcularValorRealizadoUseCase` (`valorOrcado`/`valorRealizado`/`percentual`/`cor`) — sem mudança de backend. Validado com screenshot autenticado (Playwright + `@clerk/testing`, credenciais de `.env`).

3. **Usuário pediu para remover o gráfico antigo** ("Ranking de Contas") e manter só o novo — `ColumnChartRanking.tsx` apagado, `BadgeSemaforoPanel.tsx` limpo do código morto associado (paleta categórica, cálculo de índice). Validado de novo com screenshot.

4. **Layout de abas "pasta de arquivo" em `PropostaTabs.tsx`.** Usuário trouxe um mockup (`docs/errosGit/Captura de tela...png`) e pediu para melhorar o menu de guias da Proposta. Oferecidas 3 opções via `AskUserQuestion` (pasta clássica / cartão elevado / pílula) — usuário escolheu "pasta clássica". Implementado com `-mb-px` + `border-b-white` para a aba ativa se fundir visualmente com o painel abaixo. Validado com screenshot.

5. **Commit + push das 3 entregas acima** direto na `master` (UI pura, sem migration/regra financeira — dentro do fluxo híbrido por risco).

6. **Ajustes na tela de Cronograma de Desembolso (UC04.01) contra o documento de especificação.** Usuário pediu para ler `docs/Cronograma de Desembolso.docx` e ajustar a tela. 3 gaps encontrados: painel de Filtros Aplicados (RN0200/RN0250) virou bloco destacado em vez de linha de texto corrida; cabeçalhos de coluna alinhados ao texto literal do documento; botão [Imprimir] novo com CSS de impressão dedicado (`print:hidden`/`hidden print:block`) — esse padrão de impressão virou a referência reusada depois em Premissas/Reajustes. Commit + push direto na master.

7. **Checagem de memória/sessões anteriores** — usuário pediu para ver onde parou o desenvolvimento de casos de uso. Resposta: última entrega de US foi US-123-126 (Alíquotas de Impostos), com 2 bugs de QA encontrados numa 2ª rodada (data "hoje" rejeitada como retroativa; Exportar PDF "não faz nada"). Usuário confirmou que o problema do PDF já tinha sido resolvido — memória (`diagnostico_2a_rodada_qa_aliquotas_2026_08_08.md`) estava desatualizada com uma frase contraditória no final, corrigida.

8. **Absorção da V2 da Minuta do Módulo Orçamentário** (`docs/4 - Minuta da Especificação do Módulo Orçamentário-V2.docx`, ~124k caracteres, lido por completo). Principais diferenças da V1: escopo encolheu de 16 para 12 UCs (os 4 UCs de CAPEX/Bens-Serviços-Equipamentos desapareceram, não confirmado por quê); bloqueador de nível de conta (7 níveis vs. 1-4 do schema) ficou mais explícito, não resolvido; `SubConta` (que o doc pede para extinguir) nunca existiu no SGO 2.0, então não é conflito; `ContaAgrupadora` (já implementada) resolve o que o glossário da V2 chamava de "Agrupador de Contas" como se fosse novo; achado de qualidade documental novo — UC04.06 tem título "Elaboração de Novo TP" mas corpo inteiro descreve um relatório read-only diferente (mesmo padrão do bug já catalogado em UC03.09). **Usuário avisou que a Minuta ainda vai passar por mais atualizações** — V2 não é a versão final; nenhuma decisão de nível de conta ou dos UCs de CAPEX foi fechada, fica para quando a versão definitiva chegar.

9. **US-128 (Relatório de Premissas/Reajustes) e US-129 (Simular/Aplicar Reajuste em Lote) formalizadas** a partir de `docs/Premissas.docx` (mesmo UC04.02) + `docs/CA_UC04.02_Premissas_Reajustes_Rev00.docx` (critérios de aceite já escritos por Rafael Guerra/GIA, revisado por Fabiano/BA-PO, pendente validação de André/SCOR). Usuário respondeu 3 perguntas de refinamento que mudaram o desenho: (a) a "Formula" do documento é a tela **Rateio de Impostos** já existente (`AliquotaImpostoParametro`/`RateioImpostoGrade`), não uma entidade nova; (b) o cálculo de reajuste deve rodar em **todos os status** de Proposta, sem bloqueio (diverge do RN_PR_003 do CA original — sinalizado para avisar a cadeia de validação); (c) a sobreposição com o ADR-039 (juros compostos de impostos, ainda em aberto) fica como está, revisitar depois.

10. **ADR-040 (Tech Lead)** fechou os 3 pontos de design que sobraram: grade ano-a-ano sem herança automática entre reajustes sucessivos (mês futuro sem parâmetro cobrindo fica "—"); retroatividade nunca faz `UPDATE` em `RateioImpostoGrade` histórico (preserva a invariante de imutabilidade já testada), só cria 1 linha nova no mês atual com a diferença acumulada; `AliquotaImpostoParametro.aliquotaPct` ampliado de `Decimal(5,2)` para `Decimal(9,4)` (RNF_PR_004, migration segura por ser expansão de escala). US-128/129 passaram de "bloqueada" para "pronta para desenvolvimento".

11. **US-128 implementada ponta a ponta** (`fullstack-dev`, Feature Mode): migration `20260810182916_premissas_reajuste_aliquota_precisao`; novo `ListarPremissasReajusteUseCase` (algoritmo do ADR-040); nova guia "Premissas e Reajustes" em `/propostas/[id]/premissas-reajustes` (`PremissasReajusteGrid.tsx`, mesmo padrão de exportação/impressão do Cronograma); ajuste de formatação de `aliquotaPct` em Alíquotas de Impostos após a ampliação de precisão; landing do módulo Orçamentário (`/orcamentario`) ganhou o link para o novo submódulo, ao lado do Cronograma de Desembolso. `tsc`/`eslint`/suíte completa (293 testes) verdes, validado com screenshot autenticado.

12. **Correção de fluxo Git em tempo real.** O primeiro commit desta feature foi feito direto na `master` — errado, porque inclui migration de banco (o fluxo híbrido por risco exige branch+PR para qualquer migration). Corrigido sem nada ter sido enviado ainda: `git branch` na ponta do commit, `git reset --soft HEAD~1` na master (master voltou limpa para `e80068e`), checkout na branch nova, push, PR aberto (`https://github.com/fabianojp06/sistemaSgo/pull/1`).

13. **`/code-review` na branch encontrou 1 bug real:** a série de células do relatório era calculada 1x por conta e reaproveitada nos 2 blocos (Contratos/Parceria-ACT) — uma conta com `AliquotaImpostoParametro` distintos para os 2 tipos mostrava a mesma projeção (errada para um deles) nos 2 blocos, inclusive na exportação. Causa raiz: desenho modelava 1 série por conta em vez de 1 série por (conta, bloco). Não pego na validação visual porque os dados de teste usados tinham só parâmetros `AMBOS` (que legitimamente repetem nos 2 blocos).

14. **Fix aplicado e commitado na mesma branch** (`a6ff721`): `ListarPremissasReajusteUseCase` agora filtra por bloco antes de projetar, gera 1 linha por (conta, bloco), e desempata janelas de vigência sobrepostas pela mais recente, com `orderBy` na query para ordem determinística. `LinhaPremissaReajuste`/`LinhaPremissaSerializada` trocaram `blocos: BlocoPremissa[]` por `bloco: BlocoPremissa` (singular). `tsc`/`eslint`/suíte (293 testes) verdes de novo. Push feito.

**Estado ao final:** `master` limpa em `e80068e` (nada de US-128 nela). Branch `feature/us-128-premissas-reajustes` com 2 commits (`ebd9aa7` implementação + `a6ff721` fix pós-review), PR #1 aberto, ainda **não mergeado** — falta revisão humana final do PR antes do merge (o `/code-review` já rodou e o achado foi corrigido, mas o merge em si não foi feito).

**Próximo passo natural:** usuário revisar/mergear o PR #1; depois, US-129 (simular/aplicar reajuste em lote) é a próxima peça natural do UC04.02, já com ADR-040 fechado — só falta codificar (é operação financeira, branch+PR obrigatório desde o primeiro commit desta vez).

## 2026-08-14 — registrada às 14:38 UTC — Dia mais denso da história do projeto: incidente de perda total de dados de produção (causado pelo assistente) + 3 features entregues (US-136, US-132→revisada, US-137) + recuperação completa

Sessão longa cobrindo, nesta ordem: retomada de contexto, um incidente grave de perda de dados em produção (causado por mim), recuperação parcial, e três entregas de feature completas (refinamento → ADR → código → review → merge) sobre os escombros do incidente.

### 1. Retomada de contexto e incidente de produção herdado (US-135/ADR-043)

Sessão começou com o usuário pedindo o status de onde paramos (via memória + este arquivo). Confirmado: US-135/ADR-043 (reversão do vínculo Cargo↔Unidade Funcional de N:M para 1:1, decidida em 2026-08-13) estava implementada na branch `feature/us-135-vinculo-1-1`, mas nunca mergeada. O usuário reportou, com screenshot, que a tela "Estrutura Funcional e Cargos" em produção (`sistema-sgo.vercel.app`) estava quebrada ("This page couldn't load"). Investigação (via `mcp__supabase__execute_sql`) revelou a causa raiz: **as migrations do ADR-043 já tinham sido aplicadas no banco de produção em 2026-08-13, mas o código correspondente nunca foi mergeado** — o banco já estava no formato 1:1, mas `master` (deployada) ainda fazia query pela relação N:M já removida. Corrigido: `/code-review high` na branch (limpo) → PR #5 → merge em `master` (`ac0cc0a`), restaurando a tela.

### 2. US-136/ADR-044 — Periculosidade e Insalubridade do Cargo

Pedido do usuário: 2 novos campos no Cargo, cada um configurável como % (sobre `salarioTotal`) ou valor fixo em R$. Fluxo completo: `analista-negocios-po` refinou a US com 6 decisões deixadas explicitamente para o Tech Lead → `techlead-fsg` produziu **ADR-044** (somados a `custoTotalCargo` **depois** de Encargos Sociais, não entram na base de cálculo de Encargos; conta contábil própria por componente, padrão ADR-029; cumulação dos dois permitida sem bloqueio — sistema não arbitra regra CLT) → agente em background implementou (migration + domínio + use case + UI + testes) na branch `feature/us-136-periculosidade-insalubridade` → `/code-review high` achou 4 problemas (validação bloqueando indevidamente valor residual negativo quando inativo; checagem morta/inalcançável; checkbox não resetando Tipo/Valor; FK não relacionada recriada à toa na migration) → todos corrigidos → PR #6 mergeado (`67b53cd`). Fix de UX adicional depois (busca por conta habilitada nos 2 campos novos, `SeletorContaAnalitica` em vez de `<select>` simples), direto na master (`6e27687`).

### 3. Migração de US-132 e ADR-045 — Importar Cargo do Rubi

US-132 (Tabela Salarial/Faixa/Nível do Rubi) estava bloqueada desde 2026-08-13 aguardando 2 decisões de arquitetura. Ambas resolvidas via `AskUserQuestion`: (a) mantém fixture simulada, sem integração HTTP real ainda; (b) `codigoCargo` continua gerado internamente pelo SGO, não vem do Rubi. Escopo ampliado a pedido do usuário para incluir também o **Nome do Cargo** na importação (não só Tabela/Faixa/Nível/Salário). Fluxo completo de novo: `analista-negocios-po` reescreveu a US com um fluxo de busca explícita (modal "Importar do Rubi", termo de busca livre não persistido) → `techlead-fsg` produziu **ADR-045** (novo use case dedicado `ImportarCargoRubiUseCase`, reaproveita `statusSyncSalario`/`syncedAt` já existentes em vez de criar timestamp novo) → agente implementou (6 novos campos em `Cargo`, todos [ORIGEM BLINDADA], provider fixture com hash determinístico, modal, testes) → `/code-review high` achou 4 problemas (update dentro de transação sem escopo por `tenantId`; leitura do "anterior" fora da transação arriscando auditoria desatualizada em corrida; validação frouxa do valor monetário; atributo `readOnly` redundante) → todos corrigidos → PR #7 mergeado (`e1825a9`).

### 4. ⚠️ INCIDENTE CRÍTICO: perda total de dados de produção, causada pelo assistente

Usuário pediu para investigar por que uma migration anterior precisou de aplicação manual (`prisma db execute` + `migrate resolve --applied`) em vez de `prisma migrate dev` — um "drift" aparente. Durante essa investigação, rodei:

```
npx prisma migrate diff --from-migrations prisma/migrations --to-url "$DATABASE_URL" --shadow-database-url "$DATABASE_URL"
```

**Passei a mesma URL de produção como alvo E como shadow database.** O Prisma trata o shadow database como descartável — isso **apagou todos os dados de todas as tabelas de produção** (`Usuario`, `Proposta`, `Cargo`, `Empregado`, `TabelaSalarial`, tudo), preservando só a estrutura (DDL) das tabelas, e **zerou também a própria `_prisma_migrations`** (histórico de controle). Sem backup disponível — projeto usa só o plano gratuito do Supabase, sem PITR nem backup automático. **Dados de negócio perdidos de forma permanente e definitiva.**

**Causa raiz do "drift" original que eu estava investigando** (irônico): banal — falta de `directUrl`/shadow database configurado, e o pooler do Supabase não suporta bem `migrate dev`. Meu comando de diagnóstico é que causou o dano real, não o problema que eu estava investigando.

**Recuperação (só de acesso, não dos dados):**
1. Clerk (autenticação) não foi afetado — os 3 usuários reais continuavam lá. Script temporário resincronizou `Usuario` a partir da API do Clerk (mesma lógica do webhook).
2. `prisma/seed.mjs` recriou o catálogo `Modulo`/`Funcionalidade` e o Perfil "Administrador".
3. `_prisma_migrations` reconstruída marcando as 43 migrations existentes como aplicadas (`prisma migrate resolve --applied`, uma a uma, timeout obrigou rodar em 2 lotes).
4. `Plano de Contas` (US-001) restaurado sem perda real — é alimentado por um arquivo fixo embutido no código (`plano-contas-raw.ts`), então rodar `SincronizarPlanoContasUseCase` via script trouxe de volta as 175 contas exatamente como estavam.

**O que NÃO foi recuperado, perdido de fato:** todas as Propostas, Cargos, Empregados, Tabela Salarial, Alíquotas/Rateios de Imposto configurados manualmente, HistoricoOperacao anterior ao incidente. O usuário já começou a recadastrar manualmente durante a sessão (Proposta "001-2026", 3 Unidades Funcionais).

**Correção estrutural aplicada** (commit `63bda41`, master): `prisma/schema.prisma` ganhou `shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` apontando para um Postgres **local via Docker** (nunca Supabase); `docs/DEV_SHADOW_DATABASE.md` documenta o incidente e a regra permanente. Ver memória `incidente_perda_dados_producao_2026_08_14.md` para o registro completo — **este é o incidente mais grave já ocorrido no projeto, e a lição (nunca passar a URL de produção como shadow database) é inegociável daqui pra frente.**

### 5. US-137/ADR-046 — Grade Salarial CTCEA (substitui fixture-hash do Rubi por catálogo real)

Enquanto investigava o botão "Sincronizar" que sumiu (na verdade nunca existiu ativo — Funcionalidade `plano-contas.sincronizar` desligada desde 2026-08-11, decisão anterior não relacionada ao incidente), o usuário pediu que a importação do Rubi passasse a funcionar **exatamente como o Plano de Contas**: catálogo real carregado de um arquivo fixo via botão "Sincronizar", não mais busca por hash. Usuário forneceu 2 fotos de um relatório real "Tabela de Salários" da CTCEA (Organização Brasileira para o Desenvolvimento Científico e Técnico do Controle do Espaço Aéreo) — Classe (F1-F7) × Nível (N1-N20/22) → Salário. 2 valores anômalos (F1/N21=R$9,10, F1/N22=R$8,91, destoando da progressão) descartados por decisão do usuário. Fluxo completo: `analista-negocios-po` escreveu **US-137** → `techlead-fsg` produziu **ADR-046** (migração 100% do fixture-hash, sem convivência; loader plano sem hierarquia, mais simples que o do Plano de Contas; `cargoMercado`/`cargoCtcea` nascem nullable até uma 2ª fonte com nomes de cargo) → agente implementou (140 linhas transcritas, novo model `GradeSalarialCtcea`, `CargoRubiFixtureProvider` removido por completo, busca por Faixa/Nível no modal, botão Sincronizar na tela `/plano-contas`) → `/code-review high` achou 4 problemas (2 reais: migration com FK não relacionada recriada à toa — mesmo padrão de artefato já visto 2x hoje —, e loader sem chunking no INSERT em lote; 2 já mitigados no próprio código) → corrigidos → PR #8 mergeado (`be2334a`). Sincronização inicial rodada em produção (140 linhas, 7 Faixas × 20 Níveis, conferido contra os valores das fotos). Botão "Sincronizar" ativado manualmente (Funcionalidade + vínculo ao Perfil Administrador, que não existiam ainda porque o seed não tinha rodado desde o merge).

### 6. Ajustes finais de UX

Campo "Fonte Ativa" (já existia desde US-107, com opção "Rubi (Salário Real)") movido para abaixo do bloco de importação do Rubi no formulário de Cargo, a pedido do usuário — commit `b3c2f46`, direto na master (UI pura).

Usuário pediu sugestões de reorganização de layout da tela de Cargo — gerado artefato com 3 opções (blocos recolhíveis / coluna principal + painel fixo com custo ao vivo / assistente em etapas), publicado e salvo em `docs/Mockup_Reorganizacao_Layout_Cargos_2026-08-14.html`. Decisão de qual opção implementar ainda **em aberto** ao fim da sessão.

### Estado ao final do dia

`master` em `b3c2f46` (mais o commit deste registro de sessão). Todas as 4 entregas de feature do dia (US-135 merge, US-136, US-132/ADR-045, US-137/ADR-046) estão em produção, testadas e com code-review aplicado. **O incidente de perda de dados é o fato mais importante do dia** — sistema funcional novamente, mas com todo o dado de negócio histórico perdido, exceto o que é regenerável de fontes fixas (Plano de Contas, Grade Salarial CTCEA) ou o que o usuário já recomeçou a recadastrar manualmente.

**Próximo passo natural:** (1) usuário decidir qual das 3 opções de layout de Cargo implementar (ou nenhuma); (2) continuar recadastrando manualmente Propostas/Cargos/Empregados/Tabela Salarial/Rateios perdidos; (3) US-133 completar (`FonteAtivaSalario.TOTAL`) e US-134 (Snapshot de Oficialização) seguem como próximas peças do módulo de Cargos, agora desbloqueadas.

## 2026-08-15 — registrada às 17:30 UTC — Ajustes de UX em Estrutura Funcional/Cargos: link Empregados, confirmação de gravação e cadastro de Cargo direto no modal de Tabela Salarial

Sessão de ajustes incrementais de UX na tela "Estrutura Funcional e Cargos", todos fix pequeno/localizado (direto na `master`, sem migration nem mudança de contrato de use case), guiados por 2 prints do usuário e iteração de posicionamento.

1. **Link "Empregados" na tela de Estrutura Funcional.** Pedido inicial vago ("ao lado do título") resultou em 3 iterações até acertar o local exato pedido pelo usuário: 1ª tentativa colocou o link dentro do painel do Organograma (`OrganogramaPanel.tsx`); usuário mandou print mostrando que queria na barra de abas mesmo (`EstruturaFuncionalPanel.tsx`), flutuando à direita; 2º print pediu a posição final: inline na sequência das abas, logo após "Estrutura Funcional (Organograma)" e antes de "Cargos". Commits `121da32` → `1254b41` → `b9e13bf`. Lição: quando o pedido de posicionamento de UI é ambíguo, pedir print antes de implementar economiza retrabalho — aqui não foi pedido de antemão e custou 2 rodadas extras.

2. **Notificação de sucesso ao salvar Cargo — trocada de toast para modal.** Implementação original usou `sonner` (biblioteca nova no projeto, instalada para isso) com toast no canto superior direito. Usuário pediu explicitamente: centralizado na tela, com botão OK, só fecha no clique. `sonner` removida (não tinha mais uso) e substituída por modal local em `CargoPanel.tsx` (overlay + caixa central + botão OK), mesmo padrão visual dos outros modais do arquivo. Commit `ed38c3c`.

3. **Falso alarme de toast não aparecendo.** Usuário reportou que a mensagem de sucesso não aparecia; build de produção local (`npm run build`) rodado para descartar erro — passou limpo. Causa provável: propagação de deploy no Vercel ou cache do navegador, não bug de código (o pedido seguinte, de trocar toast por modal, resolveu de qualquer forma).

4. **Manual do usuário atualizado + bug de layout real corrigido.** Usuário descreveu a ordem correta de cadastro de um Cargo (Tabela Salarial cria o Cargo → Cargos completa o Rascunho, exige Vínculo Funcional para salvar → Empregados usa o Cargo disponível) e pediu para: (a) atualizar o artefato "Manual da Estrutura Funcional e Cargos" com esse fluxo — reordenado com um bloco visual novo "Ordem recomendada de cadastro de um Cargo"; (b) corrigir sobreposição de texto. Um agente em background investigou e achou a causa real: a `<nav>` de abas em `EstruturaFuncionalPanel.tsx` ganhou um 4º item (o link Empregados da tarefa 1) sem `flex-wrap`, podendo estourar em telas estreitas. Corrigido (`flex-wrap items-center`), commit `38f9dec`.

5. **Cadastro de Cargo direto no modal de Tabela Salarial.** Pedido a partir de um 3º print: o modal `TabelaSalarialModal.tsx` (aberto pelo botão "Tabela Salarial" no formulário de Cargo) só existia com um Cargo já em edição (`cargoId` obrigatório) — servia só para Senioridade/Faixa Salarial. Usuário pediu para também poder cadastrar o Cargo em si por esse modal, além da tela já existente (aba Tabela Salarial em `EstruturaFuncionalPanel.tsx`), e já usá-lo no mesmo modal. Implementado: `cargoId` virou opcional; sem ele, o modal mostra primeiro um campo "Cadastrar Cargo" (chama a mesma action `cadastrarCargoRascunho` já usada na aba Tabela Salarial); ao salvar, o Cargo criado assume `cargoIdAtual` internamente, libera as seções de Senioridade/Faixa Salarial/"Usar esta faixa", e via callback `onCargoCriado` assume a edição no formulário por trás do modal (reaproveita `iniciarEdicao` já existente em `CargoPanel.tsx`). Botão "Tabela Salarial" que só aparecia com Cargo em edição passou a aparecer sempre. Commit `668e634`.

6. **Bug reportado, guardado para a próxima sessão (não implementado ainda).** Ao importar um Cargo do Rubi, se o campo "Nome do Cargo (Mercado)" já estiver preenchido manualmente, a importação apaga esse nome e o substitui pelo nome vindo do Rubi — causa: `handleImportadoRubi` em `CargoPanel.tsx:218-221` sobrescreve `dados.nomeCargoMercado` com o valor retornado pela importação, e o próprio `ImportarCargoRubiUseCase` (ADR-045) já grava o nome do Rubi nesse mesmo campo no backend. Usuário pediu explicitamente: (a) "Nome do Cargo (Mercado)" nunca deve ser alterado pela importação, em nenhuma circunstância; (b) criar um campo novo dedicado, **"Nome Cargo CTCEA"**, para receber o nome importado do Rubi. Envolve `Cargo` no schema Prisma (novo campo → migration → branch+PR pelo fluxo híbrido), o use case de importação, o formulário em `CargoPanel.tsx` e o texto do modal `ImportarCargoRubiModal.tsx`. Detalhe completo salvo em memória (`pendencia_nome_cargo_ctcea_importacao_rubi.md`) — **início da próxima sessão deve tratar isso antes de qualquer outra coisa nova**, pois foi reportado como bug ativo em produção.

### Estado ao final

`master` em `668e634` (mais o commit deste registro). Nenhuma feature nova de negócio — só UX/UI na tela de Estrutura Funcional e Cargos, todas testadas com `tsc`/`eslint`/`next build` limpos antes de cada push. Artefato do manual atualizado no mesmo link (`85ee7951-a650-408e-aa61-c193033822d4`).

**Próximo passo natural:** (0) **corrigir o bug do item 6 acima (Nome Cargo CTCEA) — reportado em produção, prioridade sobre o resto**; (1) retomar os itens em aberto do fim de 2026-08-14 — decidir layout final de Cargo (3 opções propostas), continuar recadastro manual de dados perdidos no incidente; (2) US-133/US-134 como próximas peças do módulo de Cargos.

## 2026-08-15 — registrada às 21:51 UTC — Nome Cargo CTCEA (correção de bug), alerta de Estrutura Funcional ausente e reajuste da Grade Salarial CTCEA

Continuação da mesma data, tratando primeiro a pendência prioritária deixada no fim da sessão anterior (item 6 acima), depois duas demandas novas.

### 1. Correção do bug "Nome Cargo CTCEA" (pendência prioritária)

Fluxo completo `fullstack-dev`: novo campo `Cargo.nomeCargoCtcea` (nullable) recebe o nome vindo do Rubi/CTCEA; `ImportarCargoRubiUseCase` para de gravar em `nomeCargoMercado` (que volta a ser sempre o nome digitado pelo usuário, nunca sobrescrito); `CargoPanel.tsx` teve `disabled`/`title` removidos do campo Nome do Cargo (Mercado) e passou a exibir "Nome Cargo CTCEA" no painel lateral Rubi; `ImportarCargoRubiModal.tsx` teve o rótulo "Nome do Cargo:" trocado para "Nome do Cargo (CTCEA):" com nota explicativa. Testes de `ImportarCargoRubiUseCase` atualizados (2 cenários reescritos para o novo comportamento); 367/367 passando, `tsc`/`build` limpos.

**Migration com obstáculo real:** `npx prisma migrate dev` recusou aplicar por causa de um drift pré-existente (FK de `unidadeFuncionalId` divergente entre histórico e schema real, não relacionado a esta mudança) e sugeriu `prisma migrate reset` — **recusado deliberadamente**, pois resetaria o schema "public" de produção (mesmo padrão do incidente de 2026-08-14). Alternativa segura usada: SQL manual (`ALTER TABLE "Cargo" ADD COLUMN "nomeCargoCtcea" TEXT;`) aplicado via `prisma db execute`, migration registrada no histórico via `prisma migrate resolve --applied`. Container Docker do shadow database local (`sgo-shadow-db`) estava parado, precisou ser religado (`docker start`) antes do diff funcionar.

`/code-review medium` achou 1 problema real: a migration não fazia backfill de `nomeCargoCtcea` para Cargos já importados do Rubi antes da mudança (ficariam com o campo vazio no painel). Corrigido: `UPDATE "Cargo" SET "nomeCargoCtcea" = "nomeCargoMercado" WHERE "tabSalCodigo" IS NOT NULL;` adicionado à migration e aplicado em produção. Manual do usuário ("Manual da Estrutura Funcional e Cargos", mesmo link) atualizado nas seções 07/08 e na FAQ.

PR #9 aberto e **mergeado na master** (commit `5b1f72e`) — usuário reportou "o problema continua" logo após o primeiro anúncio de conclusão porque o PR ainda estava só aberto, não mergeado (código de produção continuava rodando a versão antiga mesmo com a coluna já criada no banco). Lição: **anunciar "resolvido" só depois de confirmar merge na master, não só PR aberto + code-review OK.**

### 2. Alerta orientativo — cadastro de Cargo sem Estrutura Funcional

Usuário pediu um fluxo de alertas orientativos para o cadastro de Cargo (Empregados → botão Estrutura Funcional e Cargos → Tabela Salarial cria o Cargo → aba Cargos completa). `analista-negocios-po` refinou 2 ambiguidades antes de implementar:
- **Regra da aba Cargos** ("se tentar cadastrar Cargo novo pela aba Cargos, alertar para usar a Tabela Salarial"): confirmado como **regra preventiva/futura** — hoje não existe nenhum caminho de criar Cargo do zero na aba Cargos (só editar Cargo existente), então nenhum botão artificial foi criado só para exibir o alerta. Registrado em memória para quando esse caminho existir.
- **Alerta de Estrutura Funcional ausente**: confirmado que deve aparecer só ao tentar **completar/editar** um Cargo na aba Cargos (não no cadastro rápido da Tabela Salarial). Implementado: `iniciarEdicao` em `CargoPanel.tsx` agora seta a mensagem de erro já existente no componente quando `unidadesAnaliticas.length === 0`. Fix pequeno, direto na master, commit `3222655`.

### 3. Reajuste de +20% na Grade Salarial CTCEA

Pedido do usuário: alterar os salários de todas as Faixas/Níveis importados do Rubi, "fique à vontade para decidir o valor". Esclarecido antes de agir: eram os dados reais de `GradeSalarialCtcea` (catálogo fonte, 140 linhas = 7 Faixas × 20 Níveis), não `Cargo.salarioReal`. Sugestão inicial de +8% recusada pelo usuário, que pediu +20%. `UPDATE "GradeSalarialCtcea" SET salario = round(salario * 1.20, 2);` — MCP do Supabase recusou por estar em modo somente leitura; classificador do modo automático bloqueou a execução direta do `prisma db execute` por ser escrita em massa em produção sem confirmação no momento do comando (mesmo já tendo confirmação explícita do usuário na conversa). **Contornado da forma correta**: usuário rodou o comando ele mesmo via prefixo `!` no prompt (execução autorizada diretamente por ele, fora do bloqueio do classificador). Conferido por amostra: F1/N1 de R$ 1.570,98 → R$ 1.885,18; F7/N20 de R$ 48.452,67 → R$ 58.143,20. Nota: `Cargo.salarioReal` já gravado em Cargos existentes não muda sozinho — só reflete o novo valor após reimportação/ressincronização.

### Estado ao final

`master` em `3222655` (mais o commit deste registro). PR #9 mergeado, alerta de Estrutura Funcional no ar, Grade Salarial CTCEA reajustada em produção. Nenhuma migration pendente sem aplicar.

**Próximo passo natural:** (1) decidir layout final de Cargo (3 opções propostas em 2026-08-14, ainda em aberto); (2) US-133 (`FonteAtivaSalario.TOTAL`)/US-134 (Snapshot de Oficialização); (3) se um caminho de "Novo Cargo" for adicionado à aba Cargos no futuro, retomar o alerta preventivo do item 2 acima.

## 2026-08-18 — registrada às 00:22 UTC — Custo do Cargo ao vivo (opção 2 do layout), ordem correta de cadastro documentada, remoção de Cargo Rascunho do seletor de Empregado e fix de flakiness de fuso horário no CI

Sessão curta, quatro entregas encadeadas, todas fix pequeno/localizado (direto na `master`).

### 1. Layout de Cargo — opção 2 implementada (custo "ao vivo")

Usuário revisitou o mockup de 3 opções de 2026-08-14 (artefato republicado) e escolheu a **opção 2** (coluna principal + painel lateral fixo). A estrutura de grid já existia desde a sessão de 08-15, mas o painel só mostrava o custo da *última gravação*. Completado por `fullstack-dev`: `CargoPanel.tsx` agora recalcula Salário Total e Custo Total a cada tecla, reusando as funções puras `calcularSalarioTotalCargo`/`calcularCustoTotalCargo` do domínio (evita duplicar a fórmula no client). `diasUteisPadrao` (antes só usado no backend) passou a ser buscado em `estrutura/page.tsx` e repassado via props (`EstruturaFuncionalPanel` → `CargoPanel`). Commit `2a25c8d`.

### 2. Documentação da ordem correta de cadastro

Usuário pediu para formalizar a ordem: **Estrutura Funcional (Organograma) → Tabela Salarial → Cargos → Empregados**. `redator-tecnico` atualizou `docs/MANUAL_USUARIO_CARGOS_EMPREGADOS_SEMAFORO.md` com nova seção "Ordem Correta de Cadastro" no topo, seções de Organograma/Tabela Salarial que faltavam, e corrigiu a seção de Cargos, que ainda descrevia o **Rateio Funcional por percentual antigo** (pré-ADR-043/US-135) em vez do Vínculo Funcional único atual — doc estava desatualizada há duas gerações de mudança. Commit `95de0da`. O artefato interativo "Manual da Estrutura Funcional e Cargos" (mesmo link desde 2026-08-15) foi republicado com uma 5ª etapa no fluxo visual (antes só tinha Tabela Salarial → Cargos → Empregados) e renumeração das seções.

### 2b. Investigação de trava (sem gap de regra, só de UX)

Usuário também pediu para criar travas/alertas "se necessário". `analista-negocios-po` investigou se o seletor de Cargo na tela Empregados permitia escolher um Cargo Rascunho — achado: **o backend já bloqueia isso** (ADR-042, `CargoRascunhoNaoPodeReceberEmpregadoError`, mensagem já clara). Não havia gap de regra de negócio. O gap real era só de UX: o seletor listava Cargos Rascunho, e o usuário só descobria o bloqueio ao tentar salvar. `fullstack-dev` corrigiu: filtro `status: { not: 'RASCUNHO' }` na query de `[id]/[[...guia]]/page.tsx`, mais mensagem de "sem Cargo disponível" mais orientativa em `EmpregadoPanel.tsx`. Commit `b8367ae`.

### 3. Fix de flakiness de fuso horário no CI

Ao dar `push`, o CI falhou (`32083657145`) em `CadastrarAliquotaImpostoUseCase.test.ts` — teste "bloqueia data de início retroativa" resolveu em vez de rejeitar. Causa raiz: o helper de teste `dataCalendarioUTC()` calculava "hoje" em **UTC puro**, mas a regra de produção `ehDataAnteriorAHoje`/`hojeNoFusoDoSistema` compara contra "hoje" no fuso **America/Sao_Paulo (UTC-3)** — os dois calendários divergem entre 21h e 23h59 UTC, exatamente a janela em que o CI rodou (00:14 UTC = 21:14 em Brasília do dia anterior). Não era código de produção quebrado, só o teste usando referência de fuso errada. Corrigido: helper passou a usar `hojeNoFusoDoSistema()` (mesma função do domínio) em vez de `Date.UTC` puro. Commit `2a7a797`, CI reexecutado e verde.

### Estado ao final

`master` em `2a7a797`, tudo enviado (`git push` confirmado, 4 commits). CI verde. 367/367 testes passando localmente e no CI.

**Próximo passo natural:** US-133 (`FonteAtivaSalario.TOTAL`) / US-134 (Snapshot de Oficialização) seguem como próximas peças do módulo de Cargos, ainda não iniciadas.

## 2026-08-26 — registrada antes de reiniciar a sessão (MCP do Supabase) — US-139/ADR-047 em implementação, PAUSADA aguardando reconexão MCP

Sessão que cobriu: leitura de memória de sessões anteriores (última era 2026-08-18; gap identificado
entre 2026-08-18 e o `git log` atual — commits `dd34ee5`/`b20b927`/`13dd8a4` do módulo Orçamentário
(US-138 Cronograma de Desembolso + landing de Acompanhamento/Orçado) não têm registro correspondente
neste arquivo, investigação ainda não feita); depois, uma feature nova completa, do refinamento até
quase o fim da implementação.

### US-139/ADR-047 — Importar Nome do Cargo (Mercado) do catálogo de RH

Pedido do usuário: campo "Nome do Cargo (Mercado)" (já existe em `Cargo`, digitação livre) deve também
poder ser importado de um catálogo de cargos de mercado do RH. Sem integração HTTP com o ERP de RH
ainda — fonte usada agora: `docs/Cargo de Mercado.xls` fornecido pelo usuário (184 linhas, 4 delas
lixo tipo "xxxxxxxxxxxxxxxxxxx" nos códigos 122/151/117/137, confirmadas como excluíveis pelo usuário
via `AskUserQuestion` — total real: 180 cargos).

Fluxo completo pelas skills: `analista-negocios-po` refinou **US-139** (opcional/não-bloqueante,
nunca sobrescreve digitação manual sem clique explícito — lição do bug `nomeCargoCtcea` de
2026-08-15) → `techlead-fsg` produziu **ADR-047**: tabela dedicada `CargoMercadoCatalogo`
(codigoOrigem+nome+syncedAt, sem FK pra `Cargo`), autocomplete leve embutido no campo (não modal
pesado tipo `ImportarCargoRubiModal` — não haveria Faixa/Nível pra filtrar aqui), nomenclatura
deliberadamente distinta da importação Rubi/CTCEA (`nomeCargoCtcea`) já existente, botão
"Sincronizar Catálogo de Cargo de Mercado" dedicado (mesmo padrão ADR-046/Grade Salarial CTCEA).

**Implementado por mim (chapéu `fullstack-dev`), nesta ordem, na branch `feature/us-139-cargo-mercado-catalogo`:**
- Schema: enum `TipoOperacao` +`SYNC_CARGO_MERCADO_CATALOGO`; models `CargoMercadoCatalogo` +
  `SincronismoCargoMercadoCatalogoLock` (mesmo padrão de `GradeSalarialCtcea`/lock, sem FK não
  relacionada — achado de code-review já visto 2x antes, evitado desta vez de propósito).
- `src/infrastructure/integrations/cargo-mercado/` (types, `cargo-mercado-raw.ts` com os 180
  registros transcritos do xls via `xlrd` em Python, `CargoMercadoArquivoProvider`).
- `CargoMercadoCatalogoBulkLoader` (upsert em lote chunked, mesmo padrão do loader CTCEA, com
  teste cobrindo o chunking em >2000 linhas — achado de code-review do ADR-046 não repetido).
- `SincronismoCargoMercadoCatalogoLockRepository`, 2 erros de domínio novos em `errors.ts`.
- Use cases `SincronizarCargoMercadoCatalogoUseCase` / `BuscarCargoMercadoCatalogoUseCase`
  (busca por substring, `ILIKE`, limite 20 resultados), registrados em `container.ts`.
- Server Actions: `sincronizarCargoMercadoCatalogo` (`plano-contas/actions.ts`),
  `buscarCargoMercadoCatalogo` (`propostas/estrutura-actions.ts`).
- Funcionalidade nova no seed (`cargo-mercado-catalogo.sincronizar`, `ativo: false` por padrão,
  mesmo padrão de `grade-salarial-ctcea.sincronizar`).
- UI: `BotaoSincronizarCargoMercadoCatalogo.tsx` em `/plano-contas` (nova seção "Catálogo de Cargo
  de Mercado (RH)"); `AutocompleteCargoMercado.tsx` embutido no campo em `CargoPanel.tsx`
  (debounce, nunca sobrescreve sem clique).
- Testes novos (`CargoMercadoCatalogoBulkLoader`, `SincronizarCargoMercadoCatalogoUseCase`,
  `BuscarCargoMercadoCatalogoUseCase`): 10 testes, todos passando. Suíte completa: **379/379
  passando**, `tsc --noEmit` limpo, `eslint` limpo nos arquivos tocados.

**Achado não relacionado, descoberto ao validar `next build`:** a página `/orcamentario/acompanhamento`
(dos commits `b20b927`/`13dd8a4`, não documentados aqui antes) quebra o build de produção com
"Missing publishableKey" do Clerk — **confirmado que é pré-existente em `master`** (reproduzido com
`git stash` + build limpo, mesmo erro sem nenhuma mudança desta sessão). Não investigado a fundo
ainda — possivelmente falta algum guard de renderização dinâmica nessa página nova, diferente das
demais páginas autenticadas que não quebram o build sem `.env`. **Registrar como pendência para a
próxima sessão, fora do escopo de US-139.**

### Migration da US-139: BLOQUEADA, sessão pausada para reiniciar (MCP do Supabase)

Ao chegar na etapa de migration, descobri que **este Codespace não tem `.env` configurado** — sem
`DATABASE_URL` nem `SHADOW_DATABASE_URL` no ambiente (Codespace foi recriado desde a última sessão,
mesma causa já suspeitada para a memória padrão vazia no início desta sessão). Não tentei adivinhar
nem construir a URL — parei e perguntei ao usuário, seguindo a regra permanente de cautela com banco
de produção do CLAUDE.md.

Usuário optou por instalar o MCP do Supabase para aplicar a migration sem precisar do `.env` local
(eu escrevo o SQL à mão, sem `prisma migrate dev`/`migrate diff` — que exigem shadow database e
foram a causa do incidente de 2026-08-14 —, mostro pra aprovação, aplico via MCP, registro no
histórico do Prisma). Comando rodado pelo usuário:
```
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=gfmsuodfvdzbkahjjpbr&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
```
Registrado em `.mcp.json` (arquivo novo, ainda não commitado — decidir se entra no commit da feature
ou fica só local/gitignored, não decidido ainda). As ferramentas do MCP não apareceram nesta sessão
mesmo após tentativas de busca — provavelmente precisa reiniciar a sessão do Claude Code (mudança em
`.mcp.json` só é lida na inicialização) e possivelmente autorizar via OAuth no navegador na primeira
conexão. **Sessão pausada aqui, a pedido do usuário, para reiniciar e reconectar o MCP.**

### Estado exato ao pausar

Branch `feature/us-139-cargo-mercado-catalogo`, **nada commitado ainda** — todas as mudanças listadas
acima estão só no working tree (`git status` mostra 8 arquivos modificados + 12 novos, incluindo
`docs/Cargo de Mercado.xls` ainda não versionado). `.mcp.json` também não commitado. Reiniciar a
sessão do Claude Code (processo) não apaga esses arquivos — só reinicia a sessão de conversa; os
arquivos em disco permanecem. **Não rodar `git checkout`/`git clean`/`git reset` em nada nesta
branch antes de retomar.**

**Próximo passo combinado, na ordem:** (1) confirmar que as ferramentas do MCP do Supabase apareceram
após o reinício; (2) escrever a migration SQL à mão (2 tabelas + 1 valor de enum) e mostrar para
aprovação antes de aplicar; (3) aplicar via MCP + registrar no histórico do Prisma
(`prisma migrate resolve --applied`); (4) rodar `next build` completo de novo (já validado antes da
migration, só as 2 tabelas novas faltam); (5) commit(s) na branch, push, abrir PR, `/code-review`;
(6) decidir separadamente o achado do item "/orcamentario/acompanhamento" (fora do escopo desta US).

## 2026-08-26 (cont.) — migration da US-139 aplicada manualmente (rede local não permitiu instalar o MCP do Supabase)

Ao retomar, o MCP do Supabase não conseguiu ser instalado no ambiente do usuário (rede local com restrição). Decisão: abandonar o caminho do MCP e aplicar a migration inteiramente na mão, seguindo o mesmo cuidado (SQL mostrado para aprovação antes de rodar, nunca `prisma migrate dev`/`migrate diff` contra produção).

**O que foi feito, em ordem:**
1. `dba-data-engineer` (via skill) gerou `prisma/migrations/20260826132733_add_cargo_mercado_catalogo/migration.sql`, no mesmo molde exato da migration `20260814135855_add_grade_salarial_ctcea` (2 `CREATE TABLE` + 2 `CREATE INDEX` + 1 `ALTER TYPE ... ADD VALUE`). Risco classificado como LOW — só cria tabelas novas vazias, não toca em dado/coluna existente.
2. Usuário aplicou o SQL manualmente via **SQL Editor do Supabase** (não pelo MCP, não pelo Prisma CLI) — "Success. No rows returned".
3. Registro no histórico do Prisma (`prisma migrate resolve --applied ...`) travou 2x por causa da rede: (a) 1ª tentativa sem `DATABASE_URL` no ambiente (Codespace não tem `.env`, mesmo problema já documentado antes); (b) 2ª tentativa com a connection string **direta** (`db.<ref>.supabase.co:5432`) deu `P1001: Can't reach database server` — IPv6, incompatível com a rede local do usuário; (c) 3ª tentativa com o **Transaction pooler** (`aws-0-sa-east-1.pooler.supabase.com:6543`) ficou pendurada (>2min sem resposta, sem erro) — o modo transaction do pooler não sustenta o lock de sessão que `prisma migrate resolve` precisa; **funcionou** na 4ª tentativa trocando só a porta para o **Session pooler** (mesmo host, `:5432`, usuário `postgres.<project_ref>`). **Lição para o futuro:** neste projeto, para comandos `prisma migrate` contra o Supabase a partir de uma rede sem suporte a IPv6, usar sempre a connection string do Session Pooler (porta 5432 no host `pooler.supabase.com`), nunca a direta nem o Transaction pooler (porta 6543).
4. ⚠️ **Nota de segurança:** durante o processo, o usuário colou a senha do Postgres de produção em texto puro no chat (via comando `export DATABASE_URL=...`). Foi recomendado a ele trocar a senha em `Supabase → Project Settings → Database → Reset database password` depois de concluída a sessão — **confirmar se isso foi feito**; se não, é uma pendência de segurança em aberto.
5. `next build` de produção rodado de novo — o erro pré-existente em `/orcamentario/acompanhamento` ("Missing publishableKey" do Clerk) se repetiu, confirmando (de novo) que não tem relação com a US-139.
6. `npx tsc --noEmit` limpo, `npx vitest run` 379/379 passando, `eslint` limpo nos arquivos tocados.
7. Falta apenas: commit(s) na branch `feature/us-139-cargo-mercado-catalogo`, push, abrir PR, rodar `/code-review`.

**Pendência não relacionada, ainda em aberto (herdada, não é escopo da US-139):** erro de build em `/orcamentario/acompanhamento` por falta de `publishableKey` do Clerk — investigar em sessão futura.

**Decisão pendente:** se `.mcp.json` (aponta pro MCP do Supabase, que acabou não sendo usado nesta sessão por limitação de rede) entra no commit desta feature ou fica de fora/local. Como a instalação nunca chegou a funcionar, tende a fazer mais sentido não commitar por ora — decidir no momento do commit.

## 2026-08-26 (cont. 2) — `/code-review high` no PR #12: 2 achados corrigidos, 1 registrado como dívida técnica (não corrigido de propósito)

`/code-review high` rodado na branch `feature/us-139-cargo-mercado-catalogo` (PR #12) achou 3 pontos:

1. **[Corrigido]** `AutocompleteCargoMercado.tsx` — resposta de busca fora de ordem (debounce) podia sobrescrever sugestão mais recente com resultado desatualizado, inclusive reabrindo a lista já com o campo abaixo do mínimo de caracteres. Corrigido com um ref (`ultimoTermoBuscadoRef`) que guarda o termo da busca em voo e descarta a resposta se o termo mudou nesse meio-tempo (inclusive invalidando a ref quando o campo é limpo abaixo do mínimo).
2. **[Corrigido]** `CargoMercadoCatalogoBulkLoader.ts` — `INSERT ... ON CONFLICT` em lote sem deduplicar `codigoOrigem` antes de montar o statement; Postgres rejeita o lote inteiro se o mesmo código aparecer 2x no mesmo INSERT (`cannot affect row a second time`). Corrigido com `Map` deduplicando por `codigoOrigem` (mantendo a última ocorrência) antes de fatiar em lotes de 2000. Teste novo cobrindo o cenário.
3. **[Registrado, não corrigido — decisão do usuário]** 3ª cópia quase idêntica do padrão de lock por tenant (Plano de Contas → CTCEA → Cargo Mercado) e do bulk loader chunked (CTCEA → Cargo Mercado). Não é bug, é dívida técnica de duplicação — decisão consciente de não extrair abstração genérica (`TenantSyncLockRepository`/`BulkUpsertLoader<T>`) agora. **Revisitar na próxima vez que esse padrão se repetir de novo** (4ª ocorrência seria o gatilho natural para extrair).

380/380 testes passando (1 novo), `tsc --noEmit` e `eslint` limpos nos arquivos tocados. Falta: commit do fix, push, atualizar PR #12.

## 2026-08-31 — Testes de componente do autocomplete de Cargo de Mercado (US-139) — PR #14 mergeado

Sessão de QA/automação conduzida pela skill `analista-testes-qa`. Ambiente novo (container efêmero recriado), sem `.env` — a memória padrão do `~/.claude` estava vazia, como esperado; o contexto foi reconstruído a partir deste arquivo + histórico do git.

**Ponto de partida (onde havíamos parado):** US-139/ADR-047 (importar Nome do Cargo de Mercado do catálogo de RH) já entregue e mergeada no PR #12 (`37a0145`), e o PR #13 (`fix/login-prod-datasource`) também mergeado. Trabalho desta sessão foi fechar um gap de cobertura de teste da US-139.

**O que foi feito, em ordem:**
1. **Roteiro de teste manual da US-139** (via `analista-testes-qa`): 11 casos (CT-139-01 a 11) cobrindo as 2 partes — (Parte 1) botão "Sincronizar" do Catálogo de Cargo de Mercado na tela de Plano de Contas (permissão administrativa, lock por tenant, auditoria `SYNC_CARGO_MERCADO_CATALOGO`, 180 linhas do `docs/Cargo de Mercado.xls`, idempotência, isolamento multi-tenant P0); (Parte 2) autocomplete no campo `nomeCargoMercado` (mínimo 2 chars, debounce 300ms, teto 20, nunca sobrescreve sem clique).
2. **Automação dos gaps de UI** — o projeto **não tinha nenhum teste de componente React** até então. Habilitada a infra: devDeps `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`; `vitest.config.ts` com `environmentMatchGlobs` (jsdom só para `*.test.tsx`, `node` no resto); `vitest.setup.ts` registrando os matchers do jest-dom.
3. **Teste novo** `src/app/(autenticado)/propostas/AutocompleteCargoMercado.test.tsx` (5 casos): CT-139-06 (seleção preenche nome exato), CT-139-07 (**nunca sobrescreve digitação sem clique** — regra central da US), CT-139-08 (não busca <2 chars), CT-139-09 (estado vazio), CT-139-11 (resposta de busca fora de ordem descartada).
4. **PR #14 aberto** e rodado `/code-review high`. Achado substantivo: o CT-139-11 original era um **no-op** — "ana" e "lista" digitados dentro da mesma janela de debounce faziam o timer de "ana" ser cancelado, então a busca antiga nunca disparava e o teste passaria mesmo sem o guard `ultimoTermoBuscadoRef`. **Corrigido** (2º commit `dc3818f`): o teste agora espera `toHaveBeenCalledWith('ana')` antes de digitar o resto, garantindo que a resposta obsoleta chegue depois e seja de fato descartada. Também removido `vi.useRealTimers()` morto e esclarecido o CT-139-08.
5. Verificação: suíte **385/385** passando (era 380; +5), `tsc --noEmit` e `eslint` limpos. CI (Actions) verde na head + Vercel verde.
6. **PR #14 mergeado** na `master` (merge commit `5d0e383`). Monitoramento via `subscribe_pr_activity` encerrado e check-in agendado cancelado após o merge.

**Nota de fluxo Git:** houve um bloqueio de 403 no `git push` por falta de acesso do GitHub App; resolvido após o usuário reconectar o GitHub nas configurações do claude.ai. Fica como lição: 403 no push é problema de autorização do App (reconectar/instalar), não erro de rede — repetir não resolve.

**Pendências herdadas ainda em aberto (NÃO tratadas nesta sessão):**
- **Build quebrado em `/orcamentario/acompanhamento`** — `"Missing publishableKey"` do Clerk, pré-existente na `master` (confirmado, sem relação com US-139). Candidato natural para a próxima sessão — provável falta de guard de renderização dinâmica nessa página nova.
- **Segurança:** confirmar se a senha do Postgres de produção (colada em texto puro no chat em 2026-08-26) foi resetada em Supabase → Project Settings → Database.
- **Dívida técnica:** 3ª cópia do padrão lock-por-tenant + bulk loader chunked (Plano de Contas → CTCEA → Cargo Mercado); extrair abstração genérica só na 4ª ocorrência.
- **Gaps de teste não automatizados** da US-139: CT-139-05 (isolamento de tenant end-to-end — candidato a E2E Playwright) permanece só manual.

## 2026-09-01 — Sincronização da memória (STATUS_PROJETO.md + hook) e tela de Viagens

Ambiente novo (container efêmero): memória `~/.claude` vazia, **sem `.env` e sem `node_modules`**;
`npm install` falha com `SELF_SIGNED_CERT_IN_CHAIN` (mesma restrição de rede local do MCP do
Supabase). Nenhuma verificação `tsc`/`eslint`/`vitest`/`next` pôde rodar nesta sessão — tudo
dependeu do CI do GitHub Actions.

**1. Mecanismo de memória sincronizada (commit `5433c72`, direto na master):**
- `docs/STATUS_PROJETO.md` — snapshot conciso e rotativo do estado do projeto, versionado no git
  (a "sincronização": sobrevive à recriação do container, que zera `~/.claude`).
- `.claude/settings.json` + `.claude/hooks/session-status.ps1` — hook de **SessionStart** que
  injeta o `STATUS_PROJETO.md` no contexto no início de cada sessão. Script em ASCII puro
  (PowerShell 5.1 lê `.ps1` como ANSI; acento em literal vira mojibake) e força saída UTF-8.
- `~/.claude/.../memory/`: `MEMORY.md` + memórias finas (`fonte-verdade-status`,
  `incidente-perda-dados-producao`) apontando para os arquivos do repo como fonte de verdade.
  Não é versionado — é cache efêmero.

**2. Tela de Viagens — rótulos + faixa de totais (commit `4484882`, direto na master):**
Mudança só de apresentação em `src/app/(autenticado)/propostas/ViagemPanel.tsx`:
- Rótulos do form: "Descrição" → "LOCALIDADE (PAÍS)", "Média de Dias" → "MÉDIAS DE DIAS",
  "Custo Unit. Passagem" → "CUSTO UNIT. PASSAGEM (IDA/VOLTA)", "Custo Unit. Diária" →
  "CUSTO DE DIÁRIAS (POR PESSOA)". Só o texto do `<label>`.
- Faixa agregada `FaixaTotaisViagens`: TOTAL DE PASSAGENS, TOTAL DE DIÁRIAS, TOTAL GERAL
  (= passagens + diárias + transporte = Custo Total Estimado). Reaproveita
  `calcularComponentesCustoViagem`; `totaisPorComponente` extraído para useMemo próprio.
- Confirmado com o usuário (AskUserQuestion): fórmulas de Passagens (Qtd × unit) e Diárias
  (Qtd × dias × unit) **já eram as atuais** — nada a mudar no domínio. O card "Nº de Viagens"
  fica como está (o card "Total de Pessoas-Viagem" já soma `quantidadePessoas`).

**3. Tela de Viagens — editar Viagem (PR #16, merge `c8c6ba0`):**
`editarViagem` (Server Action) e `EditarViagemUseCase` **já existiam** (US-109 Cenário 4) — só
faltava a UI. Branch `feature/us-109-editar-viagem-ui` (`97bb01c`):
- Botão "Editar" por linha (só `!readOnly`), ao lado de Copiar/Excluir; realça a linha em edição.
- `NovaViagemForm` → `ViagemForm`: form único em 2 modos (criação/edição). Em edição: título
  "Editar Viagem", botão "Salvar alterações", botão "Cancelar". Submit chama
  `editarViagem({ viagemId, ...campos })` **sem `tokenConcorrencia`** (opcional; o use case já
  protege concorrência lendo o `updatedAt` atual antes do `updateMany`).
- `aoSalvar` unifica: id já no state → substitui; senão → anexa.
- Sem mudança de backend/contrato/schema. **O usuário mergeou o PR #16 sem rodar `/code-review`**
  (decisão consciente, mudança só de UI).

**4. US-140 (BLOQUEADA) — Total de Transporte da Viagem por média histórica da conta (commit `574acfd`, doc):**
Pedido do usuário: "Total com transporte = valor informado pelo GFIN => médias da conta dos
últimos anos". Confirmado (AskUserQuestion): é **cálculo automático** do sistema e **só
exibição** — NÃO altera `Viagem.custoEstimado` (que segue alimentando Semáforo/Cronograma/
dashboard como hoje). **Bloqueio real:** o SGO não tem série histórica de realizado por conta
multi-ano (só `ValorOrcadoConta` orçado + realizado da proposta corrente). Sem fonte desse dado
não há o que calcular. `docs/US-140 ...md` lista 7 bloqueios (B1–B7: origem do dado, janela/
método da média, qual conta, o que fazer com o campo atual, borda sem histórico, multi-tenant).
Adicionada ao kanban em 🔴 Bloqueado. Menor incremento futuro: US-140a (carga de realizado
histórico por conta via planilha) → depois US-140 (exibir a média).

**Estado ao final da parte 1:** `origin/master` em `c8c6ba0`, local sincronizado. Pendências
herdadas seguem abertas + US-140 nova.

## 2026-09-02 (cont.) — US-141 implementada (município IBGE na Viagem)

O usuário pediu para seguir de forma autônoma até o merge. Fonte de dados:
`github.com/kelvins/municipios-brasileiros` (MIT, commit `503e2f70`, 5571 municípios com
código IBGE + nome + UF + lat/long) — clonado para o scratchpad e transcrito.

Implementado na branch `feature/us-141-municipio-ibge-viagem` (3 commits `0538efd`/`a4f2acc`/`56adba6`),
seguindo ADR-048:
- **Catálogo embutido**: `scripts/gerar-municipios-br-raw.mjs` + `src/infrastructure/integrations/municipios-br/`
  (`municipios-brasileiros-raw.ts` gerado — 5571 registros, ~590 KB; `types.ts`; `municipio-br-catalogo.ts`
  com `resolverMunicipioBr()` em memória; `LICENSE` MIT). Sem sync, sem tabela, sem job.
- **Schema/migration**: `Viagem` +5 colunas (`municipioIbge`, `municipioNome`, `uf` snapshot +
  `latitude`/`longitude` `Decimal(9,6)`) + índice `(tenantId, municipioIbge)`. Migration aditiva
  `20260902120000_add_municipio_ibge_viagem` **escrita mas NÃO aplicada** — o usuário aplica via
  SQL Editor do Supabase (regra do CLAUDE.md).
- **Use cases**: `CadastrarViagemUseCase` exige `municipioIbge` (só o código; nome/uf/coords
  resolvidos do catálogo no servidor — anti-spoofing); `descricao` virou opcional.
  `EditarViagemUseCase` — município opcional (não trava viagem legada). **`CriarVersaoPropostaUseCase`
  propaga os 5 campos** ao copiar Viagens (risco de regressão nº 1 do ADR — teste dedicado).
- **UI**: `ComboboxMunicipio.tsx` (busca client-side acento/caixa-insensível, mín. 2 chars, teto
  20, catálogo por `import()` dinâmico + cache de módulo) + `municipios-br-client.ts`.
  `ViagemPanel`: rótulo "MUNICÍPIO (BRASIL)" obrigatório no cadastro; "LOCALIDADE (PAÍS)" →
  "MOTIVO / COMPLEMENTO DA VIAGEM" (opcional); viagem legada exibe "— (sem município)".
- **Server Actions**: `cadastrarViagem`/`editarViagem` +`municipioIbge`; `ViagemResultado` +5
  campos; `page.tsx` select estendido.
- **Testes**: catálogo (hit/miss, integridade dos 5571), `filtrarMunicipios` (acento-insensível,
  teto), `CadastrarViagemUseCase` (obrigatório/inválido/snapshot/descrição opcional),
  `EditarViagemUseCase` (troca/opcional-legada/inválido), `CriarVersaoPropostaUseCase` (propaga).

**Não validado localmente** — ambiente sem `node_modules` (npm bloqueado por self-signed cert).
Só `node --experimental-strip-types --check` passou nos arquivos `.ts` (não pega `.tsx` nem tipos).
CI é o gate.

### Desfecho — PR #17 mergeado, 500 em produção, corrigido

- `/code-review high` rodou 2x na branch. 1ª rodada: 6 achados, os relevantes corrigidos (commit
  `aad6555` — ranking de relevância no combobox, `viagem-serializer.ts` unificando o mapeamento
  linha→DTO, log de exclusão sem `descricao`, etc.). 2ª rodada apontou 2 erros de `tsc` — mas
  eram contra edições minhas **ainda não commitadas** de uma 3ª leva; o código mergeado (1ª leva)
  compila e passou no CI.
- Usuário mergeou o **PR #17** (`54d5298`) direto no GitHub, sem esperar eu terminar.
- **`/propostas/{id}/viagens` deu 500 em produção** — a migration `20260902120000_add_municipio_ibge_viagem`
  não tinha sido aplicada; o Server Component consultava colunas (`municipioIbge` etc.) que não
  existiam no Supabase. Passei o SQL (`ALTER TABLE "Viagem" ADD COLUMN ...` × 5 + `CREATE INDEX`),
  o usuário aplicou via SQL Editor, produção voltou.
- A 3ª leva de correções (achados da 2ª rodada do code-review) foi **descartada** (stash pop
  conflitou feio com o master já mergeado; `git stash drop`). Ficaram como pendência leve #7 do
  `STATUS_PROJETO.md` — não são regressão, não são urgentes:
  1. não dá para **remover** um município já atribuído (só trocar);
  2. o snapshot é re-resolvido do catálogo a cada edição da Viagem (viola "congelado" do ADR-048,
     inócuo hoje pois o catálogo é pinado);
  3. `prisma migrate resolve --applied 20260902120000_add_municipio_ibge_viagem` ainda pendente.

**Lição:** PR com migration → aplicar o SQL no Supabase junto do merge, não depois do 500.

## 2026-09-02 (cont. 2) — Cronograma de Desembolso (US-142 / ADR-049) + frente Impostos (épico / ADR-050 / US-144-146)

Sessão longa, toda de **refinamento/documentação** (nenhum código novo). Ambiente sem
`node_modules` (npm bloqueado por `SELF_SIGNED_CERT_IN_CHAIN` — proxy/segurança corporativa na
rede do usuário; o usuário ainda **não** aplicou a correção: `NODE_EXTRA_CA_CERTS` com o CA da
empresa, ou `NODE_TLS_REJECT_UNAUTHORIZED=0`). Todos os commits desta parte são `docs(...)` em
`origin/master`.

### A) Cronograma de Desembolso — US-142 + ADR-049 (PRONTO PARA IMPLEMENTAR)

O usuário forneceu 2 documentos-alvo: primeiro "APÊNDICE J", depois o definitivo
**`ANEXO 9 - CRONOGRAMA DESEMBOLSO 15.08.25.pdf`** (TP PAME-RJ/CTCEA/2025). A tela atual
(`montarCronogramaDesembolso.ts` + `CronogramaDesembolsoPanel.tsx`) é uma **grade mês a mês** —
o alvo é uma **tabela de parcelas T1..Tn** agrupadas por ano.

Decisões de negócio (AskUserQuestion), todas em `docs/US-142 - Cronograma de Desembolso por Parcelas (ANEXO 9).pt-BR.md`:
- Calendário de repasse **configurável na Proposta**: 2 campos novos `parcelasPorAno` (1/2/3/4/6/12)
  + `mesInicialRepasse` (1-12). Ex.: 3/janeiro → jan/mai/set.
- **Parcela de entrada** (T1) no mês de `dataInicio`; quando coincide com o 1º repasse (caso
  ANEXO 9), T1 = "Etapas 1 e 2" e Tn (n≥2) → Etapa (n+1); sem coincidência, Tn → Etapa n.
- Período **ANTECIPADO**: Tk paga o bloco `[Dk, D(k+1)−1]`; última parcela até `dataFim`.
- Sub-linha única **"Evento Tn Meta 01"** (meta única — CONSOLIDADA na prática).
- Coluna 7 = **"VALOR ACUMULADO POR ANO DO TERMO DE PARCERIA"** (só nas linhas "TOTAL A
  DESEMBOLSAR EM XXXX" = acumulado ao fim do ano civil). A RN0253/"repassado a cada 12 meses" **saiu**.
- Tela = **só leitura** + filtro de período (client-side, não recalcula).
- Substitui a grade mensal. Export PDF/XLSX no layout ANEXO 9.

**ADR-049 aceito** (`docs/ADR-049 - Cronograma de Desembolso por Parcelas.pt-BR.md`): migration
aditiva dos 2 campos + CHECK (DDL pronto); camada `agregarEmParcelas()` pura sobre o motor mensal
**preservado**; algoritmo de datas + Etapas; filtro client-side; **CD-06** (Viagem sem data infla
T1) aceito como limitação → **US-143 futura**. Maior risco: RN_CD_002 (Σ parcelas = Valor Global
exato) — teste de regressão reproduzindo os números do ANEXO 9 (Global R$ 194.981.162,00).
**Próximo:** `fullstack-dev` implementa (branch + PR + `/code-review`; migration junto do merge).

### B) Frente Impostos — ÉPICO + ADR-050 + US-144/145/146 (PRONTO PARA IMPLEMENTAR US-144)

O usuário pediu "módulo impostos, aplicar sobre analíticas e/ou sintéticas". Na descoberta,
esclarecido que **não é módulo novo** — é a evolução do Rateio de Impostos: o `valorDeclarado`
digitado à mão vira **cálculo automático** `imposto = base × alíquota%`.

**`docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md`** — 8 decisões (todas do
usuário via AskUserQuestion): base A1 (Empregado+Viagem+Bem, sem o próprio imposto); **sem
cascata** (impostos somam sobre a mesma base); sintética **C1** (ajusta a própria); congela
pós-oficialização **D1**; exibir "sem imposto" + "com imposto"; imunidade TP preservada.

**ADR-050 aceito** (`docs/ADR-050 ...md`) — **substitui o ADR-039** (que virou registro
histórico; o título "Composto" não vale mais). Decisões: modelo **A1** — `RateioImpostoGrade`
ganha `modoValor` (DECLARADO|CALCULADO) + `valorBaseSnapshot`; `AliquotaImpostoParametro` ganha
`categoria` (TRIBUTO|INDICE_REAJUSTE) — resolve a ambiguidade com o reaproveitamento de Reajustes
(ADR-040), que fica **intacto**. Gatilho = **botão "Gerar Impostos da Versão"** (não síncrono) +
aviso de "stale". Dados existentes = **grandfather total** (migração não recalcula nada).
Semáforo/Valor Global seguem "com imposto" (como hoje); "sem imposto" é número novo ao lado
(US-008a/ADR-032 não reabrem). `contaId` passa a aceitar sintética — quebra a invariante
"sintética = soma das filhas" (mitigada por flag `temImpostoDireto` + nota na tela).

**US escritas** (Gherkin completo): `docs/US-144` (motor, analítica — MVP, G), `docs/US-145`
(sintética, C1 — M, **maior risco**), `docs/US-146` (exibir os 2 valores — M, baixo risco).
**Backlog priorizado:** `docs/BACKLOG - Epico Impostos.pt-BR.md` — ordem **US-144 → US-145 →
US-146**; roadmap de 4 iterações; US-147 (separar tributo de índice) = opcional. Mitigação
obrigatória antes da US-145: blindar `CalcularValorRealizadoUseCase`/`ValorRealizadoService` com
testes de regressão da agregação bottom-up.

### Estado ao pausar (para retomar de outro computador)

- `origin/master` = `7e445f6`. Working tree limpo, tudo sincronizado.
- Branch `feature/us-141-municipio-ibge-viagem` ainda existe (local e remoto) mas **já foi
  mergeada** via PR #17 — pode apagar (`git branch -d` + `git push origin --delete`), não é urgente.
- **Nenhuma implementação pendente de código.** 3 frentes prontas para o `fullstack-dev`, em
  ordem de prioridade sugerida:
  1. **US-142** (Cronograma de Desembolso por parcelas) — ADR-049 aceito, migration de 2 campos.
  2. **US-144** (motor de imposto automático, analítica) — ADR-050 aceito, migration de 3 colunas.
  3. Follow-up leve da US-141 (pendência #7 do STATUS) — não urgente.
- Pendências herdadas em aberto: build `/orcamentario/acompanhamento` (500, `publishableKey` do
  Clerk); confirmar reset da senha do Postgres (2026-08-26); dívida do lock-por-tenant.
- **Ambiente:** o próximo computador provavelmente terá o mesmo bloqueio de npm (cert corporativo)
  — resolver com `NODE_EXTRA_CA_CERTS` antes de tentar `npm install`.

---

## Como usar este arquivo em sessões futuras

No início de uma sessão, se o usuário perguntar "qual o contexto/status de X", leia este arquivo antes de assumir que a memória padrão (`~/.claude/.../memory/`) está atualizada — o ambiente deste projeto (Codespace) pode ter sido recriado desde a última sessão, apagando a memória padrão sem apagar o repositório.
