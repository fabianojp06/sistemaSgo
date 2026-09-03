# US-144 — Motor de Cálculo Automático de Imposto (Conta Analítica)

**Módulo:** Orçamentário / Cadastros — Rateio de Impostos
**Épico:** Aplicação Automática de Impostos sobre Contas (`docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md`)
**Prioridade:** Alta
**Estimativa:** G
**Status:** 🔜 Pronta para o `fullstack-dev` — **ADR-050 aceito** (todas as decisões técnicas fechadas)
**É o MVP do épico.**

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** que o sistema **calcule automaticamente** o valor dos impostos que incidem sobre as
contas analíticas de uma Versão da Proposta (`imposto = custo da conta × alíquota%`), em vez de
eu digitar cada valor mês a mês,
**Para** eliminar o retrabalho e o risco de erro de digitação na memória de cálculo fiscal,
mantendo a rastreabilidade da base e da alíquota aplicadas. [RF_TAX_001, RF_TAX_002, ADR-050]

---

## Contexto e Regras de Negócio

Hoje (US-101) o Rateio de Impostos é **declaração manual**: o usuário digita
`RateioImpostoGrade.valorDeclarado` e a alíquota é só registro histórico
(`aliquotaAplicadaSnapshot`, nunca participa de cálculo). Esta US transforma a peça num **motor
de cálculo**: o usuário aciona **"Gerar Impostos da Versão"** e o sistema calcula e grava os
valores.

### Modelo de dados (ADR-050 Frente A)

`RateioImpostoGrade` ganha:
- `modoValor` enum `DECLARADO | CALCULADO` (default `DECLARADO`).
- `valorBaseSnapshot Decimal(15,2)?` — a base sobre a qual o imposto CALCULADO incidiu; `NULL`
  para linhas `DECLARADO`.

`AliquotaImpostoParametro` ganha:
- `categoria` enum `TRIBUTO | INDICE_REAJUSTE` (default `TRIBUTO`) — separa o catálogo de
  tributos (PIS, COFINS, ISS...) do catálogo de índices de reajuste (IPCA, dissídio...) que
  compartilham a mesma tabela (ADR-040). **Só alíquotas `TRIBUTO` geram imposto.**

A migração é **aditiva e não recalcula nada** — as linhas atuais viram `DECLARADO` e continuam
funcionando (grandfather total, ADR-050 Frente E). As linhas de reajuste (US-128/129) também
ficam `DECLARADO` e **nunca** são tocadas pelo motor de imposto.

### RN_TAX_10 — Cálculo do imposto automático

Ao acionar "Gerar Impostos da Versão", para **cada par (alíquota `categoria=TRIBUTO` × conta
analítica)** no escopo:

1. **Base** = custo bruto total da conta na Versão = soma de Empregado + Viagem + ItemPatrimonial
   atribuídos àquela conta, **excluindo qualquer `RateioImpostoGrade`** (evita referência
   circular — ADR-050 Frente C, decisão A1 do usuário).
2. **`imposto = base × (aliquotaPct / 100)`**, arredondado a 2 casas (Half-Even).
3. **`competencia`** da linha gerada = `Proposta.dataInicio` (coerente com US-101 Cenário 2 —
   alíquota vigente é a da data de início).
4. **`aliquotaAplicadaSnapshot`** = `aliquotaPct` da `AliquotaImpostoParametro` **vigente em
   `Proposta.dataInicio`**.
5. Grava **1 linha** `RateioImpostoGrade` por `(versão × alíquota × conta)` com
   `modoValor = CALCULADO`, `valorBaseSnapshot = base`, `valorDeclarado = imposto`.

### RN_TAX_11 — Dois ou mais impostos sobre a mesma conta

Cada imposto incide sobre a **mesma base bruta** — **não há composição/cascata**. Se PIS 9,25% e
ISS 3,00% incidem sobre a conta X com base R$ 100.000,00: PIS = R$ 9.250,00, ISS = R$ 3.000,00,
total de imposto da conta = R$ 12.250,00 (duas linhas independentes). Sem ordem de aplicação,
sem regra de desempate. [ADR-050 Frente A; decisão 4 do usuário]

