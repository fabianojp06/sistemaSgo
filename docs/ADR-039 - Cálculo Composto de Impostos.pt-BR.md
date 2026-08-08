# ADR-039 — Cálculo Automático e Composto de Impostos sobre Conta Contábil

**Status:** Proposto (aguardando 6 respostas do usuário)
**Data:** 2026-08-08
**Módulo SGO:** Cadastros — Rateio de Impostos (evolução de US-101 / ADR-027 / ADR-038)
**Artefato:** https://claude.ai/code/artifact/d9fc8dc3-b182-4866-881c-7768d88d0e71

## Contexto

O modelo atual de `RateioImpostoGrade` é uma **declaração manual**: o usuário digita `valorDeclarado`
mês a mês, e `aliquotaAplicadaSnapshot` é só um registro histórico — nunca participa de cálculo.
`CalcularValorRealizadoUseCase` soma esse valor junto com Empregados/Viagens/Bens como mais uma fonte
de custo da conta.

O requisito novo muda a natureza da peça: o sistema passa a **calcular automaticamente**
`valor_com_imposto = valor_base × (1 + aliquotaPct/100)`, aplicado na data de vigência do imposto, com
**composição**: se dois impostos incidem na mesma conta, o segundo aplica sobre o resultado do primeiro
(juros compostos), e a recorrência anual do mesmo imposto acumula.

Isso não é um ajuste incremental — é uma mudança de papel do componente, de "registro" para "motor de
cálculo". Por isso a decisão foi dividida em quatro frentes independentes, cada uma com opções reais e
um risco explícito.

---

## Decisão A — De onde vem o "valor base"

**Problema:** hoje o valor da conta = soma de Empregados + Viagens + Bens + Rateio de Impostos. Se o
Rateio passa a ser "% sobre o valor da conta", e o valor da conta inclui o próprio Rateio, isso é uma
referência circular.

| Opção | Descrição | Reversibilidade |
|---|---|---|
| **A1** | Base = soma das outras 3 fontes (Empregados+Viagens+Bens), excluindo Rateio. O imposto aplica sobre isso, e o resultado (base + imposto) passa a ser o valor gravado da conta. | Média |
| **A2** | Base = campo novo, populado por outro fluxo — desacoplado das fontes de custo atuais. | Baixa |

**Risco em A1:** redefine o que "valor da conta" significa — hoje é "quanto vou gastar", passaria a ser
"quanto vou gastar já com impostos". Propaga para o Semáforo Orçamentário, o dashboard da guia Valor
Orçado (US-118) e o badge (US-008a) — todos leem esse número hoje assumindo que é custo bruto.

---

## Decisão B — Ordem de composição e acumulação anual

**Problema:** dois impostos com a mesma data de vigência — qual aplica primeiro? E "acumula anualmente"
significa cadeia permanente ou exercício isolado?

| Opção | Descrição |
|---|---|
| **B1** | Acumulação em cadeia, permanente — o reajuste de cada ano herda o resultado acumulado dos anos anteriores (comportamento real de dissídio salarial). |
| **B2** | Cada exercício isolado — o imposto aplica sobre a base daquele ano específico, sem herdar reajustes anteriores. |

**Ainda sem resposta:** desempate de data igual entre dois impostos diferentes — ordem de cadastro,
ordem alfabética, ou prioridade manual? Juros compostos não são comutativos na presença de
limites/tetos intermediários.

---

## Decisão C — Conta sintética como alvo do imposto

**Problema:** `CalcularValorRealizadoUseCase` agrega bottom-up (soma as folhas, propaga pra cima). Se um
imposto incide direto numa conta sintética, ela ganha duas fontes de valor ao mesmo tempo, quebrando a
invariante "sintética = soma das filhas".

| Opção | Descrição | Reversibilidade |
|---|---|---|
| **C1** | Imposto aplica após a agregação bottom-up — ajuste próprio da sintética. | Média |
| **C2** | Imposto distribui proporcionalmente às filhas — sintética continua soma pura. | Alta |

**Recomendação do Tech Lead:** C1 é mais simples e mais alinhada ao pedido, mas exige documentar que
"sintética com Rateio direto" é um caso especial — senão vira relato de bug ("os totais não batem")
daqui a alguns meses.

---

## Decisão D — Recálculo em cascata e Propostas Oficializadas

**Problema:** o congelamento atual (RN_TAX_03/06) é regra forte e testada — depois de Oficializada, nada
de fiscal recalcula. O requisito de cálculo "automático" tensiona contra essa garantia.

| Opção | Descrição | Reversibilidade |
|---|---|---|
| **D1** | Automático só em RASCUNHO/EM_ELABORACAO. RN_TAX_03/06 permanece intacta; ao oficializar, o valor calculado vira snapshot definitivo. | Alta |
| **D2** | Recalcula mesmo pós-Oficializada — um novo imposto atualizaria Propostas já fechadas. | Baixíssima |

**Posição do Tech Lead (não só trade-off):** D2 é perigoso. "Oficializada" existe para dar certeza de
que aquele número não muda mais. Se valores futuros precisam refletir em Propostas já fechadas, isso não
é recalcular a antiga — é criar uma revisão/aditivo novo, que esbarra na mesma lacuna do Termo Aditivo
(UC03.12) já bloqueada no backlog. **Recomendo D1.**

---

## Perguntas para fechar antes de codificar

Nenhuma US será formalizada nem código escrito até estas seis respostas — o risco financeiro de
adivinhar errado aqui é real.

1. **Confirma a Decisão A1?** O valor base do imposto é a soma de Empregados + Viagens + Bens da conta,
   excluindo o próprio Rateio de Impostos.
2. **Confirma a Decisão B1?** A acumulação anual é permanente e em cadeia — o dissídio de cada ano soma
   sobre o resultado acumulado dos anos anteriores, não por exercício isolado.
3. **Desempate de data igual:** quando dois impostos diferentes têm a mesma data de início de vigência,
   qual aplica primeiro — ordem de cadastro, ordem alfabética, ou uma prioridade definida manualmente?
4. **Confirma a Decisão C1?** O imposto sobre conta sintética ajusta diretamente o valor dela (deixando
   de ser soma pura das filhas), em vez de C2 (rateio proporcional de volta para as filhas analíticas).
5. **Confirma a Decisão D1?** O congelamento em Proposta Oficializada continua valendo — o cálculo
   automático só se aplica em RASCUNHO/EM_ELABORACAO.
6. **O que fazer com os dados já existentes?** `RateioImpostoGrade.valorDeclarado` já cadastrado
   manualmente em Propostas ativas — passa a valer como "valor base" retroativamente, ou permanece como
   está e só rateios novos usam o cálculo automático?
