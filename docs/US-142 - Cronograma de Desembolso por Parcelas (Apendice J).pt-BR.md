# US-142 — Cronograma de Desembolso por Parcelas (layout APÊNDICE J)

**Módulo:** Orçamentário — Cronograma de Desembolso (`/propostas/{id}/cronograma-desembolso`)
**Épico:** EP48/26 — Módulo Orçamentário
**Prioridade:** Alta
**Estimativa:** G (~3–4 dias) — muda o motor de cálculo e a tela; ADR necessário antes de codar
**Status:** 🔜 Refinada, com GAPs abertos (ver seção própria) — depende de ADR
**Origem:** 2026-09-02, documento-alvo "APÊNDICE J — CRONOGRAMA DE DESEMBOLSO" fornecido pelo usuário
**Substitui:** a visão mensal atual de UC04.01 / US-138 (a grade "Mês 1, Mês 2..." sai)

**Como** orçamentista da CTCEA preparando a prestação de contas / o plano de trabalho de um
Termo de Parceria,
**Quero** que o Cronograma de Desembolso seja apresentado como uma tabela de **parcelas
periódicas** (T1, T2, T3...), agrupadas por ano com subtotais e um total geral,
**Para** que o documento gerado pelo SGO seja idêntico ao APÊNDICE J que o concedente exige —
hoje a tela produz uma grade mês a mês que não corresponde ao formato oficial.

---

## Contexto e regras de negócio

### O que existe hoje (US-138 / UC04.01)

`montarCronogramaDesembolso.ts` gera **uma linha por mês-calendário** da vigência da Proposta,
distribuindo o custo de Empregado (snapshots), Viagem (tudo no 1º mês — limitação conhecida),
ItemPatrimonial e RateioImpostoGrade (no mês do respectivo campo de data). Colunas: Desembolso
Mensal, Acumulado, % Financeiro Acumulado (RN0252), Valor Repassado a cada 12 meses (RN0253).
Linhas de fechamento de 12 meses são só destacadas visualmente — **não há subtotal por ano nem
total geral**, e não há conceito de "parcela" ou "Etapa".

### O que o APÊNDICE J exige

| Elemento | Descrição |
|---|---|
| **Evento** | `T1`, `T2`, ... `Tn` — uma **parcela** por período de repasse (não por mês). |
| **Data** | Mês-ano de cada parcela. No exemplo: **jan / mai / set** de cada ano (3 parcelas/ano). |
| **Descrição** | `"Nª parcela relativa à Etapa M do Cronograma Físico-Financeiro."` |
| **Sub-linhas por Meta** | Dentro de cada parcela, uma linha `"Evento Tn Meta <X>"` — o rateio da parcela por Meta. |
| **Subtotal anual** | Linha `ANO XXXX` / `TOTAL A DESEMBOLSAR EM XXXX` com total do ano, acumulado e % ao fim do ano. |
| **Total geral** | Linha final `ANOS 2018, 2019... E 2023` / `TOTAL A DESEMBOLSAR EM ...` com o valor global. |
| **Desembolso Mensal** | Valor da parcela (mantém o rótulo "Mensal" do documento, embora seja o valor da parcela). |
| **Desembolso Acumulado** | RN0251 — soma vertical progressiva das parcelas. |
| **% Financeiro Acumulado** | RN0252 — Acumulado ÷ Valor Global × 100, 2 casas, Half-Even. |
| **Valor Repassado a cada 12 meses de execução** | Preenchido só nas linhas de fronteira de ciclo anual (RN0253, adaptada: "ciclo" agora é o ano da parcela, não o 12º mês). |

### Decisões já tomadas com o usuário (AskUserQuestion, 2026-09-02)

1. **As parcelas são DERIVADAS pelo sistema** — não há cadastro manual de cronograma
   físico-financeiro. O sistema pega o custo total já calculado (mesmas fontes de hoje:
   Empregado, Viagem, ItemPatrimonial, RateioImpostoGrade) e o distribui em parcelas seguindo
   uma **regra fixa de repasse**: 3 parcelas por ano, nos meses de **janeiro, maio e setembro**.
