# EPICO — Aplicação Automática de Impostos sobre Contas (Analíticas e Sintéticas)

**Módulo SGO:** Orçamentário / Cadastros — Rateio de Impostos (evolução de US-101 / US-101a)
**Épico:** EP48/26 — Módulo Orçamentário
**Origem:** pedido do usuário em 2026-09-02 ("criar módulo impostos e aplicar sobre contas
analíticas e/ou sintéticas"). Na descoberta, esclarecido que **não é um módulo novo** — é a
evolução do Rateio de Impostos, acionável a partir da tela "Alíquotas de Impostos" já existente.
**Formaliza e substitui:** `docs/ADR-039 - Cálculo Composto de Impostos.pt-BR.md` (que estava
"Proposto, aguardando 6 respostas") — as respostas foram dadas nesta descoberta.

---

## Objetivo de negócio

Hoje o Rateio de Impostos é uma **declaração manual**: o orçamentista digita `valorDeclarado` mês
a mês e a alíquota é só registro histórico. O usuário quer que o sistema **calcule o imposto
automaticamente** (`base × alíquota%`), aplicado sobre as contas que ele escolher — **analíticas
ou sintéticas** —, para uma Proposta e Versão específicas.

## Escopo esclarecido na descoberta (AskUserQuestion, 2026-09-02)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | É um menu/módulo novo? | **Não.** A tela "Alíquotas de Impostos" (`/aliquotas-impostos`) continua sendo o catálogo. O que muda é o **rateio** (aplicação do imposto). |
| 2 | Qual escopo da aplicação? | **Por Proposta × Versão × Conta específica** (mantém o grão atual de `RateioImpostoGrade`). O usuário escolhe Proposta → Versão → Conta ao aplicar. |
| 3 | Como o valor é obtido? | **Automático:** `imposto = base × alíquota%`. Substitui a digitação manual. |
| 4 | Base de cálculo (ADR-039 A) | **A1** — custo da conta = Empregados + Viagens + Bens, **excluindo o próprio imposto** (evita referência circular). |
| 5 | Dois impostos na mesma conta (ADR-039 B) | **Não cascateiam.** Cada imposto sobre a mesma base; os valores somam-se (`base × Σ alíquotas`). Sem ordem de aplicação, sem regra de desempate. |
| 6 | Conta sintética (ADR-039 C) | **C1** — o imposto ajusta a **própria sintética**, aplicado depois da agregação bottom-up. A sintética deixa de ser "soma pura das filhas". |
| 7 | Após OFICIALIZADO (ADR-039 D) | **D1** — cálculo automático só em `RASCUNHO`/`EM_ELABORAÇÃO`. Ao oficializar, o valor calculado vira snapshot fixo (RN_TAX_03/06 preservada). |
| 8 | Impacto nos totais (Semáforo, dashboard) | Exibir **"valor sem imposto" e "valor com imposto" lado a lado** — não substituir o valor bruto por "valor com imposto". |

---

## Conflitos e impactos a resolver (para o ADR e o refinamento das US)

| # | Conflito / impacto | Detalhe |
|---|---|---|
| C-IMP-01 | **ADR-027 vs conta sintética** | ADR-027 cravou `RateioImpostoGrade.contaId` **obrigatoriamente analítica**. Aplicar imposto sobre sintética exige relaxar isso (coluna aceita analítica **ou** sintética) + `CalcularValorRealizadoUseCase`/`ValorRealizadoService` tratarem a sintética com rateio direto (C1). Migration + mudança de invariante "sintética = soma das filhas". |
| C-IMP-02 | **`valorDeclarado` manual → cálculo automático** | O que fazer com os `RateioImpostoGrade` já cadastrados manualmente em Propostas ativas? (a) mantêm o valor digitado (grandfathered), só rateios novos calculam; (b) na próxima edição, recalculam; (c) migração recalcula tudo. **Pergunta aberta — techlead-fsg decide no ADR.** |
| C-IMP-03 | **ADR-040 — Premissas e Reajustes** | Premissas/Reajustes (UC04.02 / US-128 / US-129) reaproveitam `RateioImpostoGrade` + `AliquotaImpostoParametro` como **índice de reajuste**. `aliquotaAplicadaSnapshot` já foi ampliado para Decimal(9,4) por isso. Qualquer mudança no significado de `valorDeclarado` (de "valor digitado" para "imposto calculado") tem que não quebrar o motor de reajuste, que usa a mesma tabela com outra semântica. Avaliar se convém **separar as duas coisas** (imposto vs índice de reajuste) em modelos distintos. |
| C-IMP-04 | **Propagação do "valor com imposto"** | Hoje `CalcularValorRealizadoUseCase` (Semáforo, US-008a), a guia Valor Orçado / dashboard (US-118) e o `ValorRealizadoService` leem o valor da conta como **custo bruto**. Com o cálculo automático, passa a existir "sem imposto" e "com imposto". Definir **qual dos dois** dirige o percentual do Semáforo e o Valor Global — e como exibir os dois sem poluir a tela. |
| C-IMP-05 | **Imunidade de Termo de Parceria (RN_PRO_010)** | PIS e COFINS já são bloqueados para `TipoProposta.TERMO_DE_PARCERIA`. O cálculo automático tem que herdar esse bloqueio — não pode gerar imposto de PIS/COFINS para TP nem via cálculo, nem via chamada direta. |
| C-IMP-06 | **Faixa legal do ISS (LC 116/2003)** | `limiteMinimoPct`/`limiteMaximoPct` no catálogo — o cálculo automático deve respeitar (alíquota fora da faixa = erro no cadastro, não no rateio). |
| C-IMP-07 | **Congelamento e recálculo em cascata** | Se a base (custo de Empregados/Viagens/Bens) muda numa Versão RASCUNHO, o imposto tem que recalcular. Definir o gatilho: recálculo síncrono a cada mudança de custo, ou "gerar imposto" sob demanda (botão). |

---

## Decomposição proposta (última US criada: US-143)

| ID | Título | Prioridade | Estimativa | Depende de |
|---|---|---|---|---|
| **US-144** | Motor de cálculo automático de imposto sobre **conta analítica** (`base × alíquota%`, soma de alíquotas, congelamento D1) — substitui a digitação manual | Alta | G | ADR-039 finalizado |
| **US-145** | Aplicar imposto sobre **conta sintética** (C1: ajuste direto na sintética) — schema (contaId aceita sintética), motor, invariante documentada | Alta | M | US-144 |
| **US-146** | Exibir **"valor sem imposto" / "valor com imposto"** no Semáforo (US-008a), na guia Valor Orçado (US-118) e onde mais o valor da conta aparece | Média | M | US-144 |
| **US-147** *(se C-IMP-03 exigir)* | Separar "índice de reajuste" de "alíquota de imposto" em modelos/telas distintos (desfaz o reaproveitamento do ADR-040) | Média | G | US-144 |

### MVP sugerido

**US-144 sozinha** já entrega o valor principal: cálculo automático sobre analíticas, para
Proposta/Versão específicas, com congelamento pós-oficialização. US-145 (sintética) e US-146
(exibir os dois valores) vêm em seguida. US-147 só se o ADR concluir que a fusão imposto/índice
de reajuste do ADR-040 não sobrevive à mudança.

---

## Critérios de saída do épico

- [ ] Imposto calculado automaticamente (`base × Σ alíquotas`) por Proposta × Versão × Conta × competência
- [ ] Base = Empregados + Viagens + Bens da conta, sem o próprio imposto (A1)
- [ ] Conta sintética aceita como alvo, com ajuste direto (C1) e invariante documentada
- [ ] Congelamento pós-OFICIALIZADO preservado (D1 / RN_TAX_03/06)
- [ ] Imunidade de TP (PIS/COFINS) respeitada também no cálculo automático
- [ ] "Valor sem imposto" e "valor com imposto" visíveis onde o valor da conta aparece
- [ ] Motor de reajuste (ADR-040 / US-128/129) não regride
- [ ] Transição dos `RateioImpostoGrade` manuais já existentes definida e executada

---

## Próximo passo

1. ✅ **`techlead-fsg`** — **ADR-050 aceito** (`docs/ADR-050 ...md`, substitui o ADR-039). Fecha
   todas as 7 frentes: modelo A1 (`RateioImpostoGrade` +`modoValor`+`valorBaseSnapshot`, sem
   modelo novo); contaId analítica **ou** sintética (fase pós-agregação, invariante da sintética
   quebra com aviso); base = custo total, 1 linha por conta×alíquota, competência = dataInicio;
   gatilho = **botão "Gerar Impostos"** + aviso de stale; dados existentes = **grandfather total**
   (zero recálculo); Semáforo/Valor Global seguem "com imposto" (como hoje), "sem imposto" é
   número novo ao lado; reajuste (ADR-040) **intacto** + nova coluna `AliquotaImpostoParametro.categoria`
   (TRIBUTO / INDICE_REAJUSTE) resolve a ambiguidade. **US-147 vira dívida técnica opcional.**
2. **`analista-negocios-po`** — escrever US-144, US-145, US-146 com Critérios de Aceite Gherkin.
3. **`fullstack-dev`** — implementar (branch + PR + `/code-review`; migration junto do merge).

### Decomposição atualizada (pós-ADR-050)

| ID | Título | Estimativa | Depende |
|---|---|---|---|
| **US-144** | Migration (`modoValor`, `valorBaseSnapshot`, `categoria`) + motor de cálculo automático sobre conta **analítica** + botão "Gerar Impostos" + aviso de stale + congelamento/imunidade TP | G | ADR-050 ✅ |
| **US-145** | Conta **sintética** como alvo (fase pós-agregação no `ValorRealizadoService`, flag `temImpostoDireto`, nota na tela) | M | US-144 |
| **US-146** | Exibir "Custo" / "Custo c/ Impostos" no dashboard US-118, guia Valor Orçado e badge do Semáforo | M | US-144 |
| US-147 *(opcional)* | Separar tributo de índice de reajuste em modelos/telas distintos | G | — (só se doer) |
