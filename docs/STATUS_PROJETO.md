# STATUS DO PROJETO — SGO 2.0

> **Snapshot conciso e rotativo do estado atual.** Diferente de `CONTEXTO_SESSOES.md` (log
> append-only, histórico completo), este arquivo é **sobrescrito** a cada sessão para responder
> rápido "onde estamos". É versionado no git — essa é a sincronização: sobrevive à recriação do
> container (que zera a memória padrão em `~/.claude`).
>
> **Fontes de verdade duráveis, em ordem de detalhe:**
> 1. Este arquivo — resumo do estado atual.
> 2. `docs/CONTEXTO_SESSOES.md` — narrativa completa sessão a sessão.
> 3. `docs/BACKLOG - Kanban EP118-24 Módulo de Cadastros.md` — kanban do Módulo de Cadastros.
> 4. Histórico do git.
>
> **Regra:** ao encerrar uma sessão com mudança relevante de estado, atualize este arquivo E
> `CONTEXTO_SESSOES.md`, e faça commit (fluxo Git híbrido do `CLAUDE.md`).

**Última atualização:** 2026-09-05 (rede de regressão do `ValorRealizadoService`/`CalcularValorRealizadoUseCase` escrita e commitada — branch pushada, PR ainda não aberto — pré-requisito da US-145)

---

## Onde estamos

