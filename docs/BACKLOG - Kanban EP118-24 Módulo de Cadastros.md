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

---

## 🔜 Próximo da Fila (priorizado)

| Ordem | Item | Por que é o próximo | Esforço estimado |
|---|---|---|---|
| 1 | **US-008a — Badge do Semáforo (MVP)** | Empregados, Viagens e Bens já no ar — decisão de produto ainda pendente sobre liberar com Rateio de Impostos parcialmente coberto | P (aguarda decisão de produto) |

---

## 📋 Backlog Não Refinado (identificados na Minuta, ainda não lidos/avaliados em detalhe)

| UC | Título | Observação |
|---|---|---|
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
