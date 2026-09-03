# US-142 — Cronograma de Desembolso por Parcelas (layout APÊNDICE J)

**Módulo:** Orçamentário — Cronograma de Desembolso (`/propostas/{id}/cronograma-desembolso`)
**Épico:** EP48/26 — Módulo Orçamentário
**Prioridade:** Alta
**Estimativa:** G (~3–4 dias) — muda o motor de cálculo, o schema (2 campos) e a tela
**Status:** 🔜 **Pronta para implementar.** GAPs de negócio fechados + **ADR-049 aceito**
(`docs/ADR-049 ...md`): 2 campos em `Proposta` (`parcelasPorAno`/`mesInicialRepasse`, nullable +
default 3/1), camada `agregarEmParcelas` sobre o motor mensal, CD-06 aceito como limitação
(→ US-143 futura), filtro de período client-side, DDL da migration pronto.
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

### Decisões de negócio fechadas com o usuário (AskUserQuestion, 2026-09-02)

| GAP | Decisão |
|---|---|
| **CD-01** — calendário de repasse | **Configurável por Proposta**, via 2 campos: **nº de parcelas por ano** + **mês inicial de repasse**. Ex.: "3/ano a partir de janeiro" → jan/mai/set (espaçamento 12÷3 = 4 meses); "2/ano a partir de março" → mar/set. Não há mais "regra fixa jan/mai/set". |
| **CD-03** — 1ª parcela | **Há uma parcela de entrada (T1) no mês de `dataInicio`**, mesmo que não seja um mês de repasse. As demais parcelas seguem o calendário configurado. Se `dataInicio` coincidir com um mês de repasse, T1 acumula os dois papéis. |
| **CD-04** — rateio por Meta | **Meta única.** Na CTCEA, Termo de Parceria = 1 Meta / Proposta CONSOLIDADA. Cada parcela tem **uma** sub-linha "Meta Única" com o valor cheio da parcela — sem rateio entre múltiplas Metas, sem tratamento especial de imposto (entra no total normalmente). |
| **CD-02** — texto da Etapa | **Etapa M = número sequencial da parcela.** T1 → "1ª parcela relativa à Etapa 1 do Cronograma Físico-Financeiro."; T2 → "2ª parcela relativa à Etapa 2..."; e assim por diante. |
| **CD-05** — "Valor Repassado a cada 12 meses de execução" | **Ciclo de 12 meses contados de `dataInicio`** (não ano civil). O valor aparece na parcela que fecha cada 12º mês de execução (mês 12, 24, 36...) e é o somatório dos desembolsos daquele ciclo — mesma lógica da RN0253 atual. |
| **Adiantamento 1ª+2ª parcela** | **Fora de escopo.** Na prática de caixa a 1ª parcela costuma ser paga junto com a 2ª (o próximo recebimento real fica ~8 meses depois, por pular uma data do calendário). Mas o **cronograma do documento/tela segue as datas teóricas** — T1 na entrada, T2 na 1ª data regular, T3 na seguinte, espaçadas normalmente. O sistema **não** modela antecipação de caixa. |
| **Escopo da tela** | A grade mensal atual é **SUBSTITUÍDA** pela visão de parcelas. Não há duas telas. |

### Regra de derivação das parcelas (fechada — o ADR só decide a modelagem)

1. **Base de cálculo:** o motor mês a mês atual (`montarCronogramaDesembolso.ts`) continua sendo
   a "verdade" do custo por competência. A US-142 adiciona uma camada de **agregação em
   parcelas** por cima dele.
2. **Datas das parcelas:**
   - T1 = mês de `Proposta.dataInicio` (parcela de entrada).
   - Demais: a partir do `mesInicialRepasse`, espaçadas de `12 ÷ parcelasPorAno` meses,
     repetindo a cada ano, mantendo apenas as datas dentro de `(dataInicio, dataFim]`.
   - Ordenar cronologicamente e renumerar T1, T2, ... Tn.
3. **Período coberto por cada parcela:** da data da parcela anterior (exclusive) até a data desta
   parcela (inclusive). T1 cobre de `dataInicio` até seu próprio mês.
4. **Valor da parcela:** soma dos `desembolsoMensal` (motor atual) dos meses do seu período.
5. **Sub-linha por parcela:** uma linha "Meta Única" = valor cheio da parcela.
6. **Total geral = Valor Global da Proposta** (RN_CD_002). Resíduo de arredondamento (centavos)
   vai para a última parcela.
7. **Subtotais anuais:** linha `ANO XXXX / TOTAL A DESEMBOLSAR EM XXXX` ao fim de cada **ano
   civil** com parcelas — total do ano, acumulado e % ao fim do ano.
8. **Coluna "Valor Repassado a cada 12 meses":** só na parcela que fecha cada 12º mês de
   execução; valor = soma dos desembolsos do ciclo de 12 meses.

---

## GAPs — situação

CD-01 a CD-05 e CD-08 **fechados** (ver tabela de decisões acima e abaixo). Restam:

