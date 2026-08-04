## [US-113] — Manter Quantidade de Empregado

**Módulo:** Cadastros — Empregados (Consolidação Quantitativa)
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Usuário Comum,
**Quero** consolidar formalmente, por período de vigência e documento de respaldo (Apostilamento/Termo Aditivo), a quantidade de Empregados, Estagiários e Jovens Aprendizes ativos de uma Proposta,
**Para** ter um histórico auditável de headcount por período, com os quantitativos sempre calculados por contagem real — nunca digitados — e sujeito às mesmas travas de integridade já aplicadas ao módulo de Empregados.

### Contexto e Regras de Negócio

Cobre UC03.20 a UC03.23 da Minuta V5 (Manter/Cadastrar/Alterar/Excluir Qtde. Empregado). É uma tela de **consolidação/snapshot**, não de lançamento de custo: não cria nem edita `EmpregadoHeadcount`, apenas registra formalmente, com data e documento oficial, qual era a contagem de headcounts ativos por categoria naquele intervalo.

Os 3 campos quantitativos (`quantidadeEmpregados`, `quantidadeEstagiarios`, `quantidadeJovemAprendiz`) são **ORIGEM BLINDADA** [RN0457]: calculados por `COUNT` sobre `EmpregadoHeadcount` ativo, agrupado por `categoria`, no momento do cadastro — nunca aceitos como input. Os únicos campos digitados pelo usuário são **Período Inicial**, **Período Final** e **Número do Documento**.

**⚠️ Achado que bloqueia a modelagem — precisa de decisão do Tech Lead antes de codar:**

`EmpregadoHeadcount` tem `propostaId` (FK direta a `Proposta`), **não** `versaoId`/`metaId` como `Viagem` e `ItemPatrimonial` (ADR-022/ADR-023). Isso quebra o padrão que a US-113 precisaria seguir para "Meta (caso haja)" da Minuta (RN0148/RN0152: agrupamento por Meta só existe se a Proposta for `POR_META`):

- Não há hoje nenhuma coluna em `EmpregadoHeadcount` que vincule um headcount a uma `Meta` específica — logo, "COUNT de headcounts ativos de uma Meta" não é uma query possível com o schema atual, só "COUNT de headcounts ativos da Proposta inteira".
- `EmpregadoHeadcount` também não é escopado por `VersaoProposta` — é direto por `Proposta`. Isso já era assim desde US-108 (ADR-018) e não foi alterado por nenhuma US posterior.

**Decisão do usuário (2026-08-04): corrigir o gap estrutural primeiro.** `EmpregadoHeadcount` passa a ter `metaId` (nullable, obrigatório só quando `Proposta.categoria=POR_META`, mesmo padrão de `Viagem`/`ItemPatrimonial`), alinhando com o restante do domínio de custo. Isso é uma mudança retroativa em `EmpregadoHeadcount` (US-108/ADR-018) — cabe ao Tech Lead formalizar em ADR como fica a migração dos registros já existentes (headcounts cadastrados antes desta US, sem `metaId`) e o impacto nos use cases `Cadastrar/Editar/ExcluirEmpregadoUseCase`.

**Achado adicional (2026-08-04) — escopo ajustado:** `CadastrarEmpregadoUseCase` (US-108) bloqueia hoje qualquer Proposta `categoria≠CONSOLIDADA` (`EmpregadoForaDeEscopoCategoriaError`). Sem remover essa restrição, `metaId` nunca teria valor real — Empregado simplesmente não pode existir em Proposta `POR_META`. **Decisão do usuário: também liberar Empregado para Proposta `POR_META` nesta mesma rodada**, com `metaId` derivado automaticamente da Meta 1:1 da versão (mesmo padrão de `CadastrarViagemUseCase`), tornando o Cenário 8 abaixo realmente exercitável.

**Gap adicional herdado (mesmo padrão já aceito em US-109/US-112):** RN0145/E2 da Minuta pedem bloquear a exclusão se houver "diárias emitidas, adiantamentos ou viagens ativas" vinculadas aos headcounts do período. Não existe módulo de Diária/Adiantamento, e `Viagem` não tem FK para `EmpregadoHeadcount` individual (é por Meta). Proposta: **não implementar essa checagem nesta US** — mesma simplificação de `ExcluirViagemUseCase`/`ExcluirMetaUseCase`, que só verificam `Proposta.status`.

### Critérios de Aceite

**Cenário 1 — Consolidar quantidade de empregados com contagem calculada**
```gherkin
Dado que a Proposta "PROP-2026-0001" está em RASCUNHO
E possui 8 EmpregadoHeadcount ativos: 5 categoria EMPREGADO, 2 ESTAGIARIO, 1 JOVEM_APRENDIZ
Quando o usuário cadastra uma Qtde. Empregado com:
  | Período Inicial   | 2026-01-01 |
  | Período Final     | 2026-06-30 |
  | Número do Documento | APOST-2026-014 |
Então o sistema calcula quantidadeEmpregados=5, quantidadeEstagiarios=2, quantidadeJovemAprendiz=1 [ORIGEM BLINDADA]
E persiste o registro com esses valores, nunca aceitos como input direto
E um registro de auditoria `QTDE_EMPREGADO_CADASTRADA` é gravado em HistoricoOperacao
```

**Cenário 2 — Bloqueio: período fora da vigência da Proposta**
```gherkin
Dado que a Proposta "PROP-2026-0001" tem dataInicio=2026-01-01 e dataFim=2026-12-31
Quando o usuário tenta cadastrar uma Qtde. Empregado com Período Final = 2027-03-31
Então o sistema bloqueia o salvamento [RN0154]
E exibe a mensagem "Período não pode extrapolar a vigência da Proposta."
```

