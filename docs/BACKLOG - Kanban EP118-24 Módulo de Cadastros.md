# Backlog / Kanban —    EP118/24 Módulo de Ca   dastros

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
| US-105 (UC03.10) | Controle de Concorrência (Optimistic Locking) | Completo — estendido (2026-08-06) de `ValorOrcadoConta`/`RateioImpostoGrade`/`TermoAjuste` para `Meta`/`Viagem`/`ItemPatrimonial`/`EmpregadoHeadcount`/`QtdeEmpregado`; todas as guias analíticas agora cobertas |
| US-106 (UC03.18) | Estrutura Funcional (Organograma) | Completo — `UnidadeFuncional` escopada por Proposta (ADR-015); RN_EST_03 fechada via ADR-026 (2026-08-06): `Cargo`→`UnidadeFuncional` virou N:M com rateio percentual (`CargoAlocacaoPercentual`), somando 100%; RN_EST_01 já era satisfeita por construção; RN_EST_05 (saneamento na importação Rubi) fica para quando existir integração real (mesmo padrão do sincronismo do Plano de Contas) |
| US-107 (UC03.19, blocos A/B) | Cargos e Salários | `Cargo` (ADR-016), vínculo com `UnidadeFuncional` Analítica — originalmente 1:1, migrado para N:M com rateio percentual via ADR-026 (`CargoAlocacaoPercentual`, RN_EST_03, 2026-08-06); `CargoRubiFixtureProvider`; Server Action + migration aplicada |
| US-112 (UC03.14-17) | Manter Meta | `Meta` 1:1 opcional por `VersaoProposta` (ADR-017, revisado); valorGlobal sempre espelhado de SUM(ValorOrcadoConta); migration aplicada |
| US-108 (UC03.24-27, blocos CRUD) | Empregados | `EmpregadoHeadcount` (ADR-018), só Proposta CONSOLIDADA; snapshot congelado de custo/vínculo do Cargo; migration aplicada |
| US-107a (bloco C sem numeração do UC03.19) | Tabela Mestre de Benefícios e Encargos do Cargo | `Cargo.custoTotalCargo` (ADR-019); `diasUteisPadrao` em `ParametroSistema`; `EmpregadoHeadcount` agora herda `custoTotalCargo`; migration aplicada |
| US-108a (UC03.28) | Elegibilidade de Benefícios do Empregado | `EmpregadoBeneficioElegibilidade` (ADR-020), 1 linha por Empregado×Benefício; Vale Transporte adicionado a `Cargo`; `EmpregadoHeadcount.numeroDependentes` deprecated; migration aplicada |
| US-109 (UC03.29-33) | Viagens | Exclusiva de Proposta POR_META, 3 subcontas analíticas, `custoEstimado` calculado (ADR-022); migration aplicada |
| US-110 (UC03.34-36) | Bens, Serviços e Equipamentos | `ItemPatrimonial` (ADR-023), `metaId` opcional (diferente de Viagem); migration aplicada |
| US-113 (UC03.20-23) | Qtde. Empregado | `EmpregadoHeadcount` ganhou `metaId`, `Empregado` liberado p/ POR_META, model `QtdeEmpregado` (ADR-024); migration aplicada |
| US-111 (UC03.13) | Criar Termo de Ajuste entre Contas Analíticas | Desbloqueada via ADR-025; nova tabela `TermoAjuste` com aprovação em 2 etapas (N1 → Gestor Master), débito/crédito atômico em `ValorOrcadoConta`, optimistic locking (padrão US-105); Perfil "Gestor Master" + 2 `Funcionalidade` seedadas; migration aplicada |
| ADR-027 | Todo custo vinculado a uma ContaContabil | Regra de negócio do usuário (2026-08-06): `Cargo.contaId` obrigatória (natureza da despesa, ex: Despesa com Pessoal), `EmpregadoHeadcount.contaId` herdado por snapshot, `RateioImpostoGrade.contaId` obrigatória; migration `NOT NULL` direto (0 registros em produção); `CalcularValorRealizadoUseCase` deixou de ter `parcial=true` fixo |
| US-008a (UC03.02) | Badge do Semáforo Orçamentário | `CalcularValorRealizadoUseCase` soma Viagem/ItemPatrimonial/Empregado/RateioImpostoGrade por conta (agregação recursiva p/ contas sintéticas, mesmo padrão de `ValorOrcadoTotalizerService`); `BadgeSemaforoPanel.tsx` em `/plano-contas/[versaoId]` |
| US-101a | Server Action/UI de Rateio de Impostos | `configurarRateioImposto` Server Action + `RateioImpostoPanel.tsx`; permissão `plano-contas.configurar-rateio-imposto` já seedada |
| US-114 | Gerenciar Propostas (Listar, Cadastrar, Duplicar, Excluir Versão) | Novo módulo de menu "Propostas" (`propostas.visualizar` NAVEGAVEL + `propostas.criar`/`duplicar`/`excluir-versao` CONTEXTUAL, seed aplicado); tela `/propostas` |
| US-115 (UC03.06) | Tela de Proposta com Guias Analíticas | `/propostas/{id}/[[...guia]]` — capa Read-only + 8 abas (Valor Orçado, Semáforo, Meta, Empregados+Qtde.Empregado, Viagens, Bens, Rateio de Impostos, Termo de Ajuste), deep-link por URL; `podeEditarVersao()` centraliza o enforcement client-side de read-only; Cargo/UnidadeFuncional ficam fora (ciclo de vida por Proposta, não por Versão) |
| ADR-032 | Valor Realizado do Semáforo = total do prazo do contrato | Empregado (único custo mensal recorrente) multiplicado pelos meses de sobreposição com o período da Proposta; `calcularMesesSobreposicao` corrigido (contrato de 1 ano contava 13 meses, não 12) |
| US-118 | Guia Valor Orçado vira dashboard-resumo da Proposta | Valor Global + árvore de contas sintéticas expansível vêm do custo REALIZADO (Empregados+Viagens+Bens+Rateio, `ValorRealizadoService`, mesmo cálculo do Semáforo) — não do lançamento manual, que virou guia própria "Lançar Valor Orçado"; nº de Empregados; enfeitado com gráfico de ranking e ícones |
| ADR-038 | AliquotaImpostoParametro ganha contaSinteticaId opcional | Sugestão de UX (default no rateio, US-101), nunca obrigatória; `RateioImpostoGrade.contaId` (analítica, ADR-027) continua sendo o único vínculo de fato obrigatório |
| US-123 (UC03.39) | Manter Alíquotas de Impostos (listagem/filtros/exportação) | Nova rota `/aliquotas-impostos`, `ListarAliquotasImpostoUseCase`; status "Expirada" calculado em runtime (RN_IMP_003); exportação PDF/XLSX via `exportarRelatorio.ts` (ADR-037) |
| US-124 (UC03.40) | Cadastrar Alíquota de Imposto | `CadastrarAliquotaImpostoUseCase`; migration com `ativo`, `dataFimVigencia`, `limiteMinimoPct`/`limiteMaximoPct`, `observacao`, `contaSinteticaId`, `version`; faixa legal de ISS (2-5%) e não-retroatividade validadas [TRAVA O ERRO] |
| US-125 (UC03.41) | Alterar Alíquota de Imposto | `EditarAliquotaImpostoUseCase`; Optimistic Locking via `version` (mesmo padrão de US-105); edição nunca recalcula `RateioImpostoGrade.aliquotaAplicadaSnapshot` de Propostas já Oficializadas (RN_TAX_03/06) |
| US-126 (UC03.42) | Excluir (Soft Delete) Alíquota de Imposto | `ExcluirAliquotaImpostoUseCase`; bloqueado por referência ativa em Proposta RASCUNHO/EM_ELABORACAO (RN_IMP_009), referência só em Proposta Oficializada não bloqueia (snapshot já é imutável) |
| US-116/US-117 (UC03.18/03.19) | Estrutura Funcional (Organograma) + Cargos — UI | Tela `/propostas/{id}/estrutura` (`EstruturaFuncionalPanel.tsx`/`OrganogramaPanel.tsx`/`CargoPanel.tsx`), permissão `propostas.gerenciar-estrutura`; implementadas nos commits `347b7ef`/`830e6bf`/`5e7c3c8` (2026-08-08) — **este item ficou fora do backlog por engano; corrigido em 2026-08-11 ao refinar US-130**, que assumia (incorretamente) que ainda estavam pendentes |
| US-130 (novo, refinado e implementado 2026-08-11) | Importar Estrutura Organizacional entre Propostas | `ImportarEstruturaOrganizacionalUseCase` (ADR-041): cópia congelada, substitui organograma existente na destino, remapeamento de hierarquia em 2 passos (Sintéticas→Analíticas), trava em lote se destino tem Cargo vinculado; botão em `OrganogramaPanel.tsx`; migration (`TipoOperacao.ESTRUTURA_ORGANIZACIONAL_IMPORTADA`); testado manualmente pelo usuário; PR #3 mergeado (`6132be4`) |

