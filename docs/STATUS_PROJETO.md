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

**Última atualização:** 2026-09-01

---

## Onde estamos

- **Branch:** `master` limpa. Sem branch de feature ativa.
- **Suíte de testes:** 385/385 passando (`npx vitest run`) na última verificação (2026-08-31).
  `tsc --noEmit` e `eslint` limpos.
- **Ambiente atual:** container efêmero sem `.env` (sem `DATABASE_URL`). Migrations são escritas
  à mão e aplicadas pelo usuário via SQL Editor do Supabase — **nunca** `prisma migrate dev`/
  `migrate diff` contra produção (ver incidente 2026-08-14 no `CLAUDE.md`).

## Módulos e frentes

| Frente | Estado |
|---|---|
| **Autenticação / Tela Principal (UC01)** | Encerrado como resolvido (decisão 2026-07-26). Login prod OK. Suíte E2E Playwright existe mas nunca foi executada — não retomar sem pedido explícito. |
| **Módulo de Cadastros (EP118-24)** | US-001 a US-118 concluídas; US-123 a US-139 concluídas. Ver kanban. Fila priorizada quase vazia (só US-127 — cadastro rápido de imposto no rateio, prioridade baixa). |
| **Cargos / Tabela Salarial** | US-131 a US-139 entregues (Tabela Salarial, integração Rubi, Grade Salarial CTCEA persistida, Periculosidade/Insalubridade, Catálogo de Cargo de Mercado). PRs #5–#15 mergeados. |
| **Módulo Orçamentário (`/orcamentario`)** | Frente nova. US-138 (Relatório de Cronograma de Desembolso) entregue. Landing em grade de tiles + telas iniciais de Acompanhamento e Orçado (`b20b927`/`13dd8a4`). |
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
6. **US-140 (bloqueada)** — Total de Transporte da Viagem por média histórica da conta (pedido
   de 2026-09-01). Bloqueada: o SGO não tem realizado histórico por conta multi-ano. Precisa de
   decisão do usuário (fonte do dado) + ADR. Ver `docs/US-140 ...md` e o kanban.

## Próximo passo combinado

Nenhum item priorizado forte na fila. Candidatos: (a) corrigir o build de
`/orcamentario/acompanhamento` (pendência #1); (b) continuar tradução EN-US; (c) avançar o
Módulo Orçamentário; (d) US-127 (baixa prioridade).

## Convenções operacionais rápidas

- **Roteamento por skill obrigatório** (`CLAUDE.md`): toda tarefa via a skill do papel dono.
- **Fluxo Git híbrido por risco:** doc e fix pequeno direto na `master`; migration / regra
  financeira / refatoração estrutural → branch + PR + `/code-review`.
- **`prisma migrate resolve` a partir de rede sem IPv6:** usar Session Pooler
  (`pooler.supabase.com:5432`, usuário `postgres.<project_ref>`), nunca a conexão direta nem o
  Transaction pooler (`:6543`).
- **403 no `git push`:** é autorização do GitHub App (reconectar no claude.ai), não rede.
