# US-145 — Imposto sobre Conta Sintética

**Módulo:** Orçamentário / Cadastros — Rateio de Impostos
**Épico:** Aplicação Automática de Impostos sobre Contas
**Prioridade:** Alta
**Estimativa:** M
**Status:** 🔜 Depende de US-144 (motor sobre analítica) entregue
**ADR:** ADR-050 (Frente B)

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** poder aplicar um imposto **diretamente sobre uma conta sintética** (que consolida
várias analíticas), e não só sobre as folhas,
**Para** representar tributos que incidem sobre um grupo de despesa como um todo, sem ter que
lançar linha a linha em cada conta analítica filha.

---

## Contexto e Regras de Negócio

Hoje `RateioImpostoGrade.contaId` é **obrigatoriamente analítica** (ADR-027,
`ContaRateioImpostoNaoAnaliticaError`). O usuário quer poder escolher também uma **sintética**.
O `CalcularValorRealizadoUseCase` agrega **bottom-up**: soma o custo das analíticas e propaga
para as sintéticas, assumindo a invariante **"sintética = soma pura das filhas"**.

### RN_TAX_14 — Conta sintética como alvo do imposto (ADR-050 Frente B / C1)

- `RateioImpostoGrade.contaId` passa a aceitar conta **analítica ou sintética** (existente, ativa,
  do tenant). O erro `ContaRateioImpostoNaoAnaliticaError` é substituído por
  `ContaRateioImpostoInvalidaError` ("conta não encontrada ou inativa").
- No cálculo do realizado, **após** a agregação bottom-up (analíticas → sintéticas), o sistema
  soma as linhas `RateioImpostoGrade` cuja `contaId` é **sintética** **diretamente no valor
  agregado** daquela sintética (decisão C1 — "ajuste próprio da sintética").
- **Consequência aceita:** para uma sintética com imposto direto, o total **deixa de ser a soma
  pura das analíticas filhas** — passa a ser `Σ filhas + impostos diretos sobre ela`.

### RN_TAX_15 — Base do imposto sobre sintética (US-144, quando `categoria=TRIBUTO` e cálculo automático)

Quando o par `(alíquota TRIBUTO × conta sintética)` entra no "Gerar Impostos da Versão":
- **Base** = custo bruto agregado da sintética = soma do custo bruto (Empregado+Viagem+Bem) de
  **todas as suas analíticas descendentes**, excluindo qualquer `RateioImpostoGrade`.
- `imposto = base × alíquota%`, gravado como 1 linha `CALCULADO` com `contaId` = a sintética.

### RN_TAX_16 — Sinalização da quebra de invariante

Quando uma conta (sintética) tem ao menos uma linha `RateioImpostoGrade` ativa com `contaId` =
ela própria:
- O `BadgeSemaforoConta` daquela conta ganha o flag **`temImpostoDireto = true`**.
- A tela / o dashboard exibem, ao lado do valor da conta, a nota:
  **"Esta conta tem imposto aplicado diretamente sobre ela — o total não é a soma pura das
  contas analíticas."**
- Isto é **distinto** do flag `parcial` (que sinaliza cobertura incompleta de fontes de custo,
  US-008a) — os dois podem coexistir e têm significados diferentes.

### Herança das regras da US-144

Congelamento pós-OFICIALIZADO (RN_TAX_03/06), imunidade de TP (RN_PRO_010), sem cascata
(RN_TAX_11), só `categoria = TRIBUTO` — **todas se aplicam igualmente** ao imposto sobre
sintética.

---

## Critérios de Aceite

**Cenário 1 — Aplicar imposto automático sobre conta sintética**
```gherkin
Dado que a conta sintética "3.1 - Custeio" consolida as analíticas "3.1.01 - Pessoal" (R$ 200.000,00) e "3.1.02 - Serviços" (R$ 100.000,00)
E incide sobre "3.1 - Custeio" a alíquota "ISS" (categoria TRIBUTO, 3,00%)
E a Versão está em RASCUNHO
Quando o usuário aciona [Gerar Impostos da Versão]
Então é criada 1 linha RateioImpostoGrade com contaId = "3.1 - Custeio" (sintética), modoValor = CALCULADO, valorBaseSnapshot = 300.000,00 e valorDeclarado = 9.000,00
E o valor realizado de "3.1 - Custeio" passa a ser R$ 309.000,00 (soma das filhas + o imposto direto)
E o BadgeSemaforoConta de "3.1 - Custeio" tem temImpostoDireto = true
E a tela exibe a nota "Esta conta tem imposto aplicado diretamente sobre ela — o total não é a soma pura das contas analíticas."
```

