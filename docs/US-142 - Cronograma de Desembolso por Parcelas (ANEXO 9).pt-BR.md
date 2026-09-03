# US-142 — Cronograma de Desembolso por Parcelas (layout ANEXO 9)

> **Documento-alvo definitivo:** `ANEXO 9 - CRONOGRAMA DESEMBOLSO 15.08.25.pdf` (Termo de Parceria
> PAME-RJ/CTCEA/2025). Substitui a versão anterior "APÊNDICE J". Layout e regras abaixo batem com
> esse PDF, confirmados com o usuário em 2026-09-02.

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

### Layout do ANEXO 9 (7 colunas)

| Coluna | Conteúdo |
|---|---|
| **EVENTO** | `T1`, `T2`, ... `Tn` nas linhas de parcela; `ANO XXXX` nas linhas de subtotal; `ANOS 2026, 2027 ... E 2030` na linha de total geral. |
| **DATA** | Mês por extenso + ano — `"janeiro 2026"`, `"maio 2026"`, `"setembro 2026"`. Vazio nas linhas de subtotal/total. |
| **DESCRIÇÃO DO EVENTO** | Parcela: `"Nª parcela relativa à Etapa M do Cronograma Físico"` (T1 pode ser `"1ª parcela relativa às Etapas 1 e 2..."` — ver regra da Etapa). Sub-linha: `"Evento Tn Meta 01"`. Subtotal: `"TOTAL A DESEMBOLSAR EM XXXX"`. Total geral: `"TOTAL A DESEMBOLSAR EM 2026, 2027, 2028, 2029 E 2030"`. |
| **DESEMBOLSO MENSAL** | Parcela: valor da parcela. Sub-linha "Meta 01": repete o valor da parcela (única sub-linha). Subtotal: soma das parcelas do ano civil. |
| **DESEMBOLSO ACUMULADO** | RN0251 — soma progressiva das parcelas. Nas linhas de parcela e de subtotal. Vazio na sub-linha. |
| **% FINANCEIRO ACUMULADO** | RN0252 — Acumulado ÷ Valor Global × 100, 2 casas, Half-Even. Nas linhas de parcela **e** de subtotal. |
| **VALOR ACUMULADO POR ANO DO TERMO DE PARCERIA** | Preenchida **só nas linhas `TOTAL A DESEMBOLSAR EM XXXX`** = o Desembolso Acumulado ao fim daquele ano civil (mesmo número da coluna "DESEMBOLSO ACUMULADO" naquela linha). |

Linha de **total geral** (última): `EVENTO = "ANOS 2026, 2027, 2028, 2029 E 2030"`,
`DESCRIÇÃO = "TOTAL A DESEMBOLSAR EM 2026, 2027, 2028, 2029 E 2030"`, e o Valor Global numa célula
mesclada. Cabeçalho do documento: **`ANEXO 9` / `CRONOGRAMA DE DESEMBOLSO`**.

> **Sai da spec:** a coluna "Valor Repassado a cada 12 meses de execução" e a RN0253 (ciclo de 12
> meses). O ANEXO 9 não tem essa coluna — no lugar tem "Valor Acumulado por Ano do TP", que é só
> o acumulado ao fim do ano.

### Decisões de negócio fechadas com o usuário (AskUserQuestion, 2026-09-02)

