## [US-106] — Gerenciar Estrutura Funcional (Organograma) da Proposta

**Módulo:** Cadastros — Empregados / Estrutura Funcional
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M

**Como** Orçamentista ou Gestor de RH (GRH),
**Quero** montar o organograma (árvore de unidades) de uma Proposta/Termo de Parceria, distinguindo unidades de consolidação (Diretoria/Gerência) das unidades operacionais (Assessoria/Coordenadoria/Setor),
**Para** ter uma "geografia interna" bem definida antes de alocar qualquer cargo — garantindo que nenhum custo de pessoal fique órfão ou lançado num nível que só deveria consolidar.

### Contexto e Regras de Negócio

Esta US cobre o UC03.18 (Estrutura Funcional) da Minuta V5, na fatia que já pode ser implementada hoje: **a árvore organizacional em si** (criar, editar, inativar unidades e validar a hierarquia pai-filho). A Minuta descreve esta tela como pré-requisito de UC03.19 (Cargos e Salários) e UC03.24-27 (Empregados) — nenhum desses módulos existe ainda no projeto, então três regras do UC03.18 que dependem deles ficam **explicitamente fora do escopo desta US**:

- **RN_EST_01** (todo cargo deve estar vinculado a um nó analítico, bloqueando oficialização se houver cargo órfão) — depende de `Cargo` existir.
- **RN_EST_03** (regra dos 100% ao ratear um cargo entre múltiplas unidades) — depende de `CargoAlocacaoPercentual` existir.
- **RN_EST_05** (saneamento de cargos importados do Rubi sem lotação clara) — depende de `Cargo` e da integração Rubi existirem.

Essas três regras devem ser revisitadas quando UC03.19/UC03.24-27 forem implementados — não como retrabalho desta US, mas como extensão natural dela (a árvore já vai existir; só falta o lado do `Cargo` apontar para ela).

**Decisão de escopo (fechada, confirmada pelo usuário em 2026-08-11 ao refinar [US-130](US-130%20-%20Importar%20Estrutura%20Organizacional%20entre%20Propostas.pt-BR.md))**: diferente da suposição original desta US (escopo por `VersaoProposta`, seguindo o padrão de `ValorOrcadoConta`/`RateioImpostoGrade`), `UnidadeFuncional` é escopada por **`Proposta` inteira** — o organograma não muda entre versões de uma mesma Proposta, e `CriarVersaoPropostaUseCase` (US-007) não precisa clonar a árvore ao criar nova versão. É assim que já está implementado (`propostaId` direto no schema, não `versaoId`) e permanece assim.

Estrutura hierárquica (fixa, 2 níveis):
- **Nível 1 — Sintético** (`DIRETORIA` ou `GERENCIA`): existe apenas para consolidar custos das unidades abaixo dela. Nunca recebe alocação de cargo diretamente (RN_EST_02).
- **Nível 2 — Analítico**: subordinado a um nó Sintético específico, com vínculo pai-filho rígido por tipo:
  - `ASSESSOR` → só pode ter como pai uma unidade Sintética do tipo `DIRETORIA`.
  - `COORDENADORIA` ou `SETOR` → só pode ter como pai uma unidade Sintética do tipo `GERENCIA`.

### Critérios de Aceite

**Cenário 1 — Criação válida de unidade Sintética (raiz)**
```gherkin
Dado que o usuário está autenticado com perfil de escrita no módulo de Empregados
Quando ele cria uma unidade "Diretoria Executiva", Tipo de Nível = Sintético (Diretoria), sem unidade superior
Então o sistema persiste a unidade sem pai (nó raiz)
E o log de auditoria é gravado com os dados criados
```

**Cenário 2 — Criação válida de unidade Analítica sob o pai correto**
```gherkin
Dado que existe a unidade Sintética "Diretoria Executiva" (tipo DIRETORIA)
Quando o usuário cria a unidade "Assessoria de Planejamento", Tipo de Nível = Analítico (Assessor), com pai = "Diretoria Executiva"
Então o sistema persiste a unidade com o vínculo pai-filho
E a árvore passa a exibir "Assessoria de Planejamento" como filha de "Diretoria Executiva"
```

**Cenário 3 — Inconformidade de associação hierárquica [TRAVA O ERRO]**
```gherkin
Dado que existe a unidade Sintética "Diretoria Executiva" (tipo DIRETORIA)
Quando o usuário tenta criar uma unidade Analítica do tipo Coordenadoria ou Setor tendo "Diretoria Executiva" como pai
Então o sistema bloqueia a criação
E exibe: "Vínculo Hierárquico Inválido [TRAVA O ERRO]: Coordenadoria/Setor só pode ser subordinado a uma unidade do tipo Gerência. Assessoria só pode ser subordinado a uma unidade do tipo Diretoria."
E nenhum dado é alterado no banco
```

