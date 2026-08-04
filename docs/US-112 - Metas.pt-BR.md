## [US-112] — Manter Meta (Cadastrar, Alterar, Excluir — registro único por Versão)

**Módulo:** Cadastros — Metas e Dotações Físicas
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** P

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** que uma Proposta com categoria `POR_META` tenha um único registro de Meta, com o Valor Global sempre espelhando o total já orçado nas contas analíticas,
**Para** identificar/nomear o agrupamento físico do orçamento sem correr o risco de o valor divergir do que foi efetivamente parametrizado no Plano de Contas.

### Contexto e Regras de Negócio

Esta US cobre o UC03.14 (Manter Meta), UC03.15 (Cadastrar Meta), UC03.16 (Alterar Meta) e UC03.17 (Excluir Meta) da Minuta V5.

**Revisão de modelagem desta sessão (substitui a versão anterior deste documento):** o entendimento inicial, de que uma Proposta `POR_META` teria várias Metas (parcelas físicas somadas contra um teto), estava **errado**. O usuário esclareceu: **dentro de uma Proposta/projeto, quando a categoria é `POR_META`, existe exatamente 1 (uma) Meta.** Quando não é `POR_META`, é `CONSOLIDADA` — e não existe Meta nenhuma. Não há "soma de várias Metas contra um teto" — há, no máximo, um único registro complementar por Versão.

Isso simplifica a US drasticamente frente ao desenho anterior:
- **Cardinalidade: 1:1 opcional entre `VersaoProposta` e `Meta`** (zero ou um registro, nunca mais que um). `@@unique([tenantId, versaoId])`, não `@@unique([tenantId, versaoId, numero])` — não há "número" sequencial de Meta, porque não há lista.
- **`Meta.valorGlobal` não é digitado pelo usuário.** É sempre um espelho de leitura (Read-only) de `SUM(ValorOrcadoConta.valor) WHERE tenantId, versaoId` — o mesmo total que motivou a decisão anterior, mas agora sem validação de "soma x teto": é atribuição direta, [ORIGEM BLINDADA]. Não existe mais RN0141/150 (trava de estouro por somatório) — não há o que estourar quando o valor é sempre igual ao total, não uma soma de partes.
- **RN0242 (Ordem incremental resetada por Meta) deixa de existir** — não há mais de uma Meta para ordenar.
- **A race condition de concorrência que motivou a proposta de lock pessimista no ADR anterior também deixa de existir** — não há mais "duas Metas escritas ao mesmo tempo estourando um teto somado"; há apenas 1 registro cujo valor é sempre recalculado a partir do total corrente.
- Os campos editáveis pelo usuário continuam sendo: Tipo, Nome, Status, Observação — só que agora sempre em um único registro por Versão, criado a partir do momento em que a Proposta é definida como `POR_META` (ou registrado sob demanda quando o usuário acessa a subguia de Meta pela primeira vez).
- **Soft delete** mantido (mesmo desvio já formalizado em US-108) — a Minuta pede exclusão física.
- Achado de qualidade documental (ainda válido): REQ0130 (vínculo de Meta com contas do Plano de Contas) permanece sem especificação clara nos fluxos — fora de escopo.
- RN0136/E1 (UC03.17): exclusão bloqueada se a Meta tiver headcounts/diárias/rateios vinculados — verificação sempre "sem vínculo" nesta US, mesma situação de US-108.

### Critérios de Aceite

**Cenário 1 — Cadastrar a Meta única de uma Versão, com Valor Global espelhado do total orçado**
```gherkin
Dado que a VersaoProposta "v1" da Proposta "PROP-2026-003" (categoria POR_META) tem SUM(ValorOrcadoConta.valor) = 1.000.000,00
E "v1" ainda não possui nenhuma Meta cadastrada
Quando o usuário cadastra a Meta com Tipo="Capacitação", Nome="Capacitação Regional", Status=ATIVO
Então a Meta é persistida vinculada a "v1"
E o campo "Valor Global" é preenchido automaticamente com 1.000.000,00 (Read-only, espelho do total orçado)
E um registro de auditoria `META_CRIADA` é gravado em HistoricoOperacao
```

**Cenário 2 — Bloqueio: tentar cadastrar uma segunda Meta na mesma Versão [TRAVA O ERRO]**
```gherkin
Dado que a VersaoProposta "v1" já possui uma Meta ativa cadastrada
Quando o usuário tenta cadastrar uma nova Meta para "v1"
Então o sistema bloqueia o cadastro
E exibe a mensagem "Esta Versão já possui uma Meta cadastrada. Altere o registro existente em vez de criar um novo."
```

**Cenário 3 — Bloqueio: cadastro de Meta em Proposta com categoria CONSOLIDADA**
```gherkin
Dado que a Proposta "PROP-2026-004" tem categoria CONSOLIDADA
Quando o usuário tenta cadastrar uma Meta para uma Versão dessa Proposta
Então o sistema bloqueia o cadastro
E exibe a mensagem "Metas só são aplicáveis a Propostas com categoria 'Por Meta'."
```

**Cenário 4 — Bloqueio: campos obrigatórios ausentes (RN0139)**
```gherkin
Dado que o usuário está cadastrando a Meta de uma Versão POR_META
Quando ele tenta salvar sem preencher o Status
Então o sistema bloqueia o salvamento
E exibe a mensagem "Preencha Tipo e Status antes de salvar."
```