**Cenário 3 — Bloqueio: sobreposição de períodos na mesma Proposta**
```gherkin
Dado que já existe uma Qtde. Empregado ativa na Proposta "PROP-2026-0001" com período 2026-01-01 a 2026-06-30
Quando o usuário tenta cadastrar uma nova Qtde. Empregado com período 2026-05-01 a 2026-08-31 (sobreposto)
Então o sistema bloqueia o salvamento [RN0155]
E exibe a mensagem "Já existe um período de consolidação sobreposto para esta Proposta."
```

**Cenário 4 — Bloqueio: campos obrigatórios em branco [TRAVA O ERRO]**
```gherkin
Dado que o usuário está cadastrando uma Qtde. Empregado
Quando ele tenta salvar sem Período Inicial, Período Final ou Número do Documento
Então o sistema bloqueia o salvamento [RN0153]
E exibe a mensagem "Período Inicial, Período Final e Número do Documento são obrigatórios."
```

**Cenário 5 — Alterar Qtde. Empregado recalcula os quantitativos**
```gherkin
Dado que uma Qtde. Empregado existe com quantidadeEmpregados=5 (calculado em 2026-01-10)
E, desde então, mais 2 EmpregadoHeadcount categoria EMPREGADO foram cadastrados e ativados na Proposta
Quando o usuário altera o Número do Documento do registro (único campo além do período)
Então o sistema recalcula quantidadeEmpregados=7 no momento da alteração [ORIGEM BLINDADA]
E um registro de auditoria `QTDE_EMPREGADO_EDITADA` é gravado com os valores anterior e novo
```

**Cenário 6 — Bloqueio: alteração/exclusão em Proposta fora de RASCUNHO/EM_ELABORACAO [TRAVA O ERRO]**
```gherkin
Dado que a Proposta vinculada está com status OFICIALIZADO
Quando o usuário tenta editar ou excluir um registro de Qtde. Empregado
Então o sistema bloqueia a operação [RN0159]
E exibe a mensagem "Não é possível alterar Qtde. Empregado de Proposta homologada ou fechada."
```

**Cenário 7 — Excluir Qtde. Empregado (soft delete)**
```gherkin
Dado que um registro de Qtde. Empregado ativo existe em Proposta RASCUNHO
Quando o usuário confirma a exclusão
Então o sistema marca ativo=false (soft delete)
E um registro de auditoria `QTDE_EMPREGADO_EXCLUIDA` é gravado em HistoricoOperacao
```

**Cenário 8 — Consolidação em Proposta POR_META agrupa apenas os headcounts da Meta vinculada**
```gherkin
Dado que a Proposta "PROP-2026-0002" é POR_META, com Meta única "M1"
E existem 4 EmpregadoHeadcount ativos com metaId="M1" (3 EMPREGADO, 1 ESTAGIARIO)
E existem 2 EmpregadoHeadcount ativos de outra Proposta, sem relação com "M1"
Quando o usuário cadastra uma Qtde. Empregado para a Proposta "PROP-2026-0002"
Então o sistema vincula metaId="M1" automaticamente (mesma Meta 1:1 da versão)
E calcula quantidadeEmpregados=3, quantidadeEstagiarios=1, contando apenas headcounts com metaId="M1"
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Novo model `QtdeEmpregado`: `id`, `tenantId`, `propostaId` (FK `Proposta`), `metaId` (FK `Meta`, nullable — obrigatório só se `Proposta.categoria=POR_META`), `periodoInicio`, `periodoFim`, `numeroDocumento`, `quantidadeEmpregados` (Int, calculado), `quantidadeEstagiarios` (Int, calculado), `quantidadeJovemAprendiz` (Int, calculado), `ativo` (soft delete), `createdAt`, `updatedAt`. **Alteração retroativa em `EmpregadoHeadcount`**: adicionar `metaId` (FK `Meta`, nullable, mesma regra condicional) — cabe ao ADR do Tech Lead definir a migração dos registros existentes |
| Transação? | Sim — COUNT + persistência na mesma transação |
| Requer lock? | Não — mesma simplicidade transacional de Cargo/Viagem/Meta/ItemPatrimonial |
| Auditoria | `QTDE_EMPREGADO_CADASTRADA`, `QTDE_EMPREGADO_EDITADA`, `QTDE_EMPREGADO_EXCLUIDA` em `HistoricoOperacao` |
| Regra de negócio | Quantitativos sempre recalculados via COUNT, nunca input direto; período dentro da vigência da Proposta; sem sobreposição de período na mesma Proposta; edição/exclusão só em RASCUNHO/EM_ELABORACAO |

### Dependências

- **US-108 (EmpregadoHeadcount)**: satisfeita como fonte dos dados de contagem, mas exige alteração retroativa (adicionar `metaId`) antes desta US poder ser implementada.
- **US-112 (Meta)**: satisfeita — reaproveita a mesma Meta 1:1 opcional por versão.
- **ADR do Tech Lead**: formalizar a adição de `metaId` a `EmpregadoHeadcount` e a estratégia de migração dos registros existentes, antes do dev iniciar.

### Definition of Done

- [ ] ADR do Tech Lead sobre `metaId` em `EmpregadoHeadcount` aprovado
- [ ] Critérios de aceite 1 a 8 implementados e testados
- [ ] Quantitativos sempre calculados por COUNT no backend, nunca aceitos como input direto
- [ ] Testado com período fora da vigência da Proposta (deve bloquear)
- [ ] Testado com sobreposição de períodos (deve bloquear)
- [ ] Testado com Proposta fora de RASCUNHO/EM_ELABORACAO na edição/exclusão (deve bloquear)
- [ ] Exclusão testada como soft delete
