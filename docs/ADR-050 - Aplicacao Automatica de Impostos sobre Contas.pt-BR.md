## ADR-050: Aplicação Automática de Impostos sobre Contas (Analíticas e Sintéticas)

**Status**: Aceito
**Data**: 2026-09-02
**Módulo SGO**: Orçamentário / Cadastros — Rateio de Impostos (evolução de US-101 / ADR-027 / ADR-038)
**Substitui**: ADR-039 ("Cálculo Composto de Impostos") — a decisão do usuário foi **sem
composição**, então o título e as Decisões B do ADR-039 não valem mais. ADR-039 nunca foi aceito.

**Contexto**: hoje o Rateio de Impostos é **declaração manual** — o orçamentista digita
`RateioImpostoGrade.valorDeclarado` e `aliquotaAplicadaSnapshot` é só registro. O usuário quer
que o sistema **calcule o imposto automaticamente** (`imposto = base da conta × alíquota%`), por
Proposta × Versão × Conta × competência, sobre contas **analíticas ou sintéticas**. As 8 decisões
de negócio estão fechadas (ver `docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md`).
Este ADR fecha 8 frentes técnicas.

Restrições que pesam: (1) `RateioImpostoGrade` e `AliquotaImpostoParametro` são **compartilhados**
com o motor de Premissas/Reajustes (ADR-040, US-128/129) — mexer no significado de `valorDeclarado`
tem raio de impacto; (2) ADR-027 cravou `contaId` **analítica obrigatória** — aplicar em sintética
conflita; (3) `ValorRealizadoService` (Semáforo, dashboard US-118) agrega **bottom-up** e assume
"sintética = soma das filhas"; (4) ambiente sem `.env` — migration à mão, aplicada **junto do
merge** do PR (lição US-141: senão dá 500).

---

### Frente A — Modelo de dados

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| **A1 — `RateioImpostoGrade` ganha `modoValor` enum + `valorBaseSnapshot`** ✅ | Menor migração; grão intacto; reajuste (US-128/129) não muda (continua `DECLARADO`); `ValorRealizadoService` lê 1 tabela só | Mantém a sobrecarga imposto/reajuste na mesma tabela (dívida do ADR-040, não desta US) | Alta (migração aditiva) |
| A2 — modelo novo `ImpostoAplicadoConta`, `RateioImpostoGrade` só p/ reajuste | Separa imposto de reajuste de vez | Migra dados de US-101; `ValorRealizadoService` lê 2 tabelas; a US-101 "manual" e a US-144 "automático" são o **mesmo conceito** (imposto na conta) — dividir é artificial | Baixa |
| A3 — modelo novo `ImpostoAplicadoConta` p/ TODO imposto (manual + auto), migra US-101 | "Clean break" imposto × reajuste | Reescreve US-101/123-127 já em produção; XG | Baixa |

**Decisão: A1.** `RateioImpostoGrade` ganha:

```prisma
enum ModoValorRateioImposto {
  DECLARADO   // usuário digitou (US-101) ou ajuste de reajuste (US-128/129, ADR-040)
  CALCULADO   // sistema calculou base × alíquota% (US-144+)
}

model RateioImpostoGrade {
  // ... campos existentes ...
  modoValor         ModoValorRateioImposto @default(DECLARADO)
  /// US-144 — base sobre a qual o imposto CALCULADO incidiu (custo bruto da conta na geração).
  /// NULL para linhas DECLARADO. Snapshot — não recalcula sozinho.
  valorBaseSnapshot Decimal?               @db.Decimal(15, 2)
}
```

- `valorDeclarado` continua sendo **o valor final** (o que `ValorRealizadoService` soma) — só muda
  a origem: digitado vs `valorBaseSnapshot × aliquotaAplicadaSnapshot / 100`.
- **A sobrecarga com reajuste sobrevive** (Frente G) porque a linha de ajuste de reajuste é
  semanticamente um valor *declarado pelo motor de reajuste*, não `base × %` — fica `DECLARADO`.

DDL (§DDL). Rollback: `DROP COLUMN modoValor, valorBaseSnapshot; DROP TYPE ModoValorRateioImposto`.

---

### Frente B — `contaId` analítica **ou** sintética (Decisão C1)

