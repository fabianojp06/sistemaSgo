## ADR-040: Premissas / Aplicações de Reajustes (UC04.02) reaproveitando o schema de Rateio de Impostos

**Status**: Aceito
**Data**: 2026-08-10
**Módulo SGO**: Orçamentário — Premissas/Reajustes (US-128, US-129)
**Contexto**: usuário decidiu (2026-08-10) que a entidade "Formula" descrita no UC04.02 não é nova — é `AliquotaImpostoParametro` + `RateioImpostoGrade`, já implementadas para Rateio de Impostos (US-101/US-123-127, ADR-027/ADR-038). Essa decisão elimina o maior bloqueador de US-128/US-129 (schema novo), mas abre 3 questões de desenho que precisam de resposta antes de codificar: (1) como projetar o histórico de `AliquotaImpostoParametro` (1 % por janela de vigência) na grade "percentual por ano de execução" que o relatório pede; (2) como um reajuste retroativo (RN_PR_002) recalcula "Planejado/Projeção" sem tocar o "Realizado", dado que `RateioImpostoGrade` já é tratado como snapshot imutável por competência (RN_TAX_03/06, ver comentário em `EditarAliquotaImpostoUseCase.ts:32`); (3) `AliquotaImpostoParametro.aliquotaPct` é `Decimal(5,2)` (2 casas), mas RNF_PR_004 pede 4 casas de precisão para índices de reajuste tipo IPCA.

### Decisão 1 — Grade ano-a-ano (US-128)

**Problema real:** não existe "histórico encadeado" de reajustes no schema — cada `AliquotaImpostoParametro` é um registro independente com sua própria janela `dataInicioVigencia`/`dataFimVigencia`. Herdar automaticamente um índice para o mês seguinte à sua vigência exigiria inventar uma noção de "linhagem" que não existe hoje e que o usuário não pediu.

**Opções consideradas:**

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| A — Projeção pura por cobertura de vigência (sem herança) | Zero schema novo; usa exatamente o dado que já existe; comportamento previsível e auditável | Mês sem nenhum `AliquotaImpostoParametro` cobrindo aquela janela fica em branco ("—"), mesmo que intuitivamente devesse "continuar" o índice anterior | Alta — é só uma query de relatório |
| B — Campo de "linhagem"/sucessor entre AliquotaImpostoParametro | Resolveria a herança automática entre reajustes sucessivos | Schema novo, migration, e ninguém pediu essa semântica — risco de inventar regra de negócio não validada | Baixa — mexe em domínio de tributos já em produção |

**Decisão: Opção A.** Algoritmo do relatório, por conta analítica e por mês da vigência do Termo de Parceria:
1. Buscar, entre os `AliquotaImpostoParametro` já vinculados àquela conta via `RateioImpostoGrade.aliquotaParametroId` (histórico completo, não só o vigente), aquele cuja janela `[dataInicioVigencia, dataFimVigencia ?? +∞)` cobre o mês.
2. Se o mês é `<=` mês corrente do servidor → renderizar a tag **"Realizado"**, sempre — independente de ter achado parâmetro (RN0225 não pede o valor histórico na célula, só a tag).
3. Se o mês é `>` mês corrente → renderizar `aliquotaPct` do parâmetro encontrado no passo 1; se nenhum parâmetro cobre esse mês futuro, renderizar "—" (sem projeção implícita).
4. Segregação em blocos (RN0239) continua vindo direto de `tipoIncidencia`.

**Maior risco:** meses futuros sem parâmetro cadastrado aparecem "vazios" mesmo que o usuário espere ver a continuação do índice atual. Aceito conscientemente — é comportamento correto e honesto (não inventa dado), e é reversível: se o usuário validar em homologação que quer herança automática, isso vira uma Opção B futura sem quebrar o que já roda.

### Decisão 2 — Retroatividade sem tocar o Realizado (US-129)

**Problema real:** `RateioImpostoGrade` já é snapshot imutável por competência para Propostas Oficializadas (invariante existente, testada). RN_PR_002 pede recalcular "Planejado/Projeção" de meses passados sem tocar o "Realizado" — mexer diretamente em linhas históricas de `RateioImpostoGrade` quebraria essa invariante já consolidada no projeto.

**Opções consideradas:**

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| A — Nova linha de `RateioImpostoGrade` na competência do mês atual, com o valor acumulado da diferença | Não toca nenhuma linha histórica — preserva a invariante de imutabilidade já testada em produção; auditável (é só mais uma linha, com seu próprio log delta); zero schema novo | Consulta que soma "quanto foi realmente pago numa competência retroativa" precisa somar a linha original + a linha de ajuste, se alguém quiser esse dado por mês exato (não é um requisito hoje) | Alta |
| B — `UPDATE` das linhas de `RateioImpostoGrade` das competências passadas afetadas | Cada competência reflete seu valor "correto" isoladamente | Quebra RN_TAX_03/06 (imutabilidade pós-Oficializada) já garantida e testada no domínio de Rateio de Impostos — mudar essa regra agora tem raio de impacto sobre US-101/123-127, não só sobre Premissas | Baixa — reverter uma mudança de invariante testada é caro |