| GAP | Decisão |
|---|---|
| **CD-01** — calendário de repasse | **Configurável por Proposta**, via 2 campos: **nº de parcelas por ano** + **mês inicial de repasse**. Ex.: "3/ano a partir de janeiro" → jan/mai/set (espaçamento 12÷3 = 4 meses); "2/ano a partir de março" → mar/set. Não há mais "regra fixa jan/mai/set". |
| **CD-03** — 1ª parcela | Há uma **parcela de entrada (T1) no mês de `dataInicio`**. As demais seguem o calendário configurado. Se `dataInicio` coincide com o mês do 1º repasse (caso do ANEXO 9: início jan/26, repasse a partir de janeiro), T1 acumula os dois papéis. |
| **CD-03b** — período coberto | **Antecipado.** Cada parcela Tk paga o bloco que **começa** na data dela: T1 (jan) → jan–abr, T2 (mai) → mai–ago, T3 (set) → set–dez, ... A **última** parcela cobre da sua data até `dataFim`. (Por isso T1 é maior no ANEXO 9 — carrega jan–abr das operações **+** todo o custo de mobilização/viagens/bens do projeto, que hoje cai no 1º mês — ver CD-06.) |
| **CD-04** — detalhamento | **Meta única.** TP = 1 Meta / Proposta CONSOLIDADA. Cada parcela tem **uma** sub-linha `"Evento Tn Meta 01"` que repete o valor cheio da parcela na coluna DESEMBOLSO MENSAL. Sem rateio entre Metas, sem tratamento especial de imposto. |
| **CD-02** — Etapa | **Etapa 1 = a entrada; cada data de repasse regular = a próxima Etapa.** Se `dataInicio` coincide com o 1º repasse: T1 → `"1ª parcela relativa às Etapas 1 e 2 do Cronograma Físico"` e daí em diante Tn (n≥2) → `"nª parcela relativa à Etapa (n+1) do Cronograma Físico"`. Se **não** coincide: T1 → `"1ª parcela relativa à Etapa 1..."`, T2 → `"...Etapa 2..."`, sem deslocamento (Tn → Etapa n). Texto: "Cronograma **Físico**" (não "Físico-Financeiro"). |
| **CD-05** — coluna 7 | É **"VALOR ACUMULADO POR ANO DO TERMO DE PARCERIA"**, não "Valor Repassado a cada 12 meses". Preenchida só nas linhas `TOTAL A DESEMBOLSAR EM XXXX` = Desembolso Acumulado ao fim daquele **ano civil**. A RN0253 e a coluna de ciclo de 12 meses **saem** da spec. |
| **Adiantamento 1ª+2ª parcela** | **Modelado como coincidência de datas**, não como antecipação de caixa. Quando `dataInicio` = mês do 1º repasse, T1 já é a fusão da entrada com o 1º repasse ("Etapas 1 e 2") — é isso que o ANEXO 9 mostra. O sistema segue as datas teóricas do calendário. |
| **Escopo da tela** | A grade mensal atual é **SUBSTITUÍDA** pela visão de parcelas. Não há duas telas. |

### Regra de derivação das parcelas (fechada — o ADR só decide a modelagem)

1. **Base de cálculo:** o motor mês a mês atual (`montarCronogramaDesembolso.ts`) continua sendo
   a "verdade" do custo por competência. A US-142 adiciona uma camada de **agregação em
   parcelas** por cima dele.
2. **Datas das parcelas:**
   - Datas regulares: a partir do `mesInicialRepasse`, espaçadas de `12 ÷ parcelasPorAno` meses,
     repetindo a cada ano, mantendo apenas as que caem em `[primeiroDiaDoMes(dataInicio), fimMes]`.
   - Data de entrada: o mês de `dataInicio`.
   - `datas = ordenarÚnico([entrada, ...regulares])` — se a entrada já é uma data regular, conta
     **uma vez só** (T1 fica com "Etapas 1 e 2").
   - Numerar T1, T2, ... Tn cronologicamente.
3. **Período coberto por cada parcela (ANTECIPADO):** de `Dk` (inclusive) até o mês anterior a
   `D(k+1)`. T1 cobre `[dataInicio, D2 − 1 mês]`. A última parcela cobre `[Dn, dataFim]`.
4. **Valor da parcela:** soma dos `desembolsoMensal` (motor atual) dos meses do seu período.
5. **Sub-linha por parcela:** uma linha `"Evento Tn Meta 01"` = valor cheio da parcela.
6. **Total geral = Valor Global da Proposta** (RN_CD_002). Resíduo de arredondamento (centavos)
   vai para a última parcela.
7. **Subtotais anuais:** linha `ANO XXXX / TOTAL A DESEMBOLSAR EM XXXX` ao fim de cada **ano
   civil** com parcelas — soma do ano, acumulado, % acumulado e (coluna 7) o acumulado repetido.
8. **Etapa (texto da descrição):** contador de Etapa = posição na lista `[entrada, regular₁,
   regular₂, ...]` (entrada = Etapa 1). T1 = "Etapas 1 e 2" quando a entrada coincide com
   regular₁; senão "Etapa 1". Tn (n≥2) = "Etapa (n + deslocamento)", deslocamento = 1 se T1 é
   fusão, 0 se não.

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