**Decisão:** relaxar a validação — `contaId` aceita conta **analítica ou sintética** (existente,
do tenant). `ContaRateioImpostoNaoAnaliticaError` vira `ContaRateioImpostoInvalidaError`
("conta não encontrada / inativa"). Sem CHECK novo no banco (a validação é de aplicação, como
`Cargo.contaId`).

**Cálculo do realizado — nova fase pós-agregação:**

```
CalcularValorRealizadoUseCase:
  1. somarCustoBrutoPorConta(analíticas)        // Viagem + Item + Empregado (SEM rateios)  ← §C
  2. agregar bottom-up  → valor bruto de cada sintética = Σ filhas
  3. NOVA FASE: para cada RateioImpostoGrade (modoValor qualquer) cuja contaId é:
       - analítica  → soma valorDeclarado na conta (como hoje)
       - sintética  → soma valorDeclarado DIRETO no valor agregado da sintética (C1)
  4. resultado: valorRealizadoComImposto por conta; valorRealizadoSemImposto = passo 2
```

- A invariante **"sintética = soma pura das filhas" quebra** de propósito para sintéticas com
  imposto direto. Não usar o flag `parcial` do badge (é sobre cobertura de fontes, semântica
  diferente). Em vez disso: novo flag `temImpostoDireto: boolean` no `BadgeSemaforoConta` +
  **nota na tela/dashboard** quando `true`: *"Esta conta tem imposto aplicado diretamente sobre
  ela — o total não é a soma pura das contas analíticas."*
- Serviço: uma função nova em `ValorRealizadoService` (`aplicarImpostosPorConta(mapaBruto,
  rateios, hierarquia)`), não um serviço separado — o cálculo já vive lá.

---

### Frente C — Base de cálculo (Decisão A1: Empregados + Viagens + Bens, sem imposto)

| Opção | Prós | Contras |
|---|---|---|
| **C-total — base = custo total da conta** ✅ | `ValorRealizadoService` já computa isso; 1 linha de imposto por (conta × alíquota); simples | Não distribui o imposto por mês |
| C-mensal — base por competência (reusar `montarCronogramaDesembolso`) | Imposto mês a mês | Acopla imposto ao motor do cronograma; N linhas por (conta × alíquota); complexidade alta sem pedido |

**Decisão: C-total.** A geração de imposto automático produz **1 linha** `RateioImpostoGrade` por
`(versão × alíquota × conta)`, `competencia` = **`Proposta.dataInicio`** (coerente com US-101
Cenário 2, que injeta a alíquota vigente na data de início), `valorBaseSnapshot` = custo bruto
total da conta naquele instante, `valorDeclarado` = `base × aliquotaPct / 100`,
`aliquotaAplicadaSnapshot` = `aliquotaPct` vigente.

- Nova função `ValorRealizadoService.somarCustoBrutoPorConta(tenantId, versaoId)` = igual a
  `somarPorContaAnalitica` **sem** o bloco de `rateioImpostoGrade`. Refatorar a atual para chamar
  esta + somar os rateios por cima (evita duplicar as 3 fontes).
- **Se o negócio exigir imposto por mês depois** → evolução (C-mensal), não retrabalho: a linha
  única vira N linhas, o resto do desenho aguenta.

---

### Frente D — Gatilho de recálculo

| Opção | Prós | Contras |
|---|---|---|
| **D-botão — "Gerar / Recalcular Impostos" explícito** ✅ | Simples; sem N pontos de invalidação (cada save de Empregado/Viagem/Item/Cargo teria que disparar); transação única e auditável | O valor de imposto pode ficar **desatualizado** vs o custo atual |
| D-síncrono — recalcula a cada mudança de custo | Sempre consistente | Muitos gatilhos; risco de recálculo parcial; performance; acopla tudo ao motor de imposto |

**Decisão: D-botão.** Um botão "Gerar Impostos da Versão" (ou por conta). Ao rodar: apaga
(soft-delete) as linhas `CALCULADO` daquela `(versão × alíquota × conta)` e recria com a base
atual, tudo em 1 transação + `HistoricoOperacao`.

- **Aviso de stale:** a tela compara o maior `updatedAt` entre Empregado/Viagem/Item/Cargo da
  versão com o `updatedAt` das linhas `CALCULADO`; se as fontes forem mais novas, mostra
  *"Os custos mudaram desde o último cálculo de impostos — clique em Gerar Impostos para
  atualizar."* Não bloqueia nada, só alerta.
