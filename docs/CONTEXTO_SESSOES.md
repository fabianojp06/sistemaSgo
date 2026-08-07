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

**Estado ao final:** `tsc --noEmit` limpo em cada etapa. Servidor validado sem erro de runtime (`/propostas` e `/` respondendo 307→`/login` normalmente, sem exceção). Sem mudança de lógica de dados/backend nesta entrada — puramente visual, então sem impacto na suíte de testes (não rodada de novo, nenhum arquivo `.test.ts` tocado). Commit e push desta entrada a seguir.

**Próximo passo combinado:** nenhum item novo priorizado além do redesign. Segue em aberto desde US-119: modo leitura (`readOnly`) nos componentes de detalhe ao abrir uma versão antiga do histórico.

---

## Como usar este arquivo em sessões futuras

No início de uma sessão, se o usuário perguntar "qual o contexto/status de X", leia este arquivo antes de assumir que a memória padrão (`~/.claude/.../memory/`) está atualizada — o ambiente deste projeto (Codespace) pode ter sido recriado desde a última sessão, apagando a memória padrão sem apagar o repositório.
