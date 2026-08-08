## [US-123] — Manter Alíquotas de Impostos (Consulta e Listagem)

**Módulo:** Cadastros — Alíquotas de Impostos
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Administrador, Orçamentista ou Gestor Financeiro,
**Quero** consultar, filtrar e listar as alíquotas de tributos cadastradas na base de parâmetros fiscais,
**Para** ter visibilidade centralizada do que está disponível para rateio nas Propostas, sem depender do seed/banco diretamente.

### Contexto e Regras de Negócio

Cobre o UC03.39 da especificação `Especificacao_UC03.39_a_UC03.42_Aliquotas_Impostos.md` (gap formalizado, sem UC anterior — `AliquotaImpostoParametro` hoje só é populado via `prisma/seed.mjs`, não existe nenhuma tela de administração). Menu de origem: **Cadastros > Alíquotas de Impostos** (novo item de menu, `Funcionalidade` tipo NAVEGAVEL — mesmo padrão de US-114/US-116).

Esta US cobre **apenas leitura** (listar/filtrar/exportar). Criação, edição e exclusão são US-124/125/126.

Pré-requisito de schema (ver ADR-038, [[adr038_aliquota_imposto_vinculo_conta]]): `AliquotaImpostoParametro` precisa ganhar os campos `ativo`, `dataFimVigencia`, `limiteMinimoPct`, `limiteMaximoPct`, `observacao`, `contaSinteticaId` (nullable) e `version` (Optimistic Locking) antes desta US ser codificada — a migration é compartilhada com US-124/125/126, não repetir em cada uma.

### Critérios de Aceite

**Cenário 1 — Listagem sem filtro**
```gherkin
Dado que existem 3 alíquotas cadastradas (PIS, COFINS, ISS)
Quando o usuário acessa Cadastros > Alíquotas de Impostos e clica em [Pesquisar] sem preencher filtros
Então a grade exibe as 3 alíquotas com as colunas: Nome, Alíquota (%), Tipo de Incidência, Data Início, Data Fim, Status, Ações
E o botão [Novo] é exibido para perfis com permissão de escrita
```

**Cenário 2 — Filtro combinado**
```gherkin
Dado que existem alíquotas de tipos de incidência CONTRATO e TERMO_DE_PARCERIA
Quando o usuário filtra por Tipo de Incidência = "Termo de Parceria" e Status = "Ativo"
Então a grade exibe somente as alíquotas ativas com tipoIncidencia = TERMO_DE_PARCERIA ou AMBOS
```

**Cenário 3 — Pesquisa sem resultado**
```gherkin
Dado que nenhuma alíquota atende aos filtros informados
Quando o usuário clica em [Pesquisar]
Então o sistema exibe "Nenhuma alíquota encontrada para os filtros informados."
E a grade é renderizada vazia
E o botão [Novo] permanece ativo
```

**Cenário 4 — Status calculado "Expirada"**
```gherkin
Dado que uma alíquota tem dataFimVigencia < data atual do servidor
Quando a grade é renderizada
Então essa alíquota é exibida com Status "Expirada" (badge visual distinto de Ativo/Inativo), mesmo que ativo = TRUE
```

**Cenário 5 — Ações condicionais por linha**
```gherkin
Dado que a alíquota "ISS" está referenciada em RateioImpostoGrade com ativo = TRUE em uma Proposta não congelada
E a alíquota "COFINS" não tem nenhuma referência ativa
Quando a grade é renderizada
Então o botão [Excluir] da linha "ISS" é exibido desabilitado
E o botão [Excluir] da linha "COFINS" é exibido habilitado
E o botão [Editar] é exibido habilitado em ambas as linhas
```

**Cenário 6 — Exportar listagem**
```gherkin
Dado que a grade está renderizada com os filtros Tipo de Incidência = "Contrato" aplicados
Quando o usuário clica em [Exportar]
Então o sistema gera PDF e XLSX com os filtros aplicados estampados no cabeçalho do documento [RN0011]
E reaproveita o utilitário `src/lib/export/exportarRelatorio.ts` (ADR-037), sem introduzir nova lib de exportação
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Leitura de `AliquotaImpostoParametro` e `RateioImpostoGrade` (para calcular disponibilidade do botão Excluir); nenhuma escrita |
| Campos alterados | Nenhum (US somente leitura) |
| Transação? | Não |
| Requer lock? | Não |
| Auditoria | RN0232 — toda listagem com filtros grava log assíncrono em `HistoricoOperacao` com snapshot dos filtros |
| Regra de negócio | RN_IMP_001 (formatação 2 casas decimais), RN_IMP_002 (badge de status), RN_IMP_003 (status Expirada calculado), RN_IMP_004 (condicional de Excluir) |

### Dependências

- **ADR-038**: campos novos de schema (`ativo`, `dataFimVigencia`, `limiteMinimoPct`, `limiteMaximoPct`, `observacao`, `contaSinteticaId`, `version`) precisam existir antes desta US.
- **US-124 (Cadastrar)**: fornece o botão [Novo] referenciado no Cenário 1.
- Nova `Funcionalidade` NAVEGAVEL `cadastros.aliquotas-impostos.visualizar` a seedar.

### Definition of Done

- [ ] Critérios de aceite 1 a 6 implementados e testados
- [ ] Migration de schema (ADR-038) aplicada antes do código desta US
- [ ] Log de auditoria (RN0232) gerado a cada pesquisa com filtro
- [ ] Testado com base vazia (Cenário 3)
- [ ] Testado com alíquota vencida (Cenário 4)
- [ ] Exportação PDF/XLSX reaproveitando `exportarRelatorio.ts`, sem lib nova
