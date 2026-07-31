# Backlog / Kanban — EP118/24 Módulo de Cadastros

**Fonte:** Minuta da Especificação do Módulo de Cadastros V5 (UC03.01 a UC03.38) + US-001 a US-008a (Plano de Contas, especificadas separadamente).
**Elaborado por:** AN/PO, com base no histórico de implementação e nas descobertas de qualidade documental levantadas durante o refinamento (2026-07-31).
**Como ler:** cada coluna é um estágio do kanban. Dentro de cada coluna, os itens já estão em ordem de prioridade (topo = mais prioritário). "UC" refere-se à numeração da Minuta V5; "US" é a história de usuário formalizada e (quando marcada ✅) implementada neste repositório.

---

## ✅ Concluído

| US/UC | Título | Nota |
|---|---|---|
| US-001 a US-006 | Plano de Contas — sincronismo, agrupadores, natureza de conta | Base do módulo, pré-existente a esta sessão |
| US-007 | Configurar Valor Orçado por Conta Analítica e Exercício | `ValorOrcadoConta`; motor de totalização recursivo |
| US-008 | Configurar Semáforo Orçamentário por Conta Analítica | Limiares opcionais em `ContaContabil`, CHECK constraint |
| US-101 (UC03.01/03.03) | Parametrizar Impostos em Proposta (Aba Imposto / Rateio-ISS) | `AliquotaImpostoParametro`, `RateioImpostoGrade`; RN_PRO_010 (imunidade TP) |
| US-102 (UC03.05) | Cadastrar Proposta | Cria Proposta + Versão 1 atomicamente; código auto-gerado `PROP-{ano}-{seq}` |
| US-103 (UC03.07 = UC03.11) | Excluir Versão da Proposta | Soft delete; UC03.07 e UC03.11 são a mesma especificação duplicada na Minuta |
| US-104 (UC03.08) | Duplicar Proposta | Sempre nasce RASCUNHO/Versão 1, mesmo duplicando origem Oficializada |
| US-105 (UC03.10, parcial) | Controle de Concorrência (Optimistic Locking) | Cobre `ValorOrcadoConta`/`RateioImpostoGrade`; resto do UC03.10 seguirá quando novas guias existirem |
| US-106 (UC03.18, parcial) | Estrutura Funcional (Organograma) | `UnidadeFuncional` escopada por Proposta (ADR-015); RN_EST_01/03/05 pendentes até `Cargo` existir |

---

## 🔜 Próximo da Fila (priorizado)

| Ordem | Item | Por que é o próximo | Esforço estimado |
|---|---|---|---|
| 1 | **US-107 — Cargos e Salários (UC03.19)** | Sequência natural de US-106: cargos precisam vincular a uma `UnidadeFuncional` Analítica | G |
| 2 | **US-108 — Empregados (UC03.24-27)** | Maior massa de custo real; desbloqueia parcialmente US-008a (fonte de `valorRealizado`) e completa RN_EST_01/03/05 da US-106 | G |
| 3 | **US-109 — Viagens (UC03.29-33)** | Segunda maior fonte de custo; mesmo padrão de lançamento por conta analítica já validado em US-007/101 | M |
| 4 | **US-110 — Bens, Serviços e Equipamentos (UC03.34-36)** | Completa as fontes de `valorRealizado`; menor volume que Empregados/Viagens | M |
| 5 | **US-008a — Badge do Semáforo (MVP)** | Reavaliar assim que ao menos Empregados estiver no ar — decisão de produto já registrada: não liberar com dado parcial que passe falso senso de segurança | P (depois que a dependência existir) |
| 6 | **Metas (UC03.13-17)** | Estrutura de metas físicas vinculada a Proposta por Categoria=Por Meta; relevante mas não bloqueia nada além de si mesma | M |
| 7 | **Qtde. Empregado (UC03.20-23)** | Consolidação quantitativa — depende de Empregados existir primeiro | P |
| 8 | **Benefícios (UC03.28)** | Sub-módulo de Empregados — depende de Empregados existir | P |

---

## 📋 Backlog Não Refinado (identificados na Minuta, ainda não lidos/avaliados em detalhe)