**Cenário 4 — Bloqueio de alocação em nível Sintético [TRAVA O ERRO]**
```gherkin
Dado que o usuário está criando ou editando uma unidade
Quando ele tenta definir uma unidade Sintética (Diretoria/Gerência) como destino de alocação de cargo
Então o sistema bloqueia — unidades Sintéticas nunca aparecem como opção de destino de alocação, apenas unidades Analíticas
```

**Cenário 5 — Inativação bloqueada por vínculo ativo [TRAVA O ERRO]**
```gherkin
Dado que uma unidade da Estrutura Funcional possui ao menos um Cargo vinculado a ela
Quando o usuário tenta inativar essa unidade
Então o sistema bloqueia a inativação
E exibe: "Inativação Bloqueada [TRAVA O ERRO]: Esta unidade possui cargos vinculados. Remova ou realoque os cargos antes de inativá-la."
E a unidade permanece ativa
```

**Cenário 6 — Inativação permitida sem vínculos**
```gherkin
Dado que uma unidade da Estrutura Funcional não possui nenhum Cargo vinculado a ela
Quando o usuário a inativa
Então o sistema marca a unidade como inativa (soft delete)
E o log de auditoria é gravado
```

**Cenário 7 — Bloqueio de escrita em Versão não editável [TRAVA O ERRO]**
```gherkin
Dado que a Versão da Proposta à qual a Estrutura Funcional pertence está em status OFICIALIZADO ou ENCERRADO
Quando o usuário tenta criar, editar ou inativar qualquer unidade
Então o sistema bloqueia a operação (mesmo padrão já usado em US-007/US-101)
E nenhum dado é alterado no banco
```

### Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | Nova tabela `UnidadeFuncional` — FK para `VersaoProposta` (suposição a confirmar pelo Tech Lead), auto-relacionamento `idPai` para a hierarquia |
| Modelo sugerido   | `UnidadeFuncional { id, tenantId, versaoId (FK VersaoProposta), nome, tipoNivel enum(SINTETICO_DIRETORIA\|SINTETICO_GERENCIA\|ANALITICO_ASSESSOR\|ANALITICO_COORDENADORIA\|ANALITICO_SETOR), idPai (FK UnidadeFuncional, nullable), ativa Boolean, createdAt, updatedAt }` |
| Transação?        | Sim — criação/edição/inativação + log de auditoria em transação única |
| Requer lock?      | Não — sem concorrência de saldo; validação de hierarquia é read-then-write simples |
| Auditoria         | Registrar em `HistoricoOperacao`: tenantId, usuarioId, versaoId, unidadeId, estado anterior/novo |
| Regra de negócio  | Vínculo pai-filho por tipo (Assessor↔Diretoria, Coordenadoria/Setor↔Gerência); alocação só em nível Analítico; inativação bloqueada com vínculo de Cargo (quando Cargo existir — hoje a checagem sempre passa, pois não há Cargo para vincular) |

Nota técnica (para o Tech Lead decidir): confirmar se `UnidadeFuncional` é escopada por `VersaoProposta` (suposição desta US, seguindo o padrão de US-007/101) ou por `Proposta` diretamente (organograma não muda entre versões de uma mesma proposta?) — essa decisão também define se `CriarVersaoPropostaUseCase` (US-007) precisa ser estendido para clonar a árvore ao criar nova versão.

### Dependências

- ADR-012 (`Proposta`/`VersaoProposta`) — base para a FK de escopo
- Desbloqueia parcialmente UC03.19 (Cargos e Salários) e UC03.24-27 (Empregados) — que precisarão desta árvore para vincular cargos
- RN_EST_01, RN_EST_03, RN_EST_05 ficam pendentes até `Cargo`/`CargoAlocacaoPercentual` existirem (não são cenários desta US)

### Definition of Done

- [ ] Cenários 1 a 7 implementados e aprovados em homologação
- [ ] Vínculo pai-filho validado estritamente por tipo (Assessor só sob Diretoria; Coordenadoria/Setor só sob Gerência)
- [ ] Unidade Sintética nunca aparece como destino de alocação de cargo
- [ ] Inativação bloqueada corretamente quando há vínculo de Cargo (revisar teste quando Cargo existir)
- [ ] Log de auditoria gravado em toda operação de escrita
- [ ] Operação testada com usuário sem permissão (deve bloquear no backend)
- [ ] Operação bloqueada corretamente em Versão Oficializada/Encerrada