- Linhas `DECLARADO` (manuais / reajuste) **nunca** são tocadas pelo botão.

---

### Frente E — Dados existentes

**Decisão: grandfather total.** Migração só adiciona colunas com `modoValor = DECLARADO` (default)
e `valorBaseSnapshot = NULL`. **Nada recalcula.** As linhas de US-101 (manuais) e US-128/129
(reajuste) continuam idênticas e funcionais. O usuário migra uma Proposta para o modo automático
**quando quiser**, rodando "Gerar Impostos" — o que soft-deleta as linhas `DECLARADO` daquela
`(alíquota × conta)` e cria as `CALCULADO`. Reversível: reativar as `DECLARADO`.

---

### Frente F — "sem imposto" / "com imposto" (Decisão 7)

**Decisão:** **comportamento atual preservado** — Semáforo e Valor Global seguem sobre o valor
**com imposto** (hoje `ValorRealizadoService` já inclui `RateioImpostoGrade.valorDeclarado` na
soma; nada muda aí). O **"sem imposto"** é o número **novo**, exibido ao lado.

- `BadgeSemaforoConta` ganha `valorRealizadoSemImposto: Prisma.Decimal` (o passo 2 do §B). O
  `valorRealizado` existente passa a se chamar, na doc, "com imposto" (mesmo número de hoje).
- `%` do Semáforo e cor: continuam sobre `valorRealizado` (com imposto) vs `valorOrcado` — sem
  mudança de regra, evita reabrir US-008a/ADR-032.
- Dashboard US-118 e a guia Valor Orçado: exibir as duas colunas ("Custo" e "Custo c/ Impostos").
- Serialização: o tipo serializado do badge e do dashboard ganham o campo novo; propagar.

---

### Frente G — Impacto no ADR-040 (reajuste)

Com a Decisão A1 (tabela compartilhada + `modoValor`, reajuste fica `DECLARADO`), o
reaproveitamento **sobrevive intacto**. `prepararPlanoReajuste` / `AplicarReajusteUseCase` não
mudam. **US-147 (separar imposto de índice de reajuste em modelos distintos) fica como dívida
técnica registrada, NÃO bloqueia US-144.** Revisitar se a convivência voltar a doer.

> ⚠️ Ponto de atenção para o dev: o botão "Gerar Impostos" (§D) só apaga/recria linhas
> `CALCULADO` **cujo `aliquotaParametroId` é de um tributo** — nunca linhas de um índice de
> reajuste. Como o catálogo não distingue "tributo" de "índice", a US-144 precisa de um filtro
> (ex.: só alíquotas com `limiteMinimoPct/limiteMaximoPct` OU nome em lista de tributos, OU um
> campo `ehTributo` novo em `AliquotaImpostoParametro`). **Recomendação:** adicionar
> `AliquotaImpostoParametro.categoria` enum (`TRIBUTO` | `INDICE_REAJUSTE`) na mesma migração —
> resolve a ambiguidade de vez, custo baixo, e é o primeiro passo natural da US-147.

---

### Frente H — Transversais

- **Multi-tenant:** todas as queries novas com `tenantId` no `where`. Nada global.
- **Transação/lock:** "Gerar Impostos" = 1 `$transaction` (soft-delete + create em lote +
  `HistoricoOperacao`), mesmo padrão de `ConfigurarRateioImpostoUseCase`. Optimistic lock por
  `updatedAt` da versão, como US-007/US-105.
- **Congelamento (Decisão D1):** "Gerar Impostos" rejeita se a versão não está
  `RASCUNHO`/`EM_ELABORACAO` (`VersaoOficializadaCongeladaError`, já existe). Ao oficializar, as
  linhas `CALCULADO` viram snapshot fixo — nenhum recálculo pós-oficialização.
- **Imunidade TP (Decisão 8):** o gerador pula (ou rejeita) alíquotas `tipoIncidencia = CONTRATO`
  quando `Proposta.tipo = TERMO_DE_PARCERIA` — `ImpostoNaoDisponivelParaTipoPropostaError`, já
  existe, aplicar também no fluxo automático.