### RN_TAX_12 — Substituição das linhas CALCULADO, preservação das DECLARADO

Ao gerar impostos, o sistema **soft-deleta** (`ativo = false`) as linhas `modoValor = CALCULADO`
existentes para os pares `(alíquota × conta)` sendo recalculados, e cria as novas. **Nunca** toca
linhas `modoValor = DECLARADO` — nem manuais (US-101), nem ajustes de reajuste (US-128/129). Um
par `(alíquota × conta)` que tenha linha `DECLARADO` manual **e** passe a ter `CALCULADO`
somará as duas em `ValorRealizadoService` (comportamento aceito — o usuário decide remover a
manual se quiser).

### RN_TAX_03/06 — Congelamento (preservada, ADR-050 Frente H)

"Gerar Impostos" só roda em Versão `RASCUNHO` ou `EM_ELABORACAO`. Em `OFICIALIZADO`/`ENCERRADO`,
rejeita — as linhas `CALCULADO` já gravadas viram snapshot definitivo e nunca recalculam.

### RN_PRO_010 — Imunidade de Termo de Parceria (preservada)

Quando `Proposta.tipo = TERMO_DE_PARCERIA`, o motor **pula** as alíquotas com
`tipoIncidencia = CONTRATO` (PIS, COFINS) — não gera imposto para elas, nem via cálculo, nem por
chamada direta ao backend. Só `tipoIncidencia` `TERMO_DE_PARCERIA` ou `AMBOS` geram (na prática:
ISS).

### RN_TAX_13 — Aviso de valores desatualizados ("stale")

A tela compara o maior `updatedAt` entre Empregado/Viagem/ItemPatrimonial/Cargo da Versão com o
`updatedAt` das linhas `CALCULADO` existentes. Se as fontes de custo forem mais novas, exibe um
aviso não-bloqueante: **"Os custos desta Versão mudaram desde o último cálculo de impostos.
Clique em Gerar Impostos para atualizar."**

---

## Critérios de Aceite

**Cenário 1 — Geração automática bem-sucedida (Contrato)**
```gherkin
Dado que o usuário está autenticado com perfil de escrita no módulo orçamentário
E a Proposta é do tipo CONTRATO e sua Versão vigente está em RASCUNHO
E a conta analítica "3.1.01 - Pessoal" tem custo bruto de R$ 200.000,00 (Empregados + Viagens + Bens)
E existe a alíquota "PIS" (categoria TRIBUTO, 9,25%, tipoIncidencia AMBOS) vigente na data de início da Proposta
E a conta "3.1.01" está vinculada a essa alíquota no rateio
Quando o usuário aciona [Gerar Impostos da Versão]
Então o sistema cria uma linha RateioImpostoGrade para (versão, PIS, 3.1.01, competência = dataInicio) com modoValor = CALCULADO, valorBaseSnapshot = 200000,00, aliquotaAplicadaSnapshot = 9,2500 e valorDeclarado = 18.500,00
E o Valor Global da Proposta é recalculado incluindo esse imposto
E um log é gravado em HistoricoOperacao com tipoOperacao = IMPOSTOS_GERADOS contendo base e imposto por linha
E a tela exibe "Impostos gerados: 1 linha, R$ 18.500,00"
```

**Cenário 2 — Dois impostos na mesma conta somam sem cascata (RN_TAX_11)**
```gherkin
Dado que a conta analítica "3.1.02 - Serviços" tem custo bruto de R$ 100.000,00
E incidem sobre ela as alíquotas "PIS" (9,25%) e "ISS" (3,00%), ambas categoria TRIBUTO e vigentes
Quando o usuário aciona [Gerar Impostos da Versão]
Então são criadas 2 linhas CALCULADO: PIS com valorDeclarado = 9.250,00 e ISS com valorDeclarado = 3.000,00
E ambas têm valorBaseSnapshot = 100.000,00 (a mesma base bruta)
E o imposto total da conta "3.1.02" é R$ 12.250,00
```