**Decisão: Opção A.** Reaproveita o mesmo padrão já usado no projeto (snapshot append-only). Ao confirmar um reajuste retroativo:
1. Para os meses futuros dentro da nova vigência: cria/atualiza `RateioImpostoGrade` normalmente, competência a competência (fluxo já existente de `ConfigurarRateioImpostoUseCase`).
2. Para os meses passados dentro do range retroativo: **não mexe** nas linhas dessas competências. Cria **uma única linha nova** de `RateioImpostoGrade`, na competência do mês atual, com `valorDeclarado` = soma das diferenças (`novo % − % anterior aplicado`) × base de cada mês retroativo afetado. Não precisa de campo novo em `RateioImpostoGrade` para marcar "é um ajuste" — o payload JSON do log delta (RN_PR_004, já obrigatório) já registra quais meses/contas geraram essa linha, o que basta para auditoria.
3. `ValorRealizadoService` nunca lê essa linha de ajuste como "realizado" de competência passada — ela é datada no mês atual, então já entra naturalmente no cálculo do mês em que foi criada, sem exigir nenhuma mudança no serviço.

**Maior risco:** se o time de negócio esperar ver "quanto foi o reajuste retroativo" quebrado mês a mês (não só o total acumulado no mês atual), esta opção não entrega isso sem uma consulta ao log delta. Aceito porque o texto de RN_PR_002 já fala em "registrar a diferença **acumulada** como ajuste de competência no mês atual" — a opção A implementa a regra exatamente como está escrita, não uma interpretação mais forte.

### Decisão 3 — Precisão de `aliquotaPct` (US-129 / RNF_PR_004)

**Opções consideradas:**

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| A — Ampliar `AliquotaImpostoParametro.aliquotaPct` de `Decimal(5,2)` para `Decimal(9,4)` | Migration segura (`ALTER COLUMN` de scale 2→4 nunca perde dado, só completa com zeros); mantém 1 único campo/fonte de verdade, coerente com a decisão do usuário de reaproveitar a mesma tela; cobre tributo (2 casas) e índice de reajuste (4 casas) com o mesmo tipo | Precisa varrer a UI de Alíquotas de Impostos por formatação hardcoded em 2 casas (achado: `AliquotaImpostoListPanel.tsx:328`, `Number(a.aliquotaPct).toFixed(2)`) e ajustar para exibir até 4 casas sem zeros à direita desnecessários | Alta — é ampliação de precisão, não redução |
| B — Campo novo `indiceReajustePct Decimal(9,4)` separado, mantendo `aliquotaPct` como está | Isola o domínio de tributo do domínio de índice de reajuste, sem tocar UI existente | Contradiz a decisão do usuário de reaproveitar a mesma tela/entidade — cria 2 campos de "percentual" na mesma linha, ambíguo sobre qual usar quando | Alta, mas gera confusão de modelo permanente |

**Decisão: Opção A.** Ampliar `aliquotaPct` para `Decimal(9,4)`. Migration de expansão de precisão é segura e não exige backfill. Ajuste necessário, fora do escopo de schema: `AliquotaImpostoListPanel.tsx:328` passa a formatar dinamicamente (2 casas quando as casas 3-4 forem zero, 4 casas quando não forem) — pequeno ajuste de UI, não é objeto deste ADR, fica anotado como tarefa do Full Stack Dev ao implementar US-129.

**Maior risco:** nenhum dado é perdido, mas qualquer teste existente que compare `aliquotaPct` como string literal de 2 casas (ex.: `expect(...).toBe('9.25')`, visto em `ConfigurarRateioImpostoUseCase.test.ts:123`) pode precisar de ajuste se o Prisma passar a serializar com 4 casas por padrão — validar ao rodar a suíte após a migration.

### Consequências

- ✅ US-128 e US-129 seguem sem entidade nova de schema — só 1 migration pequena (ampliar `aliquotaPct`).
- ✅ Preserva a invariante de imutabilidade de `RateioImpostoGrade` já testada, em vez de abrir exceção para retroatividade.
- ⚠️ Ajuste de UI em `AliquotaImpostoListPanel.tsx` (formatação de 2→4 casas) é obrigatório antes de considerar US-129 pronta, mesmo não sendo o foco dela.
- ⚠️ Opção A da Decisão 1 não resolve "herança automática" de índice — se validado como necessário depois, é uma US nova, não um retrabalho desta.

### Revisão Recomendada

Revisar a Decisão 1 (sem herança automática) se, em homologação, o usuário/QA reportar que a grade ano-a-ano fica "cheia de buracos" em contratos longos com poucos reajustes negociados — sinal de que a Opção B (linhagem) vale o custo.
