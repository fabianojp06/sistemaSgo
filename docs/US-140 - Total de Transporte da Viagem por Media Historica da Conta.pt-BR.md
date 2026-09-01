# US-140 — Total de Transporte da Viagem por média histórica da conta

**Módulo:** Cadastros / Propostas — Guia Viagens (US-109, UC03.29-33)
**Épico:** EP118-24 — Módulo de Cadastros
**Prioridade:** Baixa
**Estimativa:** G (bloqueada — ver dependências)
**Status:** 🔴 BLOQUEADA — não refinável até resolver a origem do dado histórico

**Como** analista da Gerência Financeira (GFIN) da CTCEA montando o orçamento de uma Proposta,
**Quero** que a tela de Viagens me mostre um valor de referência de transporte calculado pela
média histórica dos lançamentos da conta de transporte nos últimos anos,
**Para** eu ter um parâmetro objetivo de quanto costumamos gastar com transporte, em vez de
estimar o custo unitário de transporte no escuro.

---

## Contexto e regras de negócio

Hoje o componente **Transporte** do Custo Estimado da Viagem é
`Quantidade de Pessoas × Custo Unit. Transporte`, com o custo unitário **digitado** pelo usuário
(`Viagem.custoUnitarioTransporte`). O domínio que faz essa conta é
`src/domain/plano-contas/calcularCustoEstimadoViagem.ts` — marcado **[ORIGEM BLINDADA]** (fonte
única da matemática de custo de Viagem; alterá-la afeta Semáforo Orçamentário, Cronograma de
Desembolso e o dashboard de insights).

O pedido do usuário (verbatim): *"Total com transporte = valor informado pelo GFIN => médias da
conta dos últimos anos"*.

Decisões já tomadas com o usuário (AskUserQuestion, 2026-09-01):

1. O sistema **deve calcular** a média histórica automaticamente — não é campo digitado, nem
   apenas uma dica visual.
2. Esse valor é **somente exibição** na tela de Viagens. **NÃO** altera o `Viagem.custoEstimado`
   persistido, que continua alimentando Semáforo / Cronograma / dashboard exatamente como hoje.
   → O componente Transporte de `calcularCustoEstimadoViagem` **não muda** nesta US.

Consequência: a Viagem passa a exibir **dois números de transporte**:

| Número | Origem | Entra no Custo Estimado? |
|---|---|---|
| Custo de transporte estimado | `Qtd. Pessoas × Custo Unit. Transporte` (digitado) | Sim (como hoje) |
| Média histórica da conta de transporte | calculada pelo sistema (esta US) | Não — referência informativa |

---

## 🔴 Bloqueios e dependências não resolvidas

Nenhum destes pode ser assumido pelo dev — todos exigem decisão do usuário / Tech Lead antes de
qualquer código:

| # | Bloqueio | Por que trava | Quem decide |
|---|---|---|---|
| B1 | **Origem do dado histórico não existe no SGO.** O sistema só tem `ValorOrcadoConta` (orçado por exercício) e o "realizado" derivado da própria Proposta corrente (`ValorRealizadoService`). Não há série histórica de **lançamentos realizados por conta ao longo de vários anos**. | Sem fonte de "quanto foi gasto de verdade na conta X nos anos Y..Z", não há o que calcular. | Usuário + Tech Lead |
| B2 | **Como o histórico entra no sistema.** Opções: (a) nova integração com o ERP Senior puxando realizado por conta/exercício; (b) importação manual (planilha) de realizado histórico por conta; (c) nova entidade `RealizadoHistoricoConta(tenantId, contaId, exercicio, valor)` alimentada por um dos anteriores. | Cada opção é uma US de fundação própria, de tamanho diferente. | Tech Lead (ADR) |
| B3 | **Definição de "últimos anos".** Quantos exercícios? (3? 5?) Janela fixa ou configurável por tenant/`ParametroSistema`? Média **simples** dos exercícios ou **ponderada** (mais peso ao mais recente)? Corrigir por inflação/índice? Média do **valor total anual da conta** ou média de **algum unitário** (por viagem? por pessoa?)? | O número calculado muda completamente conforme a resposta. | Usuário (GFIN) |
| B4 | **Qual conta.** É a conta analítica de transporte **já vinculada** na Viagem (`Viagem.contaTransporteId`)? E se viagens diferentes usarem contas de transporte diferentes — a média é por conta de cada viagem, ou uma média única da "conta de transporte de viagens" do tenant? | Define se o cálculo é por-viagem ou global. | Usuário |
| B5 | **O que acontece com o campo "Custo Unit. Transporte" na tela.** Continua existindo e editável (é ele que entra no custo estimado)? Ganha um botão "usar a média histórica"? Fica lado a lado com a média só para comparação? | Define o desenho da tela e se há risco de confundir os dois números. | Usuário + AN/PO |
| B6 | **Sem dado histórico para a conta.** O que exibir quando a conta não tem histórico suficiente (conta nova, menos de N exercícios)? "—", "sem histórico", zero? | Regra de borda obrigatória. | AN/PO |
| B7 | **Multi-tenant.** O histórico é sempre por `tenantId` (cada organização tem o seu). Confirmar que nenhuma média cruza tenants. | Requisito não-negociável do SGO. | — (já é regra do projeto, mas precisa estar explícito na fonte de dados de B2) |

