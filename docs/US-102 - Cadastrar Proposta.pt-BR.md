## [US-102] — Cadastrar Proposta

**Módulo:** Cadastros — Propostas / Termos de Parceria
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** cadastrar uma nova Proposta (Contrato ou Termo de Parceria), informando os dados de capa (Tipo, Nome/Objeto, Vigência, Categoria),
**Para** iniciar o planejamento orçamentário de um projeto, com a garantia de que o Valor Global nunca é digitado manualmente — sempre calculado a partir dos lançamentos analíticos posteriores.

### Contexto e Regras de Negócio

Esta US cobre o UC03.05 (Cadastrar Proposta) da Minuta de Especificação V5. É o ponto de entrada de toda a árvore do módulo orçamentário: Metas, Plano de Contas, Empregados, Viagens e Rateio/Imposto (US-101, já implementada) só existem vinculados a uma Proposta e sua Versão.

Ao salvar a capa, o sistema cria **duas coisas na mesma transação**: o registro de `Proposta` e a sua primeira `VersaoProposta` (numeroVersao=1, status=RASCUNHO, vigente=true) — nenhuma Proposta pode existir sem ao menos uma Versão, e nenhuma Versão nasce "solta" sem a Proposta correspondente (RN_PROP_002). Isso segue o mesmo padrão que `CriarVersaoPropostaUseCase` (US-007) já usa para versões subsequentes — a diferença aqui é que não há versão de origem para copiar valores: a Versão 1 nasce vazia.

O campo Valor Global nunca é um input do usuário — é sempre um valor calculado (RN_PROP_001, [ORIGEM BLINDADA]), setado implicitamente em zero na criação porque ainda não existe nenhum lançamento de custo vinculado a esta Proposta.

Nota de nomenclatura: o enum de status usado é o `StatusProposta` já implementado no schema (RASCUNHO | EM_ELABORACAO | OFICIALIZADO | ENCERRADO — 4 valores, confirmado com o usuário/PO nas US-007/US-008). A Minuta V5 original menciona um estado adicional "Em Aprovação" em alguns trechos do UC03.05 — não incorporado aqui por não fazer parte do enum já validado; se esse estado for necessário no futuro, deve ser tratado como uma revisão formal do enum, não introduzido lateralmente por esta US.

### Critérios de Aceite

**Cenário 1 — Cadastro válido cria Proposta e Versão 1 na mesma transação**
```gherkin
Dado que o usuário está autenticado com perfil de escrita no módulo orçamentário
Quando ele preenche Tipo=CONTRATO, Nome/Objeto="Projeto Alfa", Data de Início=01/01/2026, Data de Término=31/12/2026, Categoria=CONSOLIDADA
E clica em [Salvar]
Então o sistema persiste um novo registro em Proposta com status=RASCUNHO e os dados informados
E persiste, na mesma transação, uma VersaoProposta com numeroVersao=1, status=RASCUNHO, vigente=true, vinculada à Proposta criada
E o Valor Global exibido é R$ 0,00, em campo somente leitura
E um log de auditoria é gravado em HistoricoOperacao com usuarioId, timestamp e os dados da Proposta criada
E o usuário é redirecionado para o painel de detalhamento da nova Proposta
```

**Cenário 2 — Campos obrigatórios em branco [TRAVA O ERRO]**
```gherkin
Dado que o usuário está preenchendo o formulário de nova Proposta
Quando ele deixa qualquer um dos campos Tipo, Nome/Objeto, Data de Início, Data de Término ou Categoria em branco
E tenta salvar
Então o sistema bloqueia a persistência e não cria nenhum registro (nem Proposta, nem Versão)
E exibe: "Operação Rejeitada [TRAVA O ERRO]: Os campos Tipo, Nome/Objeto, Data de Início, Data de Término e Categoria são obrigatórios e não podem ser nulos."
E o formulário permanece aberto com os dados já digitados intactos
```

**Cenário 3 — Incoerência cronológica de vigência [TRAVA O ERRO]**
```gherkin
Dado que o usuário está preenchendo o formulário de nova Proposta
Quando ele informa Data de Término igual ou anterior à Data de Início
E tenta salvar
Então o sistema bloqueia a persistência
E exibe: "Erro de Validação [TRAVA O ERRO]: A Data de Término não pode ser inferior ou igual à Data de Início configurada para o Termo de Parceria."
E nenhum dado é alterado no banco
```

**Cenário 4 — Falha na gravação do log de auditoria reverte a criação**
```gherkin
Dado que os dados da Proposta e da Versão 1 são válidos
Quando o sistema tenta persistir e a gravação do log em HistoricoOperacao falha
Então a transação inteira é revertida (rollback)
E nenhuma Proposta nem Versão fica gravada de forma órfã ou parcial
```

**Cenário 5 — Usuário sem permissão de escrita [TRAVA O ERRO]**
```gherkin
Dado que o usuário autenticado não possui permissão de escrita no módulo Cadastros > Propostas
Quando ele tenta acessar o formulário de cadastro ou enviar a requisição diretamente ao backend
Então o sistema bloqueia a operação, validada no backend (não apenas ocultando o botão na UI)
E nenhum dado é criado
```

### Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | `Proposta` (INSERT), `VersaoProposta` (INSERT — numeroVersao=1), `HistoricoOperacao` (INSERT) |
| Transação?        | Sim — criação da Proposta + Versão 1 + log de auditoria em uma única transação atômica. Rollback total em qualquer falha |
| Requer lock?      | Não — é uma operação de criação (INSERT), sem concorrência possível sobre um registro que ainda não existe |
| Auditoria         | Registrar em `HistoricoOperacao`: tenantId, usuarioId, propostaId, versaoId, payload dos dados de capa criados |
| Regra de negócio  | Campos obrigatórios não nulos (RN_PROP_003); Data de Término > Data de Início (RN_PROP_004); Valor Global nunca é input, sempre 0,00 na criação (RN_PROP_001); status inicial sempre RASCUNHO (RN_PROP_006) |

### Dependências

- ADR-012 (`Proposta`/`VersaoProposta` já modeladas — US-007/US-008/US-101 já implementadas sobre essa base)
- Nenhuma outra US bloqueia esta — é a US fundacional que as próximas (Alterar, Excluir, Duplicar Proposta) vão depender

### Definition of Done

- [ ] Cenários 1 a 5 implementados e aprovados em homologação
- [ ] Proposta e Versão 1 sempre criadas juntas, nunca uma sem a outra (testar falha simulada na criação da versão)
- [ ] Valor Global sempre exibido como 0,00 e nunca aceito como input do usuário
- [ ] Mensagens de erro exibidas exatamente conforme especificado nos Cenários 2 e 3
- [ ] Log de auditoria gravado com todos os campos obrigatórios; falha no log reverte toda a operação
- [ ] Operação testada com usuário sem permissão (deve bloquear no backend, não só ocultar botão na UI)
