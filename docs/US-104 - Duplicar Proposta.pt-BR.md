## [US-104] — Duplicar Proposta

**Módulo:** Cadastros — Propostas / Termos de Parceria
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** duplicar uma Proposta existente (em qualquer status), gerando uma nova Proposta independente com os dados analíticos já configurados na origem,
**Para** reaproveitar o planejamento orçamentário de um projeto anterior como ponto de partida para um novo, sem retrabalho manual de reconfiguração.

### Contexto e Regras de Negócio

Esta US cobre o UC03.08 da Minuta V5. Diferente de `CriarVersaoPropostaUseCase` (US-007) — que cria uma **nova versão da mesma Proposta**, herdando `propostaId` — esta operação cria uma **Proposta inteiramente nova e independente** (novo `id`, novo `codigo`), com sua própria Versão 1, copiando os dados analíticos da Proposta de origem como ponto de partida.

Escopo de clonagem nesta primeira versão: hoje os únicos dados analíticos reais vinculados a uma `VersaoProposta` são `ValorOrcadoConta` (US-007) e `RateioImpostoGrade` (US-101) — ambos vinculados à versão **vigente** da Proposta de origem. Esta US clona esses dois conjuntos de dados para a Versão 1 da nova Proposta. Quando os módulos de Metas, Empregados/Headcount, Viagens e Bens/Serviços existirem, a clonagem deve ser **estendida** para incluir essas estruturas — não reescrita do zero. Não são copiados: logs de auditoria da origem, nem qualquer Aditivo vinculado à origem (RN_DUP_003).

A Proposta de origem permanece 100% inalterada pela duplicação (RN_DUP_006) — a operação é somente leitura sobre a origem. A nova Proposta sempre nasce em status `RASCUNHO`, com Versão 1 (`numeroVersao=1`, `vigente=true`), **independentemente do status da Proposta de origem** (RN_DUP_005) — pode-se duplicar até uma Proposta `OFICIALIZADO` ou `ENCERRADO`, e a cópia nasce editável.

O Valor Global da nova Proposta nunca é copiado diretamente do valor calculado da origem — ele é sempre recalculado a partir dos dados clonados (RN_DUP_007), consistente com a regra de que Valor Global é sempre derivado, nunca um valor armazenado/copiado.

**RN_DUP_008 (competências excedentes)**: se o usuário, ao duplicar, expandir o período de vigência (Data de Término mais distante que a da origem), os meses/exercícios que não existiam na origem nascem sem nenhum valor lançado — não são preenchidos automaticamente com zero nem com qualquer valor herdado. Isso é consistente com o modelo já implementado: `ValorOrcadoConta` é sempre uma linha por (versão, conta, exercício), e não existir linha para um exercício simplesmente significa "sem valor lançado ainda", sem exigir um registro explícito de zero.

### Critérios de Aceite

**Cenário 1 — Duplicação bem-sucedida com dados analíticos clonados**
```gherkin
Dado que a Proposta de origem "PROP-2025-0010" está com status OFICIALIZADO
E que sua Versão vigente possui 2 linhas em ValorOrcadoConta (exercício 2025) e 1 linha em RateioImpostoGrade
Quando o usuário aciona [Duplicar] sobre esta Proposta, mantendo as mesmas datas de vigência
Então o sistema cria uma nova Proposta com codigo gerado automaticamente (PROP-{ano}-{sequencial}), nome = "Cópia de PROP-2025-0010" (ou do nome da proposta, conforme campo disponível), status = RASCUNHO
E cria a Versão 1 dessa nova Proposta (numeroVersao=1, vigente=true, status=RASCUNHO)
E copia as 2 linhas de ValorOrcadoConta e a 1 linha de RateioImpostoGrade da versão vigente da origem para a Versão 1 da nova Proposta, com os mesmos valores e exercícios/competências
E o Valor Global da nova Proposta é recalculado a partir dos dados copiados — nunca copiado diretamente do valor da origem
E um log de auditoria é gravado com tipoOperacao=PROPOSTA_DUPLICADA, contendo propostaOrigemId e propostaNovaId
E a Proposta de origem permanece com seus dados e status inalterados
```