- **Auditoria:** `HistoricoOperacao` tipo novo `IMPOSTOS_GERADOS` com `dadosSerializados` =
  { versaoId, contas afetadas, alíquotas, valorBase e valorImposto por linha, quantas linhas
  DECLARADO foram substituídas }.

---

### DDL da migration

```sql
-- Migration: add_modo_valor_rateio_imposto_e_categoria_aliquota  (EPICO Impostos / ADR-050 / US-144)
-- Risco: BAIXO — enums + colunas nullable/com default. Nenhum recálculo, nenhum dado alterado.

CREATE TYPE "ModoValorRateioImposto" AS ENUM ('DECLARADO', 'CALCULADO');
ALTER TABLE "RateioImpostoGrade"
  ADD COLUMN "modoValor" "ModoValorRateioImposto" NOT NULL DEFAULT 'DECLARADO',
  ADD COLUMN "valorBaseSnapshot" DECIMAL(15,2);

CREATE TYPE "CategoriaAliquotaImposto" AS ENUM ('TRIBUTO', 'INDICE_REAJUSTE');
ALTER TABLE "AliquotaImpostoParametro"
  ADD COLUMN "categoria" "CategoriaAliquotaImposto" NOT NULL DEFAULT 'TRIBUTO';
-- Backfill manual sugerido (o usuário revisa quais alíquotas são índice de reajuste):
--   UPDATE "AliquotaImpostoParametro" SET "categoria" = 'INDICE_REAJUSTE' WHERE "nome" ILIKE ANY (ARRAY['%IPCA%','%INPC%','%IGP%','%dissídio%','%dissidio%','%reajuste%']);

-- Rollback:
--   ALTER TABLE "AliquotaImpostoParametro" DROP COLUMN "categoria";
--   ALTER TABLE "RateioImpostoGrade" DROP COLUMN "valorBaseSnapshot", DROP COLUMN "modoValor";
--   DROP TYPE "CategoriaAliquotaImposto"; DROP TYPE "ModoValorRateioImposto";
```

---

### Decisão (resumo)

A1 (coluna `modoValor` + `valorBaseSnapshot`, sem modelo novo) · B (contaId analítica ou
sintética, nova fase pós-agregação, invariante da sintética quebra com aviso) · C-total (base =
custo total, 1 linha por conta×alíquota, competência = dataInicio) · D-botão ("Gerar Impostos"
explícito + aviso de stale) · E (grandfather total, zero recálculo na migração) · F (Semáforo/
Valor Global seguem "com imposto" como hoje; "sem imposto" é número novo ao lado) · G (reajuste
intacto; `AliquotaImpostoParametro.categoria` resolve a ambiguidade tributo/índice).

### Consequências

- ✅ Cálculo automático sem quebrar US-101/123-127/128/129 nem o motor de reajuste.
- ✅ Migração 100% aditiva e reversível; zero recálculo.
- ✅ Semáforo/US-008a/ADR-032 não reabrem (regra do % inalterada).
- ⚠️ **Invariante "sintética = soma das filhas" deixa de valer** para sintética com imposto
  direto — mitigado por flag + nota, mas é conceito que os devs terão que internalizar.
- ⚠️ Imposto **pode ficar stale** (Decisão D) — mitigado pelo aviso; aceito como custo de não
  acoplar tudo ao motor de imposto.
- ⚠️ `categoria` em `AliquotaImpostoParametro` precisa de backfill revisado pelo usuário — uma
  alíquota classificada errado gera/não gera imposto indevidamente.
- ⚠️ Muda motor financeiro + schema → **branch + PR + `/code-review`**; migration **junto do merge**.

### Reversibilidade

**Média-baixa.** A migração é aditiva e dropável enquanto a US-144 não estiver em produção.
Depois: propostas com linhas `CALCULADO`, o Valor Global refletindo imposto automático e a
invariante da sintética relaxada tornam a volta cara — não técnica, mas de reconciliação de dados
e de expectativa do usuário.

### Revisão recomendada

Reavaliar quando: (a) o negócio pedir imposto **por competência** → C-mensal; (b) a convivência
imposto/reajuste na mesma tabela voltar a gerar bug → executar US-147 (separação); (c) o aviso de
"stale" se mostrar insuficiente em homologação → considerar recálculo síncrono em pontos-chave.
