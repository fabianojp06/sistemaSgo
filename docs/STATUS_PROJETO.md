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

**Última atualização:** 2026-09-02 (US-141 mergeada)

---

## Onde estamos

- **Branch:** `master` sincronizada com `origin/master` (`54d5298`, merge do PR #17). Sem branch de feature ativa.
- **Suíte de testes:** validação local impossível nesta rede (npm bloqueado por self-signed
  cert). As mudanças da tela de Viagens (PRs #16, #17) passaram só pelo CI do GitHub Actions.
- **Ambiente atual:** container efêmero sem `.env` e **sem `node_modules`**; `npm install` falha
  com `SELF_SIGNED_CERT_IN_CHAIN` (mesma restrição de rede do MCP do Supabase). Não dá para rodar
  `tsc`/`eslint`/`vitest`/`next` aqui — depende do CI. Migrations são escritas à mão e aplicadas
  pelo usuário via SQL Editor do Supabase — **nunca** `prisma migrate dev`/`migrate diff` contra
  produção (ver incidente 2026-08-14 no `CLAUDE.md`).

## Módulos e frentes

| Frente | Estado |
|---|---|
| **Autenticação / Tela Principal (UC01)** | Encerrado como resolvido (decisão 2026-07-26). Login prod OK. Suíte E2E Playwright existe mas nunca foi executada — não retomar sem pedido explícito. |
| **Módulo de Cadastros (EP118-24)** | US-001 a US-118 concluídas; US-123 a US-139 concluídas. Ver kanban. Fila priorizada quase vazia (só US-127 — cadastro rápido de imposto no rateio, prioridade baixa). |
| **Cargos / Tabela Salarial** | US-131 a US-139 entregues (Tabela Salarial, integração Rubi, Grade Salarial CTCEA persistida, Periculosidade/Insalubridade, Catálogo de Cargo de Mercado). PRs #5–#15 mergeados. |
| **Módulo Orçamentário (`/orcamentario`)** | Frente nova. US-138 (Relatório de Cronograma de Desembolso) entregue. Landing em grade de tiles + telas iniciais de Acompanhamento e Orçado (`b20b927`/`13dd8a4`). |
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

### Frente nova — Impostos (2026-09-02)

Cálculo **automático** de imposto (`base × alíquota%`) sobre contas analíticas **e sintéticas**,
por Proposta × Versão × Conta. Descoberta + épico: `docs/EPICO - Aplicacao Automatica de Impostos
sobre Contas.pt-BR.md`. **ADR-050 aceito** (substitui o ADR-039): modelo A1 (`RateioImpostoGrade`
+`modoValor`+`valorBaseSnapshot`, sem modelo novo), contaId analítica ou sintética, base = custo
total (1 linha/conta×alíquota, competência = dataInicio), gatilho = **botão "Gerar Impostos"**
(não síncrono) + aviso de stale, dados existentes = grandfather (zero recálculo), Semáforo/Valor
Global seguem "com imposto" + "sem imposto" novo ao lado, reajuste (ADR-040) intacto +
`AliquotaImpostoParametro.categoria` (TRIBUTO/INDICE_REAJUSTE). **US-144/145/146 escritas** +
**backlog do épico** priorizado: `docs/BACKLOG - Epico Impostos.pt-BR.md`. Ordem: **US-144**
(motor, analítica — MVP, pronta p/ `fullstack-dev`) → **US-145** (sintética, C1 — maior risco,
exige suíte de regressão do `CalcularValorRealizadoUseCase` antes) → **US-146** (exibir "Custo"/
"Custo c/ Impostos" — menor risco). US-147 (separar tributo de índice de reajuste) = opcional.

## Próximo passo combinado

**US-142** (Cronograma de Desembolso por parcelas, layout **ANEXO 9** — PDF real do TP
PAME-RJ/CTCEA/2025) — **refinada + ADR-049 aceito** (2026-09-02). `docs/US-142 ...md` +
`docs/ADR-049 ...md`. Decisões: calendário configurável na Proposta
(`parcelasPorAno`/`mesInicialRepasse`, 2 campos + migration aditiva); parcela de entrada em
`dataInicio` (funde com o 1º repasse → "Etapas 1 e 2" quando coincidem); período **antecipado**
(Tk paga o bloco que começa na data dela); sub-linha "Evento Tn Meta 01"; coluna 7 = "Valor
Acumulado por Ano do TP" (só nas linhas de ano); camada `agregarEmParcelas` sobre o motor mensal
preservado; tela read-only + filtro de período. CD-06 (Viagem sem data) → US-143 futura.
**Pronta para o `fullstack-dev`** (branch + PR + `/code-review`; migration aplicada junto do merge).

Outros candidatos: (a) build de `/orcamentario/acompanhamento` (pendência #1); (b) follow-up
leve da US-141 (pendência #7); (c) tradução EN-US; (d) US-127; (e) desbloquear US-140.

> **Lição desta sessão (2026-09-02):** migration aditiva mergeada sem ser aplicada = **500 em
> produção** assim que o Server Component consultou as colunas novas. Ao mergear qualquer PR com
> migration, aplicar o SQL no Supabase **antes ou imediatamente após** o merge — não depois que o
> usuário reclama.

## Convenções operacionais rápidas

- **Roteamento por skill obrigatório** (`CLAUDE.md`): toda tarefa via a skill do papel dono.
- **Fluxo Git híbrido por risco:** doc e fix pequeno direto na `master`; migration / regra
  financeira / refatoração estrutural → branch + PR + `/code-review`.
- **`prisma migrate resolve` a partir de rede sem IPv6:** usar Session Pooler
  (`pooler.supabase.com:5432`, usuário `postgres.<project_ref>`), nunca a conexão direta nem o
  Transaction pooler (`:6543`).
- **403 no `git push`:** é autorização do GitHub App (reconectar no claude.ai), não rede.