**Cenário 2 — Duplicação com expansão de vigência não preenche competências novas**
```gherkin
Dado que a Proposta de origem tem vigência 01/2025 a 12/2025, com ValorOrcadoConta lançado para o exercício 2025
Quando o usuário duplica a Proposta alterando a Data de Término para 12/2026
Então a nova Proposta nasce com vigência até 12/2026
E os valores de 2025 são copiados normalmente
E nenhum valor é lançado automaticamente para o exercício 2026 — a nova versão simplesmente não possui linhas de ValorOrcadoConta para 2026 até que o usuário as configure manualmente (US-007)
```

**Cenário 3 — Nome obrigatório com prefixo automático**
```gherkin
Dado que o usuário está duplicando uma Proposta
Quando o sistema pré-popula o campo Nome da nova Proposta
Então o valor sugerido é "Cópia de {nome da Proposta de origem}"
E o campo permanece editável, mas não pode ser salvo em branco
```

**Cenário 4 — Falha na clonagem reverte toda a operação [TRAVA O ERRO]**
```gherkin
Dado que os dados da nova Proposta e da cópia de ValorOrcadoConta/RateioImpostoGrade estão sendo processados
Quando ocorre uma falha em qualquer etapa da transação (ex: falha ao gravar o log de auditoria)
Então toda a operação é revertida (rollback) — nenhuma Proposta nova fica criada parcialmente
E a Proposta de origem permanece intacta
E o sistema exibe: "Erro de Transação [TRAVA O ERRO]: A duplicação falhou e todas as operações foram revertidas para garantir a integridade da base. Tente novamente."
```

### Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | `Proposta` (INSERT), `VersaoProposta` (INSERT — Versão 1 da nova Proposta), `ValorOrcadoConta` (INSERT em lote, copiado da versão vigente da origem), `RateioImpostoGrade` (INSERT em lote, idem), `HistoricoOperacao` (INSERT) |
| Transação?        | Sim — criação da Proposta + Versão 1 + cópia em lote de ambas as tabelas analíticas + log, tudo em uma única transação. Rollback total em qualquer falha |
| Requer lock?      | Não sobre a origem (é somente leitura) — mesma estratégia de geração de `codigo` com retry já usada em `CadastrarPropostaUseCase` (US-102) para a nova Proposta |
| Auditoria         | Registrar em `HistoricoOperacao`: tenantId, usuarioId, propostaOrigemId, propostaNovaId, versaoOrigemId, versaoNovaId, contagem de linhas copiadas por tabela |
| Regra de negócio  | Nova Proposta sempre nasce RASCUNHO/Versão 1, independente do status de origem; Valor Global nunca copiado, sempre recalculado; nome obrigatório com prefixo sugerido; nenhum valor lançado automaticamente para competências/exercícios que não existiam na origem |

### Dependências

- US-102 (`CadastrarPropostaUseCase` — reaproveitar a mesma estratégia de geração de `codigo` com retry)
- US-007 e US-101 (fornecem os dados a clonar: `ValorOrcadoConta`, `RateioImpostoGrade`)
- Quando Metas/Empregados/Viagens/Bens existirem: estender a clonagem (não substituir)

### Definition of Done

- [ ] Cenários 1 a 4 implementados e aprovados em homologação
- [ ] Duplicação funciona a partir de Proposta de origem em qualquer status (RASCUNHO, EM_ELABORACAO, OFICIALIZADO, ENCERRADO)
- [ ] Nova Proposta sempre nasce RASCUNHO/Versão 1, mesmo duplicando uma origem Oficializada
- [ ] Valor Global da nova Proposta é recalculado, nunca copiado diretamente
- [ ] Falha em qualquer etapa reverte toda a transação (testar falha simulada na cópia de RateioImpostoGrade)
- [ ] Log de auditoria gravado com rastreabilidade origem→destino
- [ ] Operação testada com usuário sem permissão (deve bloquear no backend)