2. **"Etapa" = "Meta"** — o agrupamento por Meta ("Evento Tn Meta U") é o detalhamento por Meta
   dentro de cada parcela. (O texto "Etapa M" é discutido nos GAPs — ver abaixo.)
3. **A grade mensal atual é SUBSTITUÍDA** pela visão de parcelas. Não há duas telas.

### Regra de derivação das parcelas (proposta desta US — sujeita ao ADR)

1. O motor mês a mês atual continua sendo a **base de cálculo** (é a "verdade" do custo por
   competência). A US-142 adiciona uma etapa de **agregação em parcelas** por cima dele.
2. **Datas das parcelas:** a partir do mês de `Proposta.dataInicio`, gerar as datas
   jan / mai / set que caem dentro de `[dataInicio, dataFim]`. A 1ª parcela é a primeira
   dessas datas ≥ `dataInicio` (no exemplo: proposta começa em 2018 → 1ª parcela set/2018).
3. **Período coberto por cada parcela:** da data da parcela anterior (exclusive) até a data
   desta parcela (inclusive). A 1ª parcela cobre de `dataInicio` até a sua data.
4. **Valor da parcela:** soma dos `desembolsoMensal` (motor atual) dos meses do seu período.
5. **Rateio por Meta (sub-linhas):** cada fonte de custo é atribuída à sua Meta —
   `EmpregadoHeadcount.metaId`, `Viagem.metaId`, `ItemPatrimonial.metaId`. O que não tem Meta
   (Proposta CONSOLIDADA; RateioImpostoGrade) → ver GAP-CD-04.
6. **Total geral = Valor Global da Proposta** (RN_CD_002 — a soma de todas as parcelas deve
   bater exatamente com o Custo Total; qualquer diferença de arredondamento vai para a última
   parcela).

---

## 🔴 GAPs abertos (decisão do usuário / Tech Lead antes de implementar)

| # | GAP | Por que trava | Quem decide |
|---|---|---|---|
| GAP-CD-01 | **Meses de repasse fixos (jan/mai/set)?** Confirmar se é sempre isso ou se varia por Termo de Parceria / concedente. Se varia, vira parâmetro (`ParametroSistema`) ou campo na Proposta. | Muda o nº de linhas e as datas de todo o cronograma. | Usuário |
| GAP-CD-02 | **Texto "Nª parcela relativa à Etapa M..."** — como numerar M? No exemplo, T1→Etapa 1, T2→Etapa 3, T3→Etapa 4, T4→Etapa 5... (pula de 1 para 3). Se "Etapa = Meta" e há várias Metas, "Etapa M" pode ser um índice global de (parcela × meta). Precisa da regra exata do texto. | É texto de documento oficial [RN_CD_001 — descrição gerada pelo servidor, sem input]. | Usuário / autor do APÊNDICE J |
| GAP-CD-03 | **1ª parcela.** Proposta que começa em, ex., março: a 1ª parcela é maio (próxima data de repasse) acumulando março+abril+maio, ou existe uma parcela "de entrada" na data de início? | Define o alinhamento de todo o cronograma. | Usuário |
| GAP-CD-04 | **Rateio por Meta do que não tem Meta.** Proposta CONSOLIDADA não tem Meta nenhuma — as sub-linhas "Evento Tn Meta U" não existem? E o RateioImpostoGrade (imposto), que não tem `metaId`, entra em qual sub-linha? Rateio proporcional ao custo das Metas? | Define se a US atende CONSOLIDADA e como as sub-linhas se comportam. | Usuário / Tech Lead |
| GAP-CD-05 | **"Valor Repassado a cada 12 meses de execução".** Hoje é RN0253 (só nos meses múltiplos de 12). No APÊNDICE J parece ser o total do **ano civil** (aparece nas linhas ANO XXXX). Confirmar: é o total do ano civil, ou o total de cada ciclo de 12 meses contados da data de início? | Muda o valor e onde ele aparece. | Usuário |
| GAP-CD-06 | **Viagem sem data (limitação herdada).** Hoje todo o custo de Viagem cai no 1º mês. Com parcelas, isso joga toda a Viagem na 1ª parcela. A US-141 já persiste... nada de data de viagem. Aceitar a limitação ou exige a US de "data da viagem" antes? | Distorce a 1ª parcela se houver muita viagem. | Usuário / Tech Lead |
| GAP-CD-07 | **Exportação.** O PDF/XLSX (ADR-037, client-side) hoje exporta a lista plana. Precisa passar a exportar com as linhas de subtotal anual e total geral, no layout do APÊNDICE J (inclusive o cabeçalho "APÊNDICE J"). | Escopo da entrega. | AN/PO (já assumido: sim, incluir) |

