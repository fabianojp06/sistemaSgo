# US-146 — Exibir "Custo" e "Custo com Impostos" lado a lado

**Módulo:** Orçamentário — Semáforo Orçamentário / Dashboard da Proposta
**Épico:** Aplicação Automática de Impostos sobre Contas
**Prioridade:** Média
**Estimativa:** M
**Status:** 🔜 Depende de US-144
**ADR:** ADR-050 (Frente F)

**Como** Orçamentista, GFIN ou Auditor,
**Quero** ver, em cada conta, o **custo bruto** (pessoal + viagens + bens) e o **custo com
impostos** separados,
**Para** entender quanto do valor da conta é despesa direta e quanto é carga tributária, sem
precisar abrir a memória de cálculo fiscal.

---

## Contexto e Regras de Negócio

Hoje `ValorRealizadoService` **já soma** `RateioImpostoGrade.valorDeclarado` junto de
Empregado/Viagem/Bem — ou seja, o `valorRealizado` que alimenta o Semáforo (US-008a), o dashboard
da guia Valor Orçado (US-118) e a coluna "Desembolso" do Cronograma **já inclui imposto**. O que
falta é **mostrar o número sem imposto ao lado**, para dar visibilidade da carga tributária.

### RN_TAX_17 — Dois valores por conta (ADR-050 Frente F)

Para cada conta, o sistema passa a expor:
- **Custo** (`valorRealizadoSemImposto`) = Empregado + Viagem + ItemPatrimonial atribuídos à
  conta (para sintética: soma das analíticas descendentes). **Não inclui** nenhum
  `RateioImpostoGrade`.
- **Custo com Impostos** (`valorRealizado`, o número que já existe hoje) = Custo + todos os
  `RateioImpostoGrade` ativos da conta (`DECLARADO` + `CALCULADO`), incluindo imposto direto na
  sintética (US-145).

### RN_TAX_18 — O que cada valor dirige (comportamento preservado)

- O **percentual e a cor do Semáforo** (RN0252 do Semáforo / ADR-032) continuam sendo calculados
  sobre **"Custo com Impostos"** vs Valor Orçado — **sem mudança de regra**. US-008a / ADR-032
  não reabrem.
- O **Valor Global da Proposta** continua sendo o total **com impostos** — o imposto é custo real
  que entra no Valor Global.
- **"Custo" (sem imposto)** é **exclusivamente informativo** — não dirige semáforo, nem Valor
  Global, nem cronograma.

### RN_TAX_19 — Onde os dois valores aparecem

| Local | Como |
|---|---|
| **Badge do Semáforo** (`/plano-contas/[versaoId]`, US-008a) | 2 números por conta: "Custo" e "Custo c/ Impostos". A barra/cor segue "c/ Impostos". |
| **Guia "Valor Orçado" / dashboard** (US-118) | 2 colunas na árvore de contas: "Custo" e "Custo c/ Impostos". Os totalizadores sintéticos mostram ambos. |
| **Guia "Lançar Valor Orçado"** | Sem mudança — é entrada manual do orçado, não do realizado. |
| **Cronograma de Desembolso** (US-142) | Fora de escopo desta US — o Cronograma usa só o "com impostos" hoje; revisitar se o usuário pedir a separação lá também. |

---

## Critérios de Aceite

**Cenário 1 — Badge do Semáforo mostra os dois valores**
```gherkin
Dado que a conta analítica "3.1.01 - Pessoal" tem custo bruto de R$ 200.000,00
E tem impostos gerados (PIS R$ 18.500,00) totalizando R$ 218.500,00
E o valor orçado da conta é R$ 210.000,00
Quando o usuário abre o Badge do Semáforo Orçamentário da Versão
Então a conta "3.1.01" exibe "Custo: R$ 200.000,00" e "Custo c/ Impostos: R$ 218.500,00"
E o percentual do semáforo é calculado como 218.500 / 210.000 = 104,05% (com imposto, RN_TAX_18)
E a cor reflete esse percentual (mesma regra de hoje)
```

