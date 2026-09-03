# Backlog — Épico "Aplicação Automática de Impostos sobre Contas"

**Épico:** `docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md`
**ADR:** `docs/ADR-050 - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md` (Aceito, substitui ADR-039)
**Módulo SGO:** Orçamentário / Cadastros — Rateio de Impostos
**Origem:** pedido do usuário 2026-09-02 ("aplicar impostos sobre contas analíticas e/ou sintéticas")

---

## Ordem de prioridade

| # | US | Título | Prioridade | Estimativa | Depende de | Risco |
|---|---|---|---|---|---|---|
| 1 | **US-144** | Motor de Cálculo Automático de Imposto (Conta Analítica) | 🔴 Alta | G | ADR-050 ✅ | Médio |
| 2 | **US-145** | Imposto sobre Conta Sintética | 🔴 Alta | M | US-144 | **Alto** |
| 3 | **US-146** | Exibir "Custo" e "Custo c/ Impostos" | 🟡 Média | M | US-144 | Baixo |
| — | US-147 | Separar Tributo de Índice de Reajuste | ⚪ Opcional | G | — | Médio |

---

## Justificativa da ordem

### 1º — US-144 (não há discussão)

É o **motor**. Traz a migration aditiva (`modoValor`, `valorBaseSnapshot`,
`AliquotaImpostoParametro.categoria`), o botão "Gerar Impostos da Versão", o cálculo
`base × alíquota%` sobre analíticas, o congelamento pós-oficialização e a imunidade de TP.
**US-145 e US-146 dependem 100% dela** — nenhuma das duas tem o que fazer sem o motor e sem as
colunas novas. Entrega sozinha o valor central: fim da digitação manual mês a mês.

### 2º — US-145 (Imposto sobre Conta Sintética)

Faz parte do **pedido original explícito** do usuário ("analíticas **e/ou sintéticas**") — não é
polimento, é escopo. Por isso vem antes da US-146, mesmo sendo a de **maior risco técnico**: ela
quebra de propósito a invariante "sintética = soma pura das filhas" e mexe no núcleo de agregação
do `CalcularValorRealizadoUseCase` (que alimenta Semáforo, dashboard US-118 e Cronograma).

> **Mitigação obrigatória antes de começar a US-145:** blindar `CalcularValorRealizadoUseCase` /
> `ValorRealizadoService` com testes de regressão do estado atual (agregação bottom-up pura),
> para que a nova fase C1 não introduza divergência silenciosa nos totais.

### 3º — US-146 (Exibir "Custo" / "Custo c/ Impostos")

**Menor risco** (zero schema, zero migration, % e cor do Semáforo inalterados — só adiciona um
número ao lado). É **enhancement**: o usuário concordou, mas não pediu. Vem por último porque:
- o valor entregue depende de já existir imposto calculado (US-144) e, para o caso da sintética,
  da US-145;
- adiar não bloqueia nada — quem quiser ver a carga tributária pode abrir a memória de cálculo.

> **Alternativa "risco primeiro"** (se o time preferir estabilizar antes da quebra de
> invariante): **US-144 → US-146 → US-145**. Perde-se um pouco de aderência ao pedido original,
> ganha-se uma janela de produção com o motor + a exibição rodando antes de tocar a agregação.
> Recomendação AN/PO: seguir a ordem principal (144 → 145 → 146) **se** a suíte de regressão do
> `CalcularValorRealizadoUseCase` já estiver robusta; senão, usar a alternativa.

---

## Tabela de dependências

```
ADR-050 (aceito)
   │
   ▼
US-144  ── migration (modoValor, valorBaseSnapshot, categoria)
   │        motor: base × alíquota%, botão "Gerar Impostos", congelamento, imunidade TP
   ├──────────────► US-145  (contaId aceita sintética; fase C1 pós-agregação; flag temImpostoDireto)
   └──────────────► US-146  (BadgeSemaforoConta + dashboard US-118 com 2 valores)

US-147 (opcional, independente) — só se a coexistência tributo/índice-de-reajuste
        na mesma tabela voltar a gerar bug depois da US-144.
```

- **US-145 e US-146 são paralelizáveis** entre si depois da US-144 (não dependem uma da outra),
  mas o Cenário 4 da US-146 ("sintética com imposto direto") só fecha quando a US-145 existe.