---

## Critérios de aceite (rascunho — só válidos DEPOIS de resolver B1–B6)

> ⚠️ Estes cenários assumem que existe uma fonte `RealizadoHistoricoConta` por `tenantId` +
> `contaId` + `exercicio`, e que a janela é "os 3 últimos exercícios fechados, média simples do
> valor total anual". Esses parâmetros são **suposições de rascunho** — trocar conforme B2/B3.

**Cenário 1 — Conta de transporte com histórico suficiente**
```gherkin
Dado que a Proposta está em RASCUNHO ou EM_ELABORACAO
E a Viagem "Missão Brasília" tem conta de transporte = "3.1.2.05 - Transporte"
E a conta "3.1.2.05" do tenant tem realizado fechado: 2023 = R$ 120.000,00, 2024 = R$ 150.000,00, 2025 = R$ 180.000,00
Quando o usuário abre a guia Viagens
Então o campo "Média histórica de transporte (conta 3.1.2.05)" exibe R$ 150.000,00
E esse valor NÃO é somado ao Custo Estimado da Viagem
E o Custo Estimado da Viagem continua = Passagem + Diária + (Qtd. Pessoas × Custo Unit. Transporte digitado)
```

**Cenário 2 — Conta de transporte sem histórico suficiente**
```gherkin
Dado que a conta de transporte da Viagem tem realizado fechado em apenas 1 exercício (2025)
E a regra exige no mínimo 3 exercícios (parâmetro de B3)
Quando o usuário abre a guia Viagens
Então o campo "Média histórica de transporte" exibe "sem histórico suficiente"
E nenhum cálculo de média é feito
```

**Cenário 3 — Isolamento multi-tenant**
```gherkin
Dado que a conta de código "3.1.2.05" existe no tenant A (realizado R$ 150.000,00 de média) e no tenant B (realizado R$ 900.000,00 de média)
E o usuário está autenticado no tenant A
Quando o usuário abre a guia Viagens de uma Proposta do tenant A
Então a média histórica exibida considera SOMENTE lançamentos do tenant A
E em nenhuma hipótese usa dado do tenant B
```

**Cenário 4 — Proposta oficializada (somente leitura)**
```gherkin
Dado que a Proposta está OFICIALIZADA / homologada
Quando o usuário abre a guia Viagens
Então a média histórica é exibida normalmente (é cálculo de leitura, não escrita)
E nenhum campo da Viagem fica editável
```

---

## Impacto técnico (preliminar)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | **Nova:** provável `RealizadoHistoricoConta` (`tenantId`, `contaId`, `exercicio`, `valor` Decimal) — depende de B2. Nenhuma alteração em `Viagem`. |
| `calcularCustoEstimadoViagem` | **NÃO alterar.** O custo estimado persistido não muda (decisão do usuário). |
| Cálculo da média | Serviço de domínio novo (ex: `CalcularMediaHistoricaContaService`) — leitura pura, sem transação. |
| Camada de exibição | `ViagemPanel.tsx` — novo campo/label de referência; a Server Action da guia (`page.tsx`) passa a carregar a média por conta. |
| Auditoria | Nenhuma (operação de leitura). A carga do histórico (B2) sim exige auditoria própria. |
| Multi-tenant | `tenantId` em todo `where` da consulta de histórico. |

---

## Recomendação de backlog

- **Coluna: 🔴 Bloqueado.** Não é "US pronta esperando fila" — falta a fundação de dado
  histórico (B1/B2), que é uma decisão de arquitetura + provável integração/importação.
- **Condição de desbloqueio:** o usuário definir de onde vem o realizado histórico por conta
  (B2) e a janela/método da média (B3); o Tech Lead produzir o ADR da fonte de dados.
- **Menor incremento entregável (quando desbloquear):** uma US de fundação
  "US-140a — Carga de Realizado Histórico por Conta" (importação manual via planilha, o caminho
  mais barato), e só então US-140 (exibir a média calculada na tela de Viagens). A parte de
  tela em si é pequena (P); todo o peso está na fonte de dados.

---

## Definition of Done (para quando sair do bloqueio)

- [ ] Fonte de realizado histórico por conta definida, com carga auditada e isolada por tenant
- [ ] Janela e método da média documentados como regra de negócio (RN) e/ou `ParametroSistema`
- [ ] Média exibida na guia Viagens, claramente rotulada como referência (não entra no custo estimado)
- [ ] Cenário "sem histórico suficiente" tratado com mensagem específica
- [ ] Teste de isolamento multi-tenant da consulta de histórico
- [ ] `Viagem.custoEstimado` e tudo que depende dele (Semáforo, Cronograma, dashboard) inalterados — teste de regressão