---

## Critérios de Aceite (rascunho — válidos após fechar GAP-CD-01/03/05)

> Suposições de rascunho: repasses em jan/mai/set; 1ª parcela = 1ª data de repasse ≥ dataInicio,
> acumulando os meses desde dataInicio; "Valor Repassado a cada 12 meses" = total do ano civil.

**Cenário 1 — Geração do cronograma por parcelas**
```gherkin
Dado que a Proposta tem versão ativa, dados financeiros cadastrados e Valor Global > 0
E a vigência vai de 2018-07 a 2023-06
Quando o usuário abre a guia Cronograma de Desembolso
Então o sistema deriva as parcelas nas datas de repasse (set/2018, jan/2019, mai/2019, set/2019, ...)
E cada parcela Tn exibe: rótulo "Tn", data, descrição "Nª parcela relativa à Etapa M do Cronograma Físico-Financeiro.", valor da parcela, acumulado, % financeiro acumulado
E abaixo de cada parcela há uma sub-linha por Meta ("Evento Tn Meta <nome>") com o valor rateado
E ao fim de cada ano civil há a linha "ANO XXXX / TOTAL A DESEMBOLSAR EM XXXX" com o total do ano, o acumulado e o % ao fim do ano
E a última linha é "ANOS 2018 ... E 2023 / TOTAL A DESEMBOLSAR EM ..." com valor igual ao Valor Global
E nenhum campo é editável [ORIGEM BLINDADA / RN_CD_001]
E a operação é registrada em HistoricoOperacao
```

**Cenário 2 — Soma das parcelas bate com o Custo Total (RN_CD_002)**
```gherkin
Dado que o cronograma foi gerado
Quando se somam os valores de todas as parcelas Tn
Então o resultado é exatamente igual ao Valor Global da Proposta
E qualquer resíduo de arredondamento (centavos) é absorvido pela última parcela
```

**Cenário 3 — % Financeiro Acumulado (RN0252)**
```gherkin
Dado que a parcela T3 tem desembolso acumulado de R$ 8.734.745,00 e o Valor Global é R$ 36.914.000,00
Quando o sistema calcula o % da linha T3
Então exibe "23,65%" (2 casas decimais fixas, arredondamento Half-Even)
```

**Cenário 4 — Proposta sem dados financeiros (bloqueio, Fluxo E1)**
```gherkin
Dado que a Proposta tem Valor Global R$ 0,00 ou sem registros analíticos
Quando o usuário abre a guia Cronograma de Desembolso
Então nenhuma tabela de parcelas é aberta
E o sistema exibe "Operação Rejeitada: A Proposta selecionada não possui dados financeiros cadastrados para consolidação." [TRAVA O ERRO]
```

**Cenário 5 — Exportação PDF/XLSX no layout APÊNDICE J**
```gherkin
Dado que o cronograma de parcelas está renderizado
Quando o usuário aciona [Imprimir]/[PDF] ou [XLSX]
Então o arquivo gerado tem o cabeçalho "APÊNDICE J — CRONOGRAMA DE DESEMBOLSO", as parcelas, as sub-linhas por Meta, os subtotais anuais e o total geral
E a operação é registrada em HistoricoOperacao [RN0232]
```