**Cenário 3 — Regerar substitui só as linhas CALCULADO (RN_TAX_12)**
```gherkin
Dado que a conta "3.1.01" já tem uma linha CALCULADO de PIS (base R$ 200.000,00, imposto R$ 18.500,00)
E existe também uma linha DECLARADO manual de ISS nessa conta (R$ 5.000,00, digitada na US-101)
E o custo bruto da conta subiu para R$ 220.000,00 (novo Empregado cadastrado)
Quando o usuário aciona [Gerar Impostos da Versão] novamente
Então a linha CALCULADO de PIS anterior é marcada ativo = false
E uma nova linha CALCULADO de PIS é criada com base R$ 220.000,00 e imposto R$ 20.350,00
E a linha DECLARADO de ISS (R$ 5.000,00) permanece intacta e ativa
```

**Cenário 4 — Termo de Parceria pula PIS e COFINS (RN_PRO_010)**
```gherkin
Dado que a Proposta é do tipo TERMO_DE_PARCERIA
E existem as alíquotas "PIS" e "COFINS" (tipoIncidencia CONTRATO) e "ISS" (tipoIncidencia AMBOS), todas categoria TRIBUTO
Quando o usuário aciona [Gerar Impostos da Versão]
Então nenhuma linha de PIS ou COFINS é criada (nem exibida como opção)
E somente a linha de ISS é calculada e gravada
E se uma chamada direta ao backend tentar gerar PIS/COFINS para este TP, o sistema rejeita com "Termos de Parceria possuem imunidade tributária — PIS e COFINS não podem ser aplicados (RN_PRO_010)."
```

**Cenário 5 — Alíquota categoria INDICE_REAJUSTE não gera imposto**
```gherkin
Dado que existe a alíquota "IPCA" com categoria = INDICE_REAJUSTE (usada por Premissas/Reajustes, US-128/129)
E ela está vinculada a contas via RateioImpostoGrade (linhas de reajuste, modoValor DECLARADO)
Quando o usuário aciona [Gerar Impostos da Versão]
Então o "IPCA" é ignorado pelo motor — nenhuma linha CALCULADO é gerada para ele
E as linhas de reajuste DECLARADO do IPCA permanecem intactas
```

**Cenário 6 — Versão Oficializada bloqueia a geração [TRAVA O ERRO] (RN_TAX_03)**
```gherkin
Dado que a Versão vigente da Proposta está em status OFICIALIZADO
Quando o usuário aciona [Gerar Impostos da Versão]
Então o backend rejeita a operação com rollback imediato
E o sistema exibe: "Ação Negada [TRAVA O ERRO]: Esta Proposta está oficializada e seus dados fiscais estão congelados. Nenhuma alteração é permitida."
E nenhuma linha de RateioImpostoGrade é criada ou alterada
```

**Cenário 7 — Conta sem custo bruto gera imposto zero (ou é pulada)**
```gherkin
Dado que a conta analítica "3.1.09 - Reserva" não tem nenhum Empregado, Viagem ou Bem atribuído (custo bruto = R$ 0,00)
E incide sobre ela a alíquota "ISS" (3,00%)
Quando o usuário aciona [Gerar Impostos da Versão]
Então nenhuma linha CALCULADO é criada para (ISS, 3.1.09) — base zero não gera linha
E a operação não falha por causa disso
```

**Cenário 8 — Nenhum dado financeiro na Versão (Fluxo E1, preservado da US-122)**
```gherkin
Dado que a Versão não tem nenhum Empregado, Viagem, Bem nem alíquota vinculada
Quando o usuário abre a tela de Rateio de Impostos
Então o botão [Gerar Impostos da Versão] fica desabilitado
E o sistema exibe "Cadastre custos e vincule ao menos um tributo antes de gerar impostos."
```