**Cenário 1 — Geração do cronograma (caso ANEXO 9: início coincide com o 1º repasse)**
```gherkin
Dado que a Proposta tem versão ativa, dados financeiros e Valor Global R$ 194.981.162,00
E a vigência começa em 2026-01 (janeiro/2026)
E parcelasPorAno = 3 e mesInicialRepasse = 1 (janeiro) → repasses em jan / mai / set
Quando o usuário abre a guia Cronograma de Desembolso
Então a entrada (jan) coincide com o 1º repasse → T1 = janeiro/2026 com descrição "1ª parcela relativa às Etapas 1 e 2 do Cronograma Físico"
E T2 = maio/2026 "2ª parcela relativa à Etapa 3 do Cronograma Físico"; T3 = setembro/2026 "3ª parcela relativa à Etapa 4..."; ... ; T14 = maio/2030 "14ª parcela relativa à Etapa 15..."
E cada Tn tem uma sub-linha "Evento Tn Meta 01" repetindo o valor da parcela na coluna DESEMBOLSO MENSAL
E T1 paga jan–abr/2026 (+ toda a mobilização/viagens/bens, CD-06); T2 paga mai–ago/2026; T3 paga set–dez/2026
E ao fim de 2026 há a linha "ANO 2026 / TOTAL A DESEMBOLSAR EM 2026" com soma do ano, acumulado, % e a coluna "VALOR ACUMULADO POR ANO DO TP" = o acumulado
E a última linha é "ANOS 2026, 2027, 2028, 2029 E 2030 / TOTAL A DESEMBOLSAR EM ..." = R$ 194.981.162,00
E nenhum campo é editável [ORIGEM BLINDADA / RN_CD_001]
E a operação é registrada em HistoricoOperacao
```

**Cenário 1b — Início NÃO coincide com o 1º repasse**
```gherkin
Dado que parcelasPorAno = 2 e mesInicialRepasse = 3 (março) → repasses em mar / set
E dataInicio em 2020-05 (maio)
Quando o cronograma é gerado
Então T1 = maio/2020 (entrada) "1ª parcela relativa à Etapa 1 do Cronograma Físico"
E T2 = setembro/2020 "2ª parcela relativa à Etapa 2..."; T3 = março/2021 "3ª parcela relativa à Etapa 3..."
E não há deslocamento de Etapa (T1 é só a entrada, não fusão)
E T1 paga mai–ago/2020; T2 paga set/2020–fev/2021; T3 paga mar–ago/2021
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

**Cenário 5 — Exportação PDF/XLSX no layout ANEXO 9**
```gherkin
Dado que o cronograma de parcelas está renderizado
Quando o usuário aciona [Imprimir]/[PDF] ou [XLSX]
Então o arquivo gerado tem o cabeçalho "ANEXO 9 / CRONOGRAMA DE DESEMBOLSO", as 7 colunas, as parcelas, as sub-linhas "Evento Tn Meta 01", os subtotais anuais e o total geral
E a operação é registrada em HistoricoOperacao [RN0232]
```

**Cenário 6 — Config de repasse ausente**
```gherkin
Dado que a Proposta não tem parcelasPorAno / mesInicialRepasse preenchidos
Quando o cronograma é gerado
Então o sistema aplica o default parcelasPorAno = 3, mesInicialRepasse = 1 (janeiro) — não bloqueia [ADR-049 §A]
```

**Cenário 7 — Coluna "VALOR ACUMULADO POR ANO DO TERMO DE PARCERIA"**
```gherkin
Dado que o cronograma tem parcelas nos anos 2026 a 2030
Quando a tabela é montada
Então a coluna 7 fica VAZIA em todas as linhas de parcela e de sub-linha
E na linha "TOTAL A DESEMBOLSAR EM 2026" a coluna 7 mostra o Desembolso Acumulado ao fim de 2026
E o mesmo para cada linha "TOTAL A DESEMBOLSAR EM XXXX"
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

- [ ] Migration aditiva de `Proposta.parcelasPorAno` / `mesInicialRepasse` + CHECK — aplicada junto do merge
- [ ] Datas das parcelas corretas para os 2 casos (entrada coincide / não coincide com o 1º repasse)
- [ ] Período coberto = **antecipado** (Tk paga do seu mês até o mês antes de T(k+1); última até `dataFim`)
- [ ] Texto da Etapa correto ("Etapas 1 e 2" só quando há fusão; deslocamento de +1 nas demais)
- [ ] Sub-linha "Evento Tn Meta 01" com o valor da parcela
- [ ] Soma das parcelas = Valor Global exatamente (resíduo na última) — **teste de regressão vs acumulado do motor mensal**
- [ ] Subtotais anuais (soma / acumulado / % / coluna 7 = acumulado) + linha de total geral
- [ ] % Financeiro Acumulado com 2 casas Half-Even (RN0252)
- [ ] Bloqueio "sem dados financeiros" (Fluxo E1) preservado
- [ ] Filtro de período client-side (recorta exibição, não recalcula) + nota na tela
- [ ] Exportação PDF/XLSX no layout ANEXO 9 (7 colunas, subtotais, total geral, cabeçalho)
- [ ] HistoricoOperacao registrada
- [ ] Nenhum campo editável na tela de Cronograma (RN_CD_001 / ORIGEM BLINDADA)
- [ ] `montarCronogramaDesembolso.ts` e `calcularCustoEstimadoViagem.ts` inalterados
