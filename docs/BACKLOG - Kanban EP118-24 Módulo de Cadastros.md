# Backlog do Produto — SGO 2.0

**Atualizado em:** 2026-08-31 (AN/PO), com base no estado real do repositório (US-001 a US-139 mergeadas na `master`) e nas pendências levantadas nas sessões de agosto/2026.
**Escopo:** este arquivo era originalmente o Kanban do EP118/24 (Módulo de Cadastros); a partir de 2026-08-31 passa a ser o **backlog único do produto**, cobrindo também Plano de Contas, Alíquotas de Impostos e o novo Módulo Orçamentário (EP48/26).
**Como ler:** dentro de cada seção, itens em ordem de prioridade (topo = mais prioritário). "US" = história de usuário formalizada; "UC" = numeração da Minuta V5.

## Critério de priorização (score ponderado)

`Score = (legal × 3) + (financeiro × 2) + (bloqueio × 2) + (frequência × 1) − (complexidade × 1)`, cada fator de 1 a 5.
Regras de corte adicionais: **bug que quebra build/produção vem antes de feature nova**; **pendência de segurança vem antes de tudo**; **nenhuma US é escrita antes de sua fundação existir** (daí a seção Bloqueado).

---

## 🔒 Ação imediata — Segurança (fora do fluxo de US)

| # | Item | Por quê | Ação |
|---|---|---|---|
| S1 | **Resetar a senha do Postgres de produção** | A senha foi colada em texto puro no chat em 2026-08-26 (aplicação manual de migration). Exposição de credencial de produção. | Supabase → Project Settings → Database → Reset database password. Depois, atualizar a env var na Vercel se aplicável. **Confirmar se já foi feito.** |

---

## 🐞 Bugs (priorizados — vêm antes de feature nova)

| Ordem | Item | Score | Impacto | Esforço |
|---|---|---|---|---|
| B1 | **Build de produção quebra em `/orcamentario/acompanhamento` — "Missing publishableKey" do Clerk** | 19 | Pré-existente na `master`. Bloqueia o `next build` completo e trava a evolução de todo o Módulo Orçamentário (não dá para validar build com ele vermelho). Provável falta de guard de renderização dinâmica na página nova, diferente das demais páginas autenticadas. | P |

---

## 🔜 Próximo da Fila (features priorizadas)

| Ordem | Item | Score | Por que nesta posição | Esforço |
|---|---|---|---|---|
| 1 | **EP48/26 — Módulo Orçamentário: telas "Acompanhamento" e "Orçado" (regras reais)** | 17 | Hoje só existe **layout mock** (commits `b20b927`/`13dd8a4`): sem Server Action, sem regra de negócio, sem persistência, sem checagem de permissão. É a maior aposta de produto em aberto (alta frequência de uso, impacto financeiro direto na execução orçamentária). **Bloqueado por B1** e precisa de refinamento antes de dev: decompor em US a partir da Minuta do Módulo Orçamentário V2 + planilha MODELO.xlsx (abas ACOMP/ORÇADO). | XG → decompor |
| 2 | **US-127 (UC03.01, Fluxo C) — Cadastro Rápido de Imposto no Rateio** | 10 | Atalho `[+ Novo Imposto]` inline em `RateioImpostoPanel.tsx`, reaproveitando `CadastrarAliquotaImpostoUseCase` (US-124) — evita sair da tela da Proposta para cadastrar um tributo inexistente. Baixo esforço, mas baixo impacto: só conveniência. Refinar se o modal usa todos os campos do cadastro completo ou subconjunto reduzido. | P |

---

## 🧹 Dívida técnica / Qualidade (priorizada)

| Ordem | Item | Por quê | Gatilho / Esforço |
|---|---|---|---|
| D1 | **Automatizar E2E de isolamento multi-tenant (CT-139-05)** | Isolamento de tenant é P0 do sistema (nunca um tenant ver dado de outro), mas hoje só há verificação **manual**. Vale uma rede de segurança automatizada (Playwright) que cubra o caminho crítico. | M — quando houver ambiente E2E com 2 tenants |
| D2 | **Extrair abstração do padrão lock-por-tenant + bulk loader chunked** | 3ª cópia quase idêntica (Plano de Contas → CTCEA → Cargo Mercado). Decisão consciente de **não** abstrair ainda. | Gatilho: 4ª ocorrência do padrão → extrair `TenantSyncLockRepository` / `BulkUpsertLoader<T>` |

---

## ⏸️ Decisões em aberto (não são dev, dependem do usuário/PO)