**Cenário 5 — Bloqueio: cadastro/alteração em VersaoProposta não editável (RN0183)**
```gherkin
Dado que a VersaoProposta "v1" está com status OFICIALIZADO
Quando o usuário tenta cadastrar ou alterar a Meta vinculada a ela
Então o sistema bloqueia a operação
E exibe a mensagem "Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida."
```

**Cenário 6 — Alterar Meta: Nome/Tipo/Status/Observação são editáveis, Valor Global permanece espelhado**
```gherkin
Dado que a Meta de "v1" está com Nome="Capacitação Regional" e Valor Global=1.000.000,00 (SUM ValorOrcadoConta atual)
Quando o usuário altera o Nome para "Capacitação Regional — Revisão 1"
Então o Nome é atualizado
E o Valor Global permanece igual ao SUM(ValorOrcadoConta.valor) corrente, recalculado no momento do salvamento
E um registro de auditoria `META_EDITADA` é gravado
```

**Cenário 7 — Bloqueio: tentativa de editar o Valor Global manualmente [ORIGEM BLINDADA]**
```gherkin
Dado que a Meta de "v1" está com Valor Global = 1.000.000,00 (espelhado)
Quando o usuário tenta submeter uma alteração enviando um Valor Global diferente
Então o sistema ignora o valor recebido para esse campo
E recalcula o Valor Global a partir de SUM(ValorOrcadoConta.valor) no momento do salvamento
E o restante da alteração é processado normalmente
```

**Cenário 8 — Excluir a Meta com sucesso (soft delete)**
```gherkin
Dado que a Meta de "v1" não possui nenhum headcount, diária ou rateio vinculado
E a VersaoProposta está em status RASCUNHO
Quando o usuário confirma a exclusão da Meta
Então o registro é marcado como `ativo = false` (soft delete)
E a Versão volta a poder receber o cadastro de uma nova Meta (Cenário 2 deixa de bloquear)
E um registro de auditoria `META_EXCLUIDA` é gravado com o snapshot do estado removido
```

**Cenário 9 — Bloqueio: exclusão de Meta com vínculo operacional [E1 de UC03.17]**
```gherkin
Dado que a Meta possui um headcount ou despesa de viagem vinculada
Quando o usuário tenta excluí-la
Então o sistema bloqueia a exclusão
E exibe a mensagem "Exclusão Rejeitada: Operação bloqueada. A meta possui registros operacionais vinculados ou o ciclo de vida atual do projeto não permite alterações."
```
*(Nota: verificação de vínculo operacional retorna sempre "sem vínculo" até Viagens/Bens/Empregados-por-Meta existirem — mesma situação documentada em US-108, Cenário 9.)*

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nova tabela `Meta` |
| Campos alterados | tenantId, versaoId (FK VersaoProposta, **único** — `@@unique([tenantId, versaoId])**), tipo, nome, valorGlobal (Decimal 15,2, sempre recalculado no backend), status (enum ATIVO/INATIVO), observacao (nullable), ativo (soft delete) |
| Transação? | Sim — recálculo de `valorGlobal` a partir de `SUM(ValorOrcadoConta.valor)` deve ocorrer na mesma transação da escrita |
| Requer lock? | **Não** — decisão revista: sem concorrência de "soma de várias Metas", o cenário de corrida do ADR anterior não se aplica. Simples leitura+escrita dentro de uma transação padrão, mesmo nível de proteção de `Cargo` (US-107). |
| Auditoria | `META_CRIADA`, `META_EDITADA`, `META_EXCLUIDA` em HistoricoOperacao |
| Regra de negócio | RN0139 (obrigatórios), unicidade 1:1 por Versão, categoria=POR_META obrigatória, RN0183 (ciclo de vida editável), RN0136 (bloqueio de exclusão com vínculo), ORIGEM BLINDADA (Valor Global sempre espelhado) |

### Dependências

- **US-007 (ValorOrcadoConta)**: fonte do Valor Global espelhado — satisfeita.
- **US-102 (Proposta)** / categoria `POR_META`: satisfeita.
- **US-108 (Empregados)**: poderá ser estendida para aceitar `categoria=POR_META` referenciando a Meta única da Versão — extensão natural, não retrabalho.
- **Viagens/Bens (ainda não iniciados)**: Cenário 9 fica com verificação sempre-negativa até esses módulos existirem.

### Definition of Done

- [ ] Critérios de aceite 1 a 8 implementados e testados
- [ ] Cenário 9 documentado, não implementado (retorna sempre "sem vínculo")
- [ ] Constraint de unicidade garante no máximo 1 Meta ativa por Versão
- [ ] Valor Global é sempre recalculado a partir de SUM(ValorOrcadoConta.valor), nunca aceito como input direto
- [ ] Exclusão é sempre soft delete (`ativo=false`)
- [ ] Log de auditoria gerado para criação/edição/exclusão com snapshot do estado anterior
- [ ] Testado com VersaoProposta Oficializada (deve bloquear cadastro/alteração/exclusão)
- [ ] Testado com tentativa de segunda Meta na mesma Versão (deve bloquear)
- [ ] Testado com Proposta CONSOLIDADA (deve bloquear cadastro de Meta)