**Cenário 2 — Imposto na sintética NÃO altera as analíticas filhas**
```gherkin
Dado que há um imposto direto de R$ 9.000,00 sobre a sintética "3.1 - Custeio"
Quando o valor realizado é calculado
Então "3.1.01 - Pessoal" continua com R$ 200.000,00 e "3.1.02 - Serviços" com R$ 100.000,00 (inalteradas)
E só a sintética "3.1 - Custeio" reflete o acréscimo do imposto
```

**Cenário 3 — Sintética com imposto direto E impostos nas filhas**
```gherkin
Dado que "3.1.01 - Pessoal" tem imposto de PIS de R$ 18.500,00 (linha na analítica)
E "3.1 - Custeio" tem imposto de ISS de R$ 9.000,00 (linha na sintética)
Quando o valor realizado de "3.1 - Custeio" é calculado
Então o total é R$ 318.500,00 + R$ 9.000,00 = R$ 327.500,00
  (Σ filhas com seus impostos = 200.000 + 18.500 + 100.000 = 318.500; + imposto direto da sintética = 9.000)
E temImpostoDireto = true para "3.1 - Custeio"
```

**Cenário 4 — Conta inexistente ou inativa (ContaRateioImpostoInvalidaError)**
```gherkin
Dado que o usuário (ou uma chamada direta ao backend) informa uma contaId que não existe no tenant ou está inativa
Quando tenta configurar/gerar o rateio de imposto para essa conta
Então o sistema rejeita com "Conta contábil não encontrada ou inativa."
E nenhuma linha de RateioImpostoGrade é criada
```

**Cenário 5 — Congelamento pós-OFICIALIZADO (herdado)**
```gherkin
Dado que a Versão está OFICIALIZADO e há impostos sobre a sintética "3.1 - Custeio"
Quando o usuário tenta regerar ou alterar o imposto da sintética
Então o backend rejeita com "Ação Negada [TRAVA O ERRO]: ... dados fiscais estão congelados ..."
E as linhas CALCULADO sobre a sintética permanecem como snapshot
```

**Cenário 6 — Regra da US-124 sobre a análise contábil (nota de refinamento)**
```gherkin
Dado que a decisão C1 quebra a invariante "sintética = soma das filhas"
Quando o valor de uma sintética com imposto direto é exibido em qualquer relatório (Semáforo, dashboard US-118, Cronograma de Desembolso)
Então o número exibido é o valor ajustado (com o imposto direto), sempre acompanhado da nota da RN_TAX_16
```

---

## Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `RateioImpostoGrade` (`contaId` deixa de exigir `isAnalitica`); leitura de `ContaContabil` (hierarquia) |
| Migration | **Nenhuma** além da de US-144 — a validação de analítica é de aplicação, não CHECK de banco |
| Domínio | `ValorRealizadoService` — nova função `aplicarImpostosPorConta(mapaBruto, rateios, hierarquia)` chamada **após** o bottom-up; refatorar `CalcularValorRealizadoUseCase` para a nova fase |
| Erros | `ContaRateioImpostoNaoAnaliticaError` → `ContaRateioImpostoInvalidaError` (renomear, atualizar chamadas em `ConfigurarRateioImpostoUseCase` e `prepararPlanoReajuste` — atenção: **o reajuste continua exigindo analítica**, então lá a validação de `isAnalitica` **permanece**, só muda o nome/uso no fluxo de imposto) |
| Tipo serializado | `BadgeSemaforoConta` +`temImpostoDireto: boolean`; propagar até o componente do Semáforo e o dashboard |
| Regra de negócio | Só `contaId` sintética muda a fase de cálculo; herança de todas as regras da US-144 |
| Auditoria | Mesma da US-144 (`IMPOSTOS_GERADOS`), com `contaTipo: 'SINTETICA' \| 'ANALITICA'` por linha |

---

## Dependências

- **US-144** — motor de cálculo automático (analítica) precisa estar entregue.
- **ADR-050** Frente B.
- **Atenção:** `prepararPlanoReajuste` (US-128/129) valida `isAnalitica` para o **reajuste** —
  essa validação **não** deve ser removida; só o fluxo de imposto passa a aceitar sintética.

## Definition of Done

- [ ] Cenários 1 a 6 implementados e aprovados em homologação
- [ ] `RateioImpostoGrade.contaId` aceita sintética no fluxo de imposto; reajuste continua só analítica
- [ ] Imposto sobre sintética aplicado **após** o bottom-up, direto no valor agregado (C1)
- [ ] Analíticas filhas comprovadamente inalteradas por imposto na sintética — teste
- [ ] `temImpostoDireto` no `BadgeSemaforoConta` + nota exibida onde o valor da sintética aparece
- [ ] `parcial` e `temImpostoDireto` coexistem sem se confundir — teste
- [ ] Congelamento e imunidade de TP herdados e testados também para sintética
- [ ] `HistoricoOperacao` distingue `contaTipo` SINTETICA/ANALITICA
- [ ] Motor de reajuste não regride