**Cenário 9 — Aviso de valores desatualizados (RN_TAX_13)**
```gherkin
Dado que impostos já foram gerados para a Versão (linhas CALCULADO com updatedAt de ontem)
E um Empregado da Versão foi editado hoje (updatedAt mais recente que o das linhas CALCULADO)
Quando o usuário abre a tela de Rateio de Impostos
Então é exibido o aviso "Os custos desta Versão mudaram desde o último cálculo de impostos. Clique em Gerar Impostos para atualizar."
E o aviso não impede nenhuma outra ação da tela
```

---

## Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `RateioImpostoGrade` (+`modoValor`, `valorBaseSnapshot`); `AliquotaImpostoParametro` (+`categoria`); leitura de `Empregado`/`Viagem`/`ItemPatrimonial`/`Proposta`/`VersaoProposta`; `HistoricoOperacao` (INSERT) |
| Migration | **Aditiva** — 2 enums + 3 colunas com default. **Não recalcula nada.** DDL pronto no ADR-050 §DDL. Aplicar via SQL Editor do Supabase **junto do merge** do PR. Backfill manual de `categoria = INDICE_REAJUSTE` para as alíquotas que forem índice (o usuário revisa). |
| Motor de cálculo | Nova função de domínio `ValorRealizadoService.somarCustoBrutoPorConta(tenantId, versaoId)` = `somarPorContaAnalitica` **sem** o bloco de `rateioImpostoGrade`. Novo use case `GerarImpostosDaVersaoUseCase`. |
| Transação | Sim — 1 `$transaction`: soft-delete das CALCULADO antigas + createMany das novas + `HistoricoOperacao`. Rollback total em falha. |
| Requer lock? | Optimistic locking por `updatedAt` da Versão, mesmo padrão de US-007/US-105. |
| Regra de negócio | Congelamento pós-OFICIALIZADO; imunidade TP; só `categoria = TRIBUTO`; base exclui rateios; sem cascata; competência = `dataInicio`; alíquota vigente na `dataInicio` |
| Auditoria | `HistoricoOperacao` tipo `IMPOSTOS_GERADOS`: `{ versaoId, contasAfetadas[], porLinha: [{ aliquotaId, contaId, base, imposto, aliquotaPct }], linhasDeclaradoSubstituidas: 0 }` |

---

## Dependências

- **ADR-050** ✅ aceito.
- `AliquotaImpostoParametro` / `RateioImpostoGrade` / `ConfigurarRateioImpostoUseCase` (US-101, US-123-127) — base.
- `ValorRealizadoService` (ADR-032) — fonte da base bruta.
- **Não bloqueia** US-128/129 (reajuste) — a decisão A1 preserva a coexistência.
- Fluxo Git: migration + motor financeiro → **branch + PR + `/code-review`**; migration aplicada junto do merge.

## Definition of Done

- [ ] Cenários 1 a 9 implementados e aprovados em homologação
- [ ] Migration aditiva aplicada (2 enums + 3 colunas), sem recalcular dado existente
- [ ] Linhas `DECLARADO` (manuais e de reajuste) comprovadamente intactas após "Gerar Impostos" — teste de regressão
- [ ] Base bruta exclui `RateioImpostoGrade` (sem referência circular) — teste
- [ ] Dois impostos na mesma conta somam sem cascata — teste
- [ ] Congelamento pós-OFICIALIZADO bloqueia no backend (não só na UI)
- [ ] Imunidade de TP (PIS/COFINS) bloqueada nativamente para `TERMO_DE_PARCERIA`
- [ ] Alíquota `categoria = INDICE_REAJUSTE` nunca gera imposto — teste
- [ ] `HistoricoOperacao` gravada com base e imposto por linha
- [ ] Aviso de "stale" aparece quando as fontes de custo são mais novas que as linhas CALCULADO
- [ ] Motor de reajuste (US-128/129, `prepararPlanoReajuste`) não regride — suíte verde