- **Nenhuma das 3** bloqueia US-128/US-129 (reajuste) — ADR-050 Decisão A1 preserva a coexistência.

---

## Roadmap por iteração

### Iteração 1 — "O motor funciona" (US-144)
**Entrega:** o orçamentista abre a Versão, clica em "Gerar Impostos", e o sistema calcula e grava
o imposto de cada tributo sobre cada conta analítica, com base no custo atual. As linhas manuais
e as de reajuste ficam intactas.
**Sai à produção:** migration aditiva aplicada junto do merge + backfill revisado de
`categoria = INDICE_REAJUSTE`.
**DoD do épico coberto:** cálculo automático (analíticas), sem cascata, congelamento, imunidade
TP, auditoria `IMPOSTOS_GERADOS`, motor de reajuste sem regressão.

### Iteração 2 — "Imposto sobre grupo de contas" (US-145)
**Pré-requisito:** suíte de regressão do `CalcularValorRealizadoUseCase` verde e cobrindo a
agregação bottom-up pura.
**Entrega:** o usuário aplica um tributo diretamente sobre uma conta sintética; o valor ajusta a
própria sintética (C1); a tela sinaliza que aquele total não é a soma pura das filhas.
**Risco monitorado:** divergência de totais no Semáforo / dashboard / Cronograma — validar em
homologação com uma Proposta real que tenha imposto em analítica **e** em sintética.

### Iteração 3 — "Visibilidade da carga tributária" (US-146)
**Entrega:** cada conta passa a exibir "Custo" e "Custo c/ Impostos" lado a lado, no Badge do
Semáforo e no dashboard da guia Valor Orçado. Regra do % e da cor **inalterada**.
**Teste-chave:** regressão do Cenário 5 — nenhuma conta muda de percentual/cor só por causa
desta US.

### Iteração 4 (condicional) — "Higiene do modelo" (US-147)
Só entra se, em produção, a convivência de tributo e índice de reajuste na mesma
`AliquotaImpostoParametro` / `RateioImpostoGrade` voltar a causar bug ou confusão de manutenção.
Separa os dois em modelos/telas distintos. Reversão do reaproveitamento do ADR-040.

---

## Critérios de saída do épico

- [ ] Imposto calculado automaticamente (`base × Σ alíquotas`, sem cascata) por Proposta × Versão × Conta
- [ ] Base = Empregados + Viagens + Bens da conta, sem o próprio imposto (ADR-050 A1)
- [ ] Conta **sintética** aceita como alvo, com ajuste direto (C1) e a quebra de invariante sinalizada
- [ ] Congelamento pós-OFICIALIZADO preservado (D1 / RN_TAX_03/06)
- [ ] Imunidade de TP (PIS/COFINS) respeitada também no cálculo automático (backend)
- [ ] "Custo" e "Custo c/ Impostos" visíveis onde o valor da conta aparece
- [ ] % e cor do Semáforo e Valor Global **inalterados** (seguem "com imposto")
- [ ] Motor de reajuste (ADR-040 / US-128/129) sem regressão — suíte verde
- [ ] Linhas `DECLARADO` (manuais e de reajuste) comprovadamente intactas após "Gerar Impostos"
- [ ] Migração aditiva aplicada em produção junto do merge de cada PR (lição US-141)

---

## Rastreabilidade

| Artefato | Papel |
|---|---|
| `docs/EPICO - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md` | Descoberta, 8 decisões de negócio, conflitos C-IMP-01..07 |
| `docs/ADR-050 - Aplicacao Automatica de Impostos sobre Contas.pt-BR.md` | Decisões técnicas (Frentes A–H), DDL da migration |
| `docs/ADR-039 ...` | Substituído por ADR-050 — só registro histórico |
| `docs/US-144 / US-145 / US-146 ...` | Histórias com Critérios de Aceite Gherkin |
| `docs/US-101 ...`, `docs/US-123` a `US-127` | Rateio de Impostos e Catálogo de Alíquotas atuais (base) |
| `docs/ADR-027`, `ADR-038`, `ADR-040` | Contexto do modelo atual e do reaproveitamento por Reajustes |