**Cenário 6 — Proposta CONSOLIDADA (sem Meta)** — *pendente GAP-CD-04*
```gherkin
Dado que a Proposta é CONSOLIDADA (não tem Meta)
Quando o cronograma é gerado
Então [comportamento a definir no GAP-CD-04 — provavelmente sem as sub-linhas "Evento Tn Meta", só as parcelas]
```

---

## Impacto Técnico (preliminar — o ADR fecha)

| Aspecto | Detalhe |
|---|---|
| Domínio | `montarCronogramaDesembolso.ts` ganha uma camada de agregação: das linhas mensais para linhas de parcela. Provável função nova `agregarEmParcelas(linhasMensais, regraRepasse, metas)` → `LinhaParcela[]` + `SubtotalAnual[]` + `TotalGeral`. O cálculo mês a mês continua sendo a base (não jogar fora). |
| Rateio por Meta | Precisa carregar `metaId` de Empregado/Viagem/ItemPatrimonial e agregar por Meta dentro de cada período de parcela. |
| Schema | **Provavelmente nenhuma migration** (parcelas são derivadas, não persistidas) — a menos que GAP-CD-01 torne os meses de repasse configuráveis (aí um campo em `Proposta` ou `ParametroSistema`). |
| `page.tsx` (guia cronograma-desembolso) | Passa a montar/serializar a estrutura de parcelas + subtotais. |
| `CronogramaDesembolsoPanel.tsx` | Reescrito: tabela de parcelas com sub-linhas por Meta, linhas de subtotal anual, linha de total geral. Remove a grade "Mês N". |
| `exportarRelatorio.ts` (PDF/XLSX) | Suportar linhas de subtotal/total com formatação distinta e o cabeçalho "APÊNDICE J". |
| Testes | `agregarEmParcelas` (datas, períodos, soma = valor global, resíduo na última parcela, rateio por Meta), `%` acumulado, subtotais anuais, bloqueio sem dados. |
| Não muda | `calcularCustoEstimadoViagem` e o Valor Global (fonte da verdade continua o custo já calculado). |

---

## Dependências

- **ADR** (a criar, `techlead-fsg`) — fecha GAP-CD-01 a GAP-CD-07 (principalmente: onde vive a
  regra de repasse; como o rateio por Meta trata CONSOLIDADA e imposto; texto exato da descrição).
- US-138 / UC04.01 — base atual (será revista/substituída na parte de apresentação).
- US-141 — sem relação direta (a limitação "Viagem sem data" de GAP-CD-06 é anterior).
- Fluxo Git: muda motor de cálculo financeiro + tela → **branch + PR + `/code-review`**.

## Recomendação de backlog

- **🔜 Próximo da Fila**, posição 1 do Módulo Orçamentário — é o pedido explícito e ativo do usuário.
- **Antes de codar:** o `techlead-fsg` produz o ADR fechando os GAPs; o `analista-negocios-po`
  converte os cenários de rascunho em CA definitivos. Sem isso, o dev vai chutar a regra de
  repasse e o rateio por Meta.
- **Menor incremento entregável:** se GAP-CD-04 (CONSOLIDADA / imposto) demorar, entregar
  primeiro só para Proposta POR_META (onde todo custo tem Meta), com as sub-linhas completas.

## Definition of Done

- [ ] GAPs CD-01/02/03/04/05/06 fechados por ADR + refinamento
- [ ] Parcelas derivadas nas datas de repasse corretas dentro da vigência
- [ ] Soma das parcelas = Valor Global exatamente (resíduo na última) — teste de regressão
- [ ] Sub-linhas por Meta com rateio correto (ou comportamento definido para CONSOLIDADA)
- [ ] Subtotais anuais + total geral, na tela e na exportação
- [ ] % Financeiro Acumulado com 2 casas Half-Even (RN0252)
- [ ] Bloqueio "sem dados financeiros" (Fluxo E1) preservado
- [ ] Exportação PDF/XLSX no layout APÊNDICE J
- [ ] HistoricoOperacao registrada
- [ ] Nenhum campo editável (RN_CD_001 / ORIGEM BLINDADA)