**Cenário 2 — Dashboard da guia Valor Orçado com duas colunas**
```gherkin
Dado que a Proposta tem contas com e sem impostos gerados
Quando o usuário abre a guia "Valor Orçado" (dashboard-resumo, US-118)
Então a árvore de contas mostra, por linha, as colunas "Custo" e "Custo c/ Impostos"
E cada conta sintética totaliza ambas as colunas (Σ das filhas)
E o Valor Global exibido no topo é o total "c/ Impostos"
```

**Cenário 3 — Conta sem nenhum imposto: os dois valores são iguais**
```gherkin
Dado que a conta "3.1.09 - Reserva" não tem nenhum RateioImpostoGrade ativo
Quando os valores são exibidos
Então "Custo" e "Custo c/ Impostos" mostram o mesmo número
E nenhuma nota ou destaque de imposto aparece para essa conta
```

**Cenário 4 — Conta sintética com imposto direto (integra US-145)**
```gherkin
Dado que a sintética "3.1 - Custeio" tem imposto direto de R$ 9.000,00 (US-145)
Quando os valores são exibidos
Então "Custo" da sintética = soma bruta das filhas (sem o imposto direto)
E "Custo c/ Impostos" da sintética = soma das filhas + impostos das filhas + o imposto direto de R$ 9.000,00
E a nota da RN_TAX_16 ("imposto aplicado diretamente...") aparece junto
```

**Cenário 5 — Percentual do Semáforo não muda de regra**
```gherkin
Dado que antes desta US o Semáforo de uma conta mostrava 104,05% (já incluía o rateio manual de imposto)
Quando esta US entra em produção sem que nenhum imposto novo seja gerado
Então o percentual e a cor da conta permanecem exatamente 104,05% e a mesma cor
E apenas o número "Custo" (sem imposto) passa a ser exibido adicionalmente
```

---

## Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nenhuma (só leitura) |
| Migration | Nenhuma |
| Domínio | `ValorRealizadoService` — expor `somarCustoBrutoPorConta` (já criado na US-144) + o `somarPorContaAnalitica` atual (com imposto). `CalcularValorRealizadoUseCase` retorna os dois valores por conta. |
| Tipo serializado | `BadgeSemaforoConta` +`valorRealizadoSemImposto: string`; o tipo serializado do dashboard US-118 idem. Propagar até os componentes React (`BadgeSemaforoPanel`, `ValorOrcadoResumoPanel`). |
| UI | Badge do Semáforo: 2 linhas de valor por conta. Dashboard US-118: 2 colunas. Sem CSS inline — Tailwind. Estados vazio/erro preservados. |
| Regra de negócio | % e cor do Semáforo e Valor Global **inalterados** (seguem "com imposto"). "Custo" é só exibição. |
| Auditoria | Nenhuma (operação de leitura) |

---

## Dependências

- **US-144** — o "Custo sem imposto" (`somarCustoBrutoPorConta`) nasce lá.
- **US-145** (opcional para o cenário 4) — imposto direto na sintética.
- **ADR-050** Frente F.
- US-008a / US-118 / ADR-032 — telas consumidoras.

## Definition of Done

- [ ] Cenários 1 a 5 implementados e aprovados em homologação
- [ ] `BadgeSemaforoConta` expõe `valorRealizadoSemImposto`; propagado até a UI
- [ ] Badge do Semáforo e dashboard US-118 mostram "Custo" e "Custo c/ Impostos"
- [ ] Percentual, cor do Semáforo e Valor Global **inalterados** — teste de regressão (Cenário 5)
- [ ] Conta sem imposto: os dois valores iguais, sem ruído visual
- [ ] Conta sintética com imposto direto integra a nota da US-145
- [ ] Nenhuma mudança de schema, nenhuma migration