| # | Item | Contexto | Decisão pendente |
|---|---|---|---|
| A1 | **Ativar em produção as funcionalidades de sincronização** (`cargo-mercado-catalogo.sincronizar` e `grade-salarial-ctcea.sincronizar`) | Ambas semeadas `ativo:false` → botões "Sincronizar" ocultos na tela de Plano de Contas. **Não é mais necessário** para a importação de Cargo funcionar (a busca lê o catálogo embutido desde o PR #15). | Decidir se/quando expor os botões de sincronização; se sim, exige ativar a funcionalidade no banco com a cautela do CLAUDE.md. |

---

## 🔴 Bloqueado (sem fundação — não formalizar como US ainda)

| US/UC | Bloqueio | Condição de desbloqueio |
|---|---|---|
| **UC03.12 — Criar Termo Aditivo** | Wizard de 4 fases (Cronograma, Premissas, Recursos, Pessoal) sobre Proposta Oficializada, ator "Gestor Master", integração `RubiIntegrationController` e tabela `SolicitacaoAditivo` — nenhuma das 7 peças existe hoje. Não é US bloqueada, é um módulo sem fundação. | Ter Recursos (tetos por exercício, próximo de `ValorOrcadoConta`) + Empregados; ADR de RBAC hierárquico para "Gestor Master". |
| **UC03.38 — Demonstrativo de Provisões Trabalhistas** | Relatório read-only de provisão/resgate/rendimento de riscos trabalhistas por Termo de Parceria. Depende de entidades `ProvisaoRiscos`/`ProvisaoPassivo` (inexistentes) e de seletor de "Termo Aditivo" (mesma dependência de UC03.12). Corpo do UC possivelmente corrompido (mistura agrupamentos sem relação com o tema). | Esclarecer com o autor da Minuta se o corpo está correto; se sim, modelar as entidades do zero; depende de Termo Aditivo. |
| **UC03.09 — Workflow de homologação de RH/Viagens** | Título "Criar Nova Versão" não corresponde ao corpo (workflow Operador → Validador → Disponibilizado/Rejeitado). `CriarVersaoPropostaUseCase` (US-119/ADR-033) já resolve "criar versão". O workflow real depende de Empregados/Viagens (já existem) mas nunca foi refinado como UC próprio de homologação. | Refinar como UC novo de homologação (não "criar versão"); priorizar junto do Módulo Orçamentário se o fluxo de aprovação virar requisito. |

---

## ✅ Concluído (resumo por bloco)

> Detalhe histórico de cada US (ADRs, tabelas, migrations) preservado no histórico do git e nas sessões anteriores deste arquivo. Resumo por bloco funcional:

| Bloco | US | Estado |
|---|---|---|
| **Plano de Contas** | US-001 a US-006 (sincronismo, agrupadores, natureza), US-007 (valor orçado), US-008/008a (semáforo + badge) | ✅ |
| **Propostas e Versões** | US-102 (cadastrar), US-103 (excluir versão), US-104 (duplicar), US-105 (optimistic locking, todas as guias), US-114 (gerenciar), US-115 (tela com guias), US-118 (dashboard-resumo), US-119 (criar versão/ADR-033), US-120 (restaurar/ADR-034) | ✅ |
| **Estrutura Funcional e Cargos** | US-106 (organograma), US-107/107a (cargos, benefícios), US-116/117 (telas), US-130 (importar estrutura entre propostas), US-131/132/133 (tabela salarial, integração Rubi, fonte ativa), US-134 (snapshot de oficialização), US-135 (reverter vínculo 1-1), US-136 (periculosidade/insalubridade), US-137 (catálogo CTCEA), US-139 (catálogo Cargo de Mercado + importação) | ✅ |
| **Empregados / Metas / Viagens / Bens** | US-108/108a (empregados, elegibilidade), US-112 (metas), US-113 (qtde. empregado), US-109 (viagens), US-110 (bens) | ✅ |
| **Impostos** | US-101/101a (parametrizar/rateio), US-123 a US-126 (manter/cadastrar/alterar/excluir alíquotas), US-128 (relatório premissas/reajuste), US-129 (simular/aplicar reajuste em lote) | ✅ |
| **Termo de Ajuste** | US-111 (criar termo de ajuste, aprovação 2 etapas) | ✅ |
| **Módulo Orçamentário** | US-138 (Relatório de Cronograma de Desembolso) | ✅ (demais telas do módulo ainda mock — ver fila) |

---

## Achados de qualidade documental (para não reabrir investigação)

- **UC03.07 vs UC03.11**: duas cópias da mesma spec de "excluir versão". Implementado uma vez (US-103).
- **UC03.09**: título e corpo descolados — corpo pertence a um UC de homologação, não a "criar versão".
- **UC03.10**: seção "Regras de Negócio" colada por engano com as do UC03.09 (RN_VAL_*) — ignoradas.
- **UC03.38**: corpo possivelmente corrompido (mistura Empregados vs. Conta Sintética/Analítica sem relação com provisões).
- **"CTCEA"**: nome da organização/cliente dona do sistema (glossário da Minuta), não um sistema de origem.