| UC | Título | Observação |
|---|---|---|
| UC03.13 | Criar Termo de Ajuste | Não lido/avaliado ainda nesta sessão — nome sugere algo distinto de Termo Aditivo (UC03.12), mas pode ter o mesmo tipo de sobreposição/duplicata já visto entre UC03.07 e UC03.11. Avaliar antes de assumir escopo. |
| UC03.38 | Emitir Pré-Visualização | Provavelmente exportação/relatório (PDF/Excel) da árvore de Totalizadores — só faz sentido depois de UC03.02 (Totalizadores/US-008a) estar completo |

---

## 🔴 Bloqueado

| US/UC | Bloqueio | Condição de desbloqueio |
|---|---|---|
| **US-008a — Badge do Semáforo Orçamentário** (UC03.02) | Depende de `valorRealizado`, que vem da agregação dos módulos de custo (Empregados, Viagens, Bens, Rateio já parcialmente coberto) — não de execução orçamentária pública como se pensava inicialmente | Ao menos Empregados (item 1 da fila) implementado — decisão de produto pendente sobre liberar com dado parcial |

---

## ⚪ Fora de Escopo / Nota de Roadmap (não formalizar como US ainda)

| UC | Título | Por que não vira US agora |
|---|---|---|
| UC03.06 | Alterar Proposta | Campos de capa são sempre Read-only nesta tela; toda edição real acontece nas guias analíticas (Metas, Empregados, Bens) que ainda não existem. Não há nada testável para implementar isoladamente — revisitar quando ao menos uma guia existir. |
| UC03.09 | "Criar Nova Versão da Proposta" (título) | **Corpo do texto não corresponde ao título** — o conteúdo real é um workflow de validação/homologação de lançamentos de RH e Viagens (Operador → Validador → Disponibilizado/Rejeitado), não criação de versão. `CriarVersaoPropostaUseCase` (US-007) já resolve "criar versão" por necessidade própria, sem se basear neste UC. O workflow de validação real deste UC depende de Empregados/Viagens existirem — revisitar junto com o item 1/2 da fila, tratando-o como um UC novo de homologação, não como "criar versão". |
| UC03.12 | Criar Termo Aditivo | Wizard de 4 fases (Cronograma de Desembolso, Premissas, Recursos, Pessoal) sobre Proposta Oficializada, com aprovação por um ator "Gestor Master" inexistente no sistema de perfis atual, integração externa `RubiIntegrationController` nunca mencionada em outro lugar, e tabela de custódia `SolicitacaoAditivo` inexistente. Nenhuma das 7 peças que este UC orquestra existe hoje — não é uma US "bloqueada com cenários prontos", é um módulo inteiro sem fundação. Revisitar somente depois que Recursos (tetos financeiros por exercício, mais próximo de `ValorOrcadoConta` já existente) e ao menos Empregados existirem; papel "Gestor Master" exige uma ADR própria de RBAC hierárquico antes de qualquer código. |

---

## Achados de qualidade documental (para não reabrir investigação)

- **UC03.01, UC03.04**: nomenclatura snake_case/Java (`tb_proposta`, `@Version JPA`) — traduzida para as entidades reais do projeto ao refinar US-101/102.
- **UC03.07 vs UC03.11**: duas cópias da mesma especificação de "excluir versão", com títulos diferentes e pequenas variações de texto de erro. Implementado uma vez (US-103); mensagens mantidas como já escritas, não sincronizadas com o texto exato do UC03.11 (decisão do usuário).
- **UC03.09**: título e corpo completamente descolados — o corpo pertence a um UC de homologação de RH/Viagens, não a "criar versão". Não confundir com US-007.
- **UC03.10**: seção "Regras de Negócio" colada por engano com as regras do UC03.09 (RN_VAL_*) — ignoradas; usado apenas Objetivo/Fluxos/RF/RNF, que batem com o título.
- **"CTCEA"**: confirmado como nome da organização/cliente dona do sistema (glossário da Minuta), não um sistema de origem diferente colado por engano.

---

## Convenção de prioridade usada

1. **Desbloqueia outras US** (ex: Empregados desbloqueia US-008a) pesa mais que "está no papel há mais tempo".
2. **Reaproveita padrão já validado** (ex: lançamento por conta analítica, já testado em US-007/101) pesa a favor de ir antes de algo mais novo.
3. **Nenhuma US é escrita antes de sua fundação existir** — daí "Fora de Escopo" para UC03.06, UC03.09 (workflow real) e UC03.12.