- **Branch:** `master` (`e5802d4`). Três entregas nesta sessão, todas mergeadas e com
  migration aplicada em produção:
  1. **US-142** (PR #18) — Cronograma de Desembolso por parcelas, layout ANEXO 9. Config de
     calendário de repasse na Proposta (`parcelasPorAno`/`mesInicialRepasse`) — cadastro +
     mini-form na capa, export PDF/XLSX com `estiloLinha`. Migration
     `20260904120000_add_calendario_repasse_proposta` aplicada.
  2. **US-144** (PR #19) — MVP do épico Impostos (ADR-050): motor de cálculo automático de
     imposto sobre conta analítica. `RateioImpostoGrade` +`modoValor`(DECLARADO|CALCULADO)
     +`valorBaseSnapshot`; `AliquotaImpostoParametro` +`categoria`(TRIBUTO|INDICE_REAJUSTE);
     botão "Gerar Impostos da Versão" na tela de Rateio de Impostos + aviso de stale.
     Migration `20260904160000_add_modo_valor_rateio_imposto_e_categoria_aliquota`
     **aplicada** (confirmado pelo usuário).
  3. **Atalho de UX** (PR #20, fora do épico Impostos, sem migration) — form de
     Cadastrar/Alterar Alíquota ganhou seção opcional "Vincular já a uma Proposta": ao
     salvar, além da alíquota, já cria/atualiza a linha de Rateio de Impostos (compõe com
     `ConfigurarRateioImpostoUseCase`, US-101). `AliquotaImpostoParametro` continua catálogo
     global do tenant (ADR-014 intacta) — decisão explícita do usuário entre 3 opções.
- **Pendência nova:** `prisma migrate resolve --applied` das 3 últimas migrations (US-141,
  US-142, US-144) — histórico do Prisma fora de sincronia com o banco (mesmo padrão da
  pendência #7c, nunca bloqueou nada até agora).
- **Próxima frente pronta p/ `fullstack-dev`:** **US-145** (imposto sobre conta sintética —
  maior risco, ADR-050 Frente B; exige suíte de regressão do `CalcularValorRealizadoUseCase`
  antes) → depois **US-146** (exibir "Custo" vs "Custo c/ Impostos").
- **Suíte de testes:** validação local impossível nesta rede (npm bloqueado por self-signed
  cert). Tudo depende do CI do GitHub Actions.
- **Ambiente:** sem `.env` e **sem `node_modules`**; `npm install` falha com
  `SELF_SIGNED_CERT_IN_CHAIN` (proxy/segurança corporativa). **Ao retomar em outro computador:**
  resolver com `NODE_EXTRA_CA_CERTS` (CA da empresa) ou `NODE_TLS_REJECT_UNAUTHORIZED=0` **antes**
  de `npm install`; depois `npm run prisma:generate`. Migrations continuam sendo escritas à mão e
  aplicadas via SQL Editor do Supabase — **nunca** `prisma migrate dev`/`migrate diff` contra
  produção (incidente 2026-08-14). **PR com migration → aplicar o SQL junto do merge** (lição da
  US-141: senão dá 500 em produção).

## Módulos e frentes

| Frente | Estado |
|---|---|
| **Autenticação / Tela Principal (UC01)** | Encerrado como resolvido (decisão 2026-07-26). Login prod OK. Suíte E2E Playwright existe mas nunca foi executada — não retomar sem pedido explícito. |
| **Módulo de Cadastros (EP118-24)** | US-001 a US-118 concluídas; US-123 a US-139 concluídas. Ver kanban. Fila priorizada quase vazia (só US-127 — cadastro rápido de imposto no rateio, prioridade baixa). |
| **Cargos / Tabela Salarial** | US-131 a US-139 entregues (Tabela Salarial, integração Rubi, Grade Salarial CTCEA persistida, Periculosidade/Insalubridade, Catálogo de Cargo de Mercado). PRs #5–#15 mergeados. |
| **Módulo Orçamentário (`/orcamentario`)** | US-138 (Relatório de Cronograma de Desembolso) entregue. Landing em grade de tiles + telas iniciais de Acompanhamento/Orçado. **2026-09-04: US-142 entregue** (Cronograma por parcelas, layout ANEXO 9, PR #18). **Frente Impostos:** **US-144 entregue** (motor automático, PR #19) + atalho de vínculo Alíquota↔Proposta (PR #20); US-145/146 pendentes — ver seção própria abaixo. |
| **Tela de Viagens (US-109)** | 2026-09-01: rótulos + faixa TOTAL PASSAGENS/DIÁRIAS/GERAL (`4484882`); editar Viagem pela tela (PR #16). 2026-09-02: **US-141 mergeada** (PR #17, `54d5298`) — seletor de município IBGE (catálogo embutido 5571 municípios, `src/infrastructure/integrations/municipios-br/`), `descricao` → "Motivo/Complemento" opcional, snapshot nome/uf + lat/long. Migration `20260902120000_add_municipio_ibge_viagem` **aplicada em produção** (deu 500 até aplicar). ADR-048. **US-140** (transporte por média histórica) 🔴 bloqueada. |
| **Tradução EN-US da documentação** | 19/43 arquivos. Última: US-106, US-107, US-107a (`55cabfa`). Tarefa de menor esforço sempre disponível. |

## Pendências herdadas em aberto (não perder de vista)

1. **Build quebrado em `/orcamentario/acompanhamento`** — `"Missing publishableKey"` do Clerk,
   pré-existente na `master` (confirmado, sem relação com US-139). Provável falta de guard de
   renderização dinâmica. Candidato natural para a próxima sessão.
2. **Segurança:** confirmar se a senha do Postgres de produção (colada em texto puro no chat em
   2026-08-26) foi resetada em Supabase → Project Settings → Database.
3. **Dívida técnica:** 3ª cópia do padrão lock-por-tenant + bulk loader chunked (Plano de Contas
   → CTCEA → Cargo Mercado). Extrair abstração genérica só na 4ª ocorrência.
4. **Gaps de teste não automatizados** da US-139: CT-139-05 (isolamento de tenant end-to-end —
   candidato a E2E Playwright) segue só manual.
5. **`.mcp.json`** (MCP do Supabase) nunca funcionou por restrição de rede local — decidir se
   permanece no repo ou sai.
6. **US-140 (bloqueada)** — Total de Transporte da Viagem por média histórica da conta. O SGO
   não tem realizado histórico por conta multi-ano. Precisa de decisão do usuário + ADR.
7. **Follow-up leve da US-141** (não urgente, sem regressão em produção): (a) não dá para
   **remover** um município já atribuído a uma Viagem (só trocar por outro); (b) o snapshot de
   município é re-resolvido do catálogo a cada edição da Viagem (mesmo sem mexer no destino) —
   irrelevante hoje pois o catálogo é pinado, mas viola o "congelado" do ADR-048; (c)
   `prisma migrate resolve --applied 20260902120000_add_municipio_ibge_viagem` ainda não rodado
   (histórico do Prisma fora de sincronia com o banco). Ver `docs/CONTEXTO_SESSOES.md`.
8. **`prisma migrate resolve --applied` pendente para 3 migrations** (não urgente, mesmo padrão
   do item 7c): `20260902120000_add_municipio_ibge_viagem` (US-141),
   `20260904120000_add_calendario_repasse_proposta` (US-142),
   `20260904160000_add_modo_valor_rateio_imposto_e_categoria_aliquota` (US-144). Todas já
   aplicadas em produção via SQL Editor — só o histórico local do Prisma está desatualizado.

### Frente Impostos (épico) — status por US

Cálculo **automático** de imposto (`base × alíquota%`) sobre contas analíticas **e sintéticas**,
por Proposta × Versão × Conta. Épico + ADR-050 aceito:
`docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md`,
`docs/ADR-050 ...md`, backlog: `docs/BACKLOG - Epico Impostos.pt-BR.md`.

- ✅ **US-144 entregue** (2026-09-04, PR #19) — motor automático, conta analítica. Ver "Onde
  estamos" acima.
- ✅ **Atalho de UX entregue** (2026-09-04, PR #20) — vincular Alíquota↔Proposta direto no
  cadastro/edição da alíquota (fora do épico formal, decisão pontual do usuário).
- 🔜 **US-145** (próxima) — imposto sobre conta sintética (ADR-050 Frente B, `contaId` aceita
  sintética; nova fase de agregação no `CalcularValorRealizadoUseCase`; invariante "sintética =
  soma das filhas" passa a ter exceção com flag `temImpostoDireto`). **Maior risco.**
  **2026-09-05 — pré-requisito cumprido:** rede de regressão escrita (`analista-testes-qa`) —
  `ValorRealizadoService.test.ts` (novo, 9 testes) + bloco novo em
  `CalcularValorRealizadoUseCase.test.ts` (6 testes) congelando a invariante bottom-up atual
  antes da fase C1. Validado contra o `ValorRealizadoService` já refatorado pela US-144: suíte
  isolada 23/23, suíte completa 415/415, `tsc --noEmit` limpo. Commitado e empurrado na branch
  `test/regressao-valor-realizado-pre-us145` (`4e02c46`) —
  https://github.com/fabianojp06/sistemaSgo/pull/new/test/regressao-valor-realizado-pre-us145.
  **PR ainda não aberto** (usuário abre pela UI do GitHub, mesmo padrão de PRs anteriores).
  **US-145 só começa depois desse PR mergeado.**
- 🔜 **US-146** — exibir "Custo" vs "Custo c/ Impostos" (Semáforo, dashboard US-118, guia Valor
  Orçado). Menor risco, depende de US-145 para fazer sentido completo (mas pode ir isolada).
- ⏸️ **US-147** (opcional) — separar tributo de índice de reajuste em modelos distintos; dívida
  técnica registrada, não bloqueia nada.

## Próximo passo combinado

> **Retomando de outro computador:** leia este arquivo + `docs/CONTEXTO_SESSOES.md` (bloco
> "2026-09-05"). **Passo imediato:** abrir e mergear o PR da branch
> `test/regressao-valor-realizado-pre-us145` (rede de regressão, sem código de produção,
> `/code-review` antes do merge por tocar o núcleo financeiro). Só depois disso mergeado,
> começar a **US-145** (imposto sobre conta sintética, `docs/US-145 ...md`, ADR-050 Frente B) —
> maior risco do épico.
>
> Outros candidatos, sem urgência: (a) build de `/orcamentario/acompanhamento` (pendência #1);
> (b) follow-up leve da US-141 (pendência #7); (c) `prisma migrate resolve --applied` das 3
> migrations pendentes (US-141/142/144); (d) tradução EN-US; (e) US-127; (f) desbloquear US-140.
>
> Antes de qualquer `npm install`: resolver o certificado (`NODE_EXTRA_CA_CERTS`).

> **Lição reforçada nesta sessão (2026-09-04, 2 vezes):** migration aditiva mergeada sem ser
> aplicada = **500 em produção** assim que o Server Component consultou as colunas novas (já
> aconteceu nas US-141, US-142 e quase na US-144). Ao mergear qualquer PR com migration, aplicar
> o SQL no Supabase **antes ou imediatamente após** o merge — não depois que o usuário reclama.

## Convenções operacionais rápidas

- **Roteamento por skill obrigatório** (`CLAUDE.md`): toda tarefa via a skill do papel dono.
- **Fluxo Git híbrido por risco:** doc e fix pequeno direto na `master`; migration / regra
  financeira / refatoração estrutural → branch + PR + `/code-review`.
- **`prisma migrate resolve` a partir de rede sem IPv6:** usar Session Pooler
  (`pooler.supabase.com:5432`, usuário `postgres.<project_ref>`), nunca a conexão direta nem o
  Transaction pooler (`:6543`).
- **403 no `git push`:** é autorização do GitHub App (reconectar no claude.ai), não rede.
