## [US-105] — Controle de Concorrência (Optimistic Locking) na Edição de Versão da Proposta

**Módulo:** Cadastros — Propostas / Termos de Parceria
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** ser avisado quando tento salvar uma alteração que já foi sobrescrita por outra pessoa editando a mesma versão ao mesmo tempo,
**Para** não perder silenciosamente o meu trabalho nem sobrescrever, sem saber, o trabalho de outro orçamentista.

### Contexto e Regras de Negócio

Esta US cobre o requisito transversal RNF_EDV_REQ_002 do UC03.10 (Editar Versão da Proposta) da Minuta V5. Nota de nomenclatura: a seção "Regras de Negócio" do UC03.10, tal como está na Minuta, colou por engano as regras `RN_VAL_001` a `RN_VAL_005` de um UC totalmente diferente (workflow de validação de lançamentos de RH/Viagens) — essas regras não têm relação com este documento e foram ignoradas.

UC03.10 não é uma tela nova a construir: é o container conceitual que hospeda as guias analíticas de uma Versão de Proposta. Duas dessas guias já existem e funcionam hoje — "Plano de Contas Único" (`ValorOrcadoConta`, US-007) e "Matriz de Rateio/ISS" (`RateioImpostoGrade`, US-101) — mas nenhuma delas implementa o controle de concorrência que o UC03.10 exige (RNF_EDV_REQ_002). Hoje, se dois orçamentistas editam o valor orçado da mesma conta+exercício (ou o mesmo tributo na mesma competência) ao mesmo tempo, o segundo `save` sobrescreve o primeiro silenciosamente — sem detecção de conflito, sem aviso ao usuário, sem log distinguindo "alterei um valor que eu mesmo lancei" de "sobrescrevi o que outra pessoa acabou de lançar".

O mecanismo de controle é via **token de concorrência otimista** baseado em `updatedAt`: o cliente lê o registro (com seu `updatedAt` atual), e ao salvar envia esse valor como "o que eu esperava encontrar". Se o registro no banco já tiver um `updatedAt` diferente (ou seja, foi alterado por outra escrita entre a leitura e o salvamento), o commit é rejeitado com uma mensagem de conflito — não é aplicado silenciosamente por cima.

Esta US também cobre o Fluxo de Exceção E2 do UC03.10 — uma variação mais específica do bloqueio de versão imutável já implementado (`VersaoOficializadaCongeladaError`, US-007/US-101): aqui, o usuário está **no meio de uma edição** quando a versão é oficializada por outra pessoa em paralelo. A mensagem precisa refletir que a mudança de estado aconteceu *durante* a edição do usuário, não apenas que a versão já está congelada — é uma UX diferente (o usuário não sabia que a versão tinha mudado de status enquanto ele digitava).

### Critérios de Aceite

**Cenário 1 — Salvamento sem conflito (token corresponde ao estado atual)**
```gherkin
Dado que o usuário A leu o valor orçado da conta "Salários" (exercício 2026), obtendo updatedAt = T1
E ninguém mais alterou esse registro desde então
Quando o usuário A salva um novo valor, informando updatedAtEsperado = T1
Então o sistema aceita o commit normalmente
E o registro é atualizado com um novo updatedAt (T2)
E o log de auditoria é gravado normalmente
```

**Cenário 2 — Conflito de concorrência detectado [TRAVA O ERRO]**
```gherkin
Dado que o usuário A e o usuário B leram o mesmo valor orçado da conta "Salários" (exercício 2026), ambos obtendo updatedAt = T1
Quando o usuário B salva primeiro, alterando o valor e atualizando o registro para updatedAt = T2
E o usuário A, sem saber disso, tenta salvar sua própria alteração informando updatedAtEsperado = T1 (desatualizado)
Então o sistema rejeita o commit do usuário A
E exibe: "Conflito de Concorrência: Este registro foi alterado por outro usuário desde a última leitura. Recarregue os dados antes de salvar novamente."
E nenhum dado é sobrescrito — o valor salvo pelo usuário B permanece intacto
```

**Cenário 3 — Mesmo comportamento para Rateio de Imposto (RateioImpostoGrade)**
```gherkin
Dado que dois usuários leem o mesmo rateio de ISS da mesma competência, com o mesmo updatedAt inicial
Quando um deles salva primeiro e o outro tenta salvar em seguida com o token desatualizado
Então o sistema aplica a mesma regra de conflito do Cenário 2, com a mesma mensagem
```

**Cenário 4 — Versão tornou-se imutável durante a edição [TRAVA O ERRO]**
```gherkin
Dado que o usuário está editando um valor orçado de uma versão em status RASCUNHO ou EM_ELABORACAO
Quando, antes do usuário salvar, outra pessoa oficializa essa mesma versão (status muda para OFICIALIZADO)
E o usuário então tenta salvar sua edição, sem saber da mudança
Então o sistema bloqueia o commit
E exibe: "Ação Negada [TRAVA O ERRO]: Esta versão tornou-se imutável devido à alteração de seu status no ciclo de vida do projeto. Edições locais foram desativadas."
E nenhum dado é alterado no banco
```

### Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | `ValorOrcadoConta` e `RateioImpostoGrade` — nenhuma coluna nova necessária, `updatedAt` já existe em ambas e já é atualizado automaticamente pelo Prisma (`@updatedAt`) |
| Campos alterados  | Nenhum campo novo — o `updatedAt` existente passa a ser usado também como token de concorrência, não só como metadado |
| Transação?        | Sim — leitura do estado atual + comparação de `updatedAt` + update condicional, dentro da mesma transação já usada por `ConfigurarValorOrcadoContaUseCase`/`ConfigurarRateioImpostoUseCase` |
| Requer lock?      | Não é lock pessimista — é optimistic locking: `UPDATE ... WHERE id = ? AND updatedAt = ?`, checando `count` de linhas afetadas (0 = conflito, alguém alterou entre a leitura e a escrita) |
| Auditoria         | Sem mudança no formato do log — mas o conflito rejeitado (Cenário 2) não deve gerar entrada de auditoria, pois nada foi de fato alterado |
| Regra de negócio  | Commit só é aceito se `updatedAtEsperado` informado pelo cliente corresponder exatamente ao `updatedAt` atual do registro no banco no momento do `UPDATE` |

### Dependências

- US-007 (`ConfigurarValorOrcadoContaUseCase`) — recebe o parâmetro opcional de token de concorrência
- US-101 (`ConfigurarRateioImpostoUseCase`) — idem
- Não depende de nenhum módulo de custo futuro (Empregados/Viagens/Bens) — quando esses existirem e tiverem seus próprios use-cases de edição, devem seguir o mesmo padrão de controle de concorrência estabelecido aqui

### Definition of Done

- [ ] Cenários 1 a 4 implementados e aprovados em homologação
- [ ] `ConfigurarValorOrcadoContaUseCase` e `ConfigurarRateioImpostoUseCase` aceitam o token de concorrência opcional e rejeitam commit em caso de divergência
- [ ] Mensagem de conflito exibida exatamente conforme especificado, sem sobrescrever o valor já salvo por outro usuário
- [ ] Testado com dois "usuários" (duas chamadas ao use-case) simulando edição concorrente da mesma linha
- [ ] Nenhuma entrada de auditoria é gravada quando o commit é rejeitado por conflito