---

## 🔜 Próximo da Fila (priorizado)

| Ordem | Item | Por que é o próximo | Esforço estimado |
|---|---|---|---|
| 1 | **US-127 (UC03.01, Fluxo C) — Cadastro Rápido de Imposto no Rateio** | Atalho `[+ Novo Imposto]` inline em `RateioImpostoPanel.tsx`, reaproveitando `CadastrarAliquotaImpostoUseCase` (US-124) — evita sair da tela da Proposta para cadastrar um tributo ainda não existente. Prioridade baixa; bloqueada até o refinamento decidir se o modal usa todos os campos do cadastro completo ou um subconjunto reduzido (ver US doc). | P |

---

## 📋 Backlog Não Refinado (identificados na Minuta, ainda não lidos/avaliados em detalhe)

| UC | Título | Observação |
|---|---|---|

---

## 🔴 Bloqueado

| US/UC | Bloqueio | Condição de desbloqueio |
|---|---|---|
| US-140 — Total de Transporte da Viagem por média histórica da conta (deriva de US-109; pedido do usuário 2026-09-01) | O SGO não tem série histórica de realizado por conta ao longo de vários anos — só `ValorOrcadoConta` (orçado) e o realizado da Proposta corrente. Sem fonte do "quanto foi gasto de verdade na conta X nos últimos anos", não há o que calcular. Ver `docs/US-140 ...md` (bloqueios B1–B7). Confirmado com o usuário: é cálculo automático e **só exibição** — não altera `Viagem.custoEstimado`. | Usuário definir de onde vem o realizado histórico por conta (integração ERP Senior / importação manual / nova entidade) e a janela+método da média; Tech Lead produzir o ADR da fonte de dados. Menor incremento: US-140a (carga de realizado histórico por conta, via planilha) → depois US-140 (exibir a média na tela). |
| UC03.38 — Emitir Pré-Visualização (Demonstrativo de Provisões Trabalhistas) | Investigado em 2026-08-08 (lido o texto completo da Minuta, não só o título): **não é** exportação da árvore de Totalizadores como se supunha antes — é um relatório read-only de provisão/resgate/rendimento de riscos trabalhistas por Termo de Parceria. Depende de (1) entidades `ProvisaoRiscos`/`ProvisaoPassivo`, inexistentes no schema e não mencionadas em nenhum outro UC; (2) seletor de "Termo Aditivo", mesma dependência que já bloqueia UC03.12; (3) o corpo da especificação mistura dois agrupamentos de dados (Empregados vs. Conta Sintética/Analítica) sem relação clara com o tema de provisões trabalhistas — possível corrupção de documento, mesmo padrão já visto em UC03.09. | Esclarecer com o autor da Minuta se o corpo do UC está correto ou corrompido; se correto, modelar `ProvisaoRiscos`/`ProvisaoPassivo` do zero (não deriva de nada existente); em qualquer caso, só desbloqueia depois de Termo Aditivo ter fundação (mesma condição de UC03.12) |

---

## ⚪ Fora de Escopo / Nota de Roadmap (não formalizar como US ainda)

| UC | Título | Por que não vira US agora |
|---|---|---|
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