| # | GAP | Situação | Quem decide |
|---|---|---|---|
| GAP-CD-06 | **Viagem sem data (limitação herdada).** Hoje todo o custo de Viagem cai no 1º mês → com parcelas, toda a Viagem entra em T1 (parcela de entrada). Aceitar a limitação nesta US, ou exigir antes uma US de "data da viagem"? | Aberto — decisão do Tech Lead no ADR-049. Recomendação AN/PO: **aceitar como limitação conhecida** (documentar), tratar "data da viagem" como US futura. | Tech Lead |
| GAP-CD-07 | **Exportação PDF/XLSX** com subtotais anuais + total geral + cabeçalho "APÊNDICE J". | Fechado: **incluído no escopo** desta US. | — |
| GAP-CD-08 | Onde ficam os 2 campos de config. | **Fechado:** vão em **`Proposta`** (característica contratual do TP), preenchidos na **tela de cadastro/edição da Proposta**. A tela de Cronograma **não edita** — só lê e exibe, com um **filtro de período** para restringir o intervalo mostrado. O ADR-049 ainda decide: nullable com validação na geração, ou default `3` / `1`. | — / Tech Lead (só o default) |

---

## Critérios de Aceite

**Cenário 1 — Geração do cronograma por parcelas**
```gherkin
Dado que a Proposta tem versão ativa, dados financeiros cadastrados e Valor Global > 0
E a vigência vai de 2018-07-01 a 2023-06-30
E a Proposta está configurada com parcelasPorAno = 3 e mesInicialRepasse = 1 (janeiro)
Quando o usuário abre a guia Cronograma de Desembolso
Então o sistema deriva: T1 = jul/2018 (parcela de entrada), T2 = set/2018, T3 = jan/2019, T4 = mai/2019, T5 = set/2019, ...
E cada parcela Tn exibe: rótulo "Tn", data, descrição "Nª parcela relativa à Etapa n do Cronograma Físico-Financeiro." (n = número da parcela), valor da parcela, acumulado, % financeiro acumulado
E abaixo de cada parcela há uma sub-linha "Evento Tn — Meta Única" com o valor cheio da parcela
E ao fim de cada ano civil com parcelas há a linha "ANO XXXX / TOTAL A DESEMBOLSAR EM XXXX" com o total do ano, o acumulado e o % ao fim do ano
E a última linha é "ANOS 2018 ... E 2023 / TOTAL A DESEMBOLSAR EM ..." com valor igual ao Valor Global
E nenhum campo é editável [ORIGEM BLINDADA / RN_CD_001]
E a operação é registrada em HistoricoOperacao
```

**Cenário 1b — Calendário de repasse configurado diferente**
```gherkin
Dado que a Proposta tem parcelasPorAno = 2 e mesInicialRepasse = 3 (março)
E dataInicio em 2020-05
Quando o cronograma é gerado
Então T1 = mai/2020 (entrada), e as demais parcelas caem em set/2020, mar/2021, set/2021, ... (espaçamento de 6 meses a partir de março)
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

**Cenário 6 — Config de repasse ausente (bloqueio ou default)**
```gherkin
Dado que a Proposta não tem parcelasPorAno / mesInicialRepasse preenchidos
Quando o usuário abre a guia Cronograma de Desembolso
Então [ADR-049 decide: aplicar o default 3/janeiro, OU bloquear com "Configure o calendário de repasse do Termo de Parceria."]
```

**Cenário 7 — "Valor Repassado a cada 12 meses de execução" (GAP-CD-05)**
```gherkin
Dado que a Proposta começa em jul/2018 e tem parcelas mensais de custo
Quando o cronograma é gerado
Então a coluna "Valor Repassado a cada 12 meses de execução" só é preenchida na parcela cujo período cobre o 12º mês de execução (jun/2019), o 24º (jun/2020), etc.
E o valor é o somatório dos desembolsos daquele ciclo de 12 meses
E nas demais parcelas a célula fica vazia / com hífen [RN0253]
```

---

## Impacto Técnico (preliminar — o ADR fecha)

| Aspecto | Detalhe |
|---|---|
| Domínio | `montarCronogramaDesembolso.ts` ganha uma camada de agregação: das linhas mensais para linhas de parcela. Provável função nova `agregarEmParcelas(linhasMensais, regraRepasse, metas)` → `LinhaParcela[]` + `SubtotalAnual[]` + `TotalGeral`. O cálculo mês a mês continua sendo a base (não jogar fora). |
| Sub-linha "Meta Única" | Sem rateio entre Metas — uma sub-linha por parcela com o valor cheio. |
| Schema | **Migration aditiva** — `Proposta` ganha `parcelasPorAno Int?` e `mesInicialRepasse Int?` (1–12). Nullable; default de aplicação `3` / `1` ou bloqueio na geração — ADR-049. |
| UI de config | Os 2 campos entram na **tela de cadastro/edição da Proposta** (`CadastrarPropostaUseCase`/`EditarPropostaUseCase`/form). A tela de Cronograma **não** os edita. |
| Filtro da tela de Cronograma | Read-only. Único controle: **filtro de período** (data inicial / data final de exibição) para recortar o intervalo mostrado. Não altera o cálculo — só a janela exibida. |
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
