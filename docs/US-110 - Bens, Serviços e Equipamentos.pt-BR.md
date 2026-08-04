## [US-110] — Manter Bens, Serviços e Equipamentos

**Módulo:** Cadastros — Bens, Serviços e Equipamentos (CAPEX)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M

**Como** Usuário Comum (GFIN),
**Quero** cadastrar, alterar e excluir itens de Bens, Serviços e Equipamentos vinculados a uma Proposta (e, quando aplicável, a uma Meta), com o Valor Total sempre calculado,
**Para** que o custo de investimentos de capital (CAPEX) componha o Valor Orçado da conta analítica com auditabilidade completa.

### Contexto e Regras de Negócio

Cobre UC03.34 a UC03.37 da Minuta V5 (Manter/Cadastrar/Alterar/Excluir Bens, Serviços e Equipamentos). Mesmo padrão de lançamento por conta analítica já validado em US-007/US-101/US-109 (Viagens).

**Mapeamento de termos (decisão já registrada em [[decisao_layout_menu_vs_schema_docx]]):** "Termo de Parceria" na Minuta = `Proposta`/`VersaoProposta` no schema real. "Conta Analítica de Nível 7" = `ContaContabil.isAnalitica=true`, sem exigir nível exato — o schema atual só sincroniza até nível 4 (mesmo gap documentado em US-111); tratar "Nível 7" como jargão legado da Minuta, não como requisito literal.

Decisões propostas para fechamento com o usuário/Tech Lead:

1. **Novo model `ItemPatrimonial`** (nome da classe já citado na própria Minuta, seção "Classes envolvidas"), com campos `descricao`, `data`, `quantidade`, `valorUnitario`, `valorTotal` (calculado = `quantidade × valorUnitario`, nunca input direto — mesmo padrão de `Cargo.custoTotalCargo` e `Viagem.custoEstimado`).
2. **`metaId` opcional (nullable)**, diferente de `Viagem` (que exige `metaId` sempre). A Minuta descreve "Meta Associada (se houver)" — item existe tanto em Proposta `CONSOLIDADA` quanto `POR_META`; só é vinculado a uma Meta quando a Proposta for `POR_META` (RN0170/RN0179 do UC03.36, mesmo padrão condicional já usado em `Meta`/US-112).
3. **Conta vinculada não é restrita a um "grupo Imobilizado" formal** — não existe hoje uma tag ou grupo de contas "Imobilizado/Intangível" no `ContaContabil` (RN0411/RN0419 da Minuta pedem esse filtro). Proposta: aceitar qualquer conta `isAnalitica=true`, sem filtro de grupo — mesma simplificação já aplicada a `ValorOrcadoConta` e `Viagem`. Se o usuário quiser o filtro real, precisa de uma tag de natureza CAPEX/OPEX já cogitada no glossário da Minuta (achado de qualidade documental, não implementado ainda em nenhuma US).
4. **Exclusão: sempre soft delete (`ativo` boolean)**, não a lógica híbrida física/lógica condicional da Minuta (UC03.37 propõe exclusão física se "sem lançamentos vinculados", senão soft delete). Simplificação consistente com todas as US anteriores (`Cargo`, `Viagem`, `EmpregadoHeadcount`) — nenhuma delas implementou exclusão física condicional. Proposto **não implementar hard delete** aqui também.
5. **Sem `TotalizerService`/relatórios de exportação (PDF/CSV/XLSX) nesta US** — RF_PAT_REQ_007, RN_LOG_AQUISICAO e RN0398 (trilha de auditoria de exportação, carimbo temporal em relatório) ficam fora de escopo. Só o CRUD do item patrimonial. Revisitar junto com UC03.38 (Emitir Pré-Visualização), já listado como não refinado no backlog.
6. **Sem lock pessimista** — mesma simplicidade transacional de `Cargo`/`Viagem`/`Meta`, sem concorrência crítica identificada.

### Critérios de Aceite

**Cenário 1 — Cadastrar item patrimonial em Proposta CONSOLIDADA (sem Meta)**
```gherkin
Dado que a Proposta "PROP-2026-0001" está OFICIALIZADA e categoria = CONSOLIDADA
E a Conta Analítica "4.1.2.01 - Equipamentos de TI" existe (isAnalitica=true)
Quando o usuário cadastra um item com:
  | Descrição      | Notebook Dell Latitude |
  | Data           | 2026-08-10              |
  | Quantidade     | 5                        |
  | Valor Unitário | 4500.00                  |
Então o sistema calcula valorTotal = 5 × 4500.00 = 22500.00
E persiste o item com metaId = null
E um registro de auditoria `ITEM_PATRIMONIAL_CADASTRADO` é gravado em HistoricoOperacao
```

**Cenário 2 — Cadastrar item patrimonial em Proposta POR_META (Meta obrigatória)**
```gherkin
Dado que a Proposta "PROP-2026-0002" está OFICIALIZADA e categoria = POR_META
E a Meta única da VersaoProposta vigente existe
Quando o usuário cadastra um item sem selecionar Meta
Então o sistema bloqueia o salvamento
E exibe a mensagem "Meta é obrigatória para Propostas por Meta."
```

**Cenário 3 — Valor Total é sempre calculado, nunca aceito como input**
```gherkin
Dado que o usuário está cadastrando um item com Quantidade = 3 e Valor Unitário = 100.00
Quando ele tenta submeter um valorTotal diferente de 300.00 diretamente no payload
Então o sistema ignora o valor recebido para esse campo
E persiste valorTotal = 300.00 (Quantidade × Valor Unitário) [ORIGEM BLINDADA]
```

**Cenário 4 — Bloqueio: campos obrigatórios em branco [TRAVA O ERRO]**
```gherkin
Dado que o usuário está cadastrando um item patrimonial
Quando ele tenta salvar sem preencher Descrição, Data, Quantidade ou Conta Analítica
Então o sistema bloqueia o salvamento
E exibe a mensagem "Descrição, Data, Quantidade e Conta Analítica são obrigatórios."
```

**Cenário 5 — Bloqueio: quantidade ou valor unitário negativos ou zero**
```gherkin
Dado que o usuário está cadastrando ou alterando um item patrimonial
Quando ele tenta salvar com Quantidade ≤ 0 ou Valor Unitário < 0
Então o sistema bloqueia o salvamento
E exibe a mensagem "Quantidade deve ser maior que zero e Valor Unitário não pode ser negativo."
```

**Cenário 6 — Alterar item patrimonial recalcula Valor Total**
```gherkin
Dado que um item patrimonial existe com Quantidade = 5, Valor Unitário = 4500.00, valorTotal = 22500.00
Quando o usuário altera a Quantidade para 6
Então o sistema recalcula valorTotal = 27000.00
E um registro de auditoria `ITEM_PATRIMONIAL_EDITADO` é gravado com o valor anterior e o novo
```

**Cenário 7 — Excluir item patrimonial (soft delete)**
```gherkin
Dado que um item patrimonial ativo existe
Quando o usuário clica em Excluir e confirma
Então o sistema marca ativo = false (soft delete), sem remover a linha do banco
E o item deixa de aparecer nas listagens ativas
E um registro de auditoria `ITEM_PATRIMONIAL_EXCLUIDO` é gravado em HistoricoOperacao
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Novo model `ItemPatrimonial`: `id`, `tenantId`, `versaoId` (FK `VersaoProposta`), `metaId` (FK `Meta`, nullable), `contaId` (FK `ContaContabil`), `descricao`, `data`, `quantidade` (Int), `valorUnitario` (Decimal 15,2), `valorTotal` (Decimal 15,2, calculado), `ativo` (Boolean, default true), `createdAt`, `updatedAt` |
| Transação? | Sim — cálculo de `valorTotal` na mesma transação da escrita, mesmo padrão de `Viagem.custoEstimado` |
| Requer lock? | Não |
| Auditoria | `ITEM_PATRIMONIAL_CADASTRADO`, `ITEM_PATRIMONIAL_EDITADO`, `ITEM_PATRIMONIAL_EXCLUIDO` em `HistoricoOperacao` |
| Regra de negócio | `valorTotal` sempre recalculado, nunca input direto; `metaId` obrigatório apenas se `Proposta.categoria = POR_META`; `contaId` deve referenciar conta `isAnalitica=true`; exclusão sempre soft delete |

### Dependências

- **US-102 (Proposta/VersaoProposta)**: satisfeita.
- **US-112 (Meta)**: satisfeita — reaproveita a mesma Meta 1:1 opcional por versão.
- **Plano de Contas (US-001 a US-006)**: satisfeita — usa `ContaContabil.isAnalitica`.

### Definition of Done

- [ ] Critérios de aceite 1 a 7 implementados e testados
- [ ] `valorTotal` sempre calculado no backend, nunca aceito como input direto
- [ ] Testado com Proposta CONSOLIDADA (Meta opcional/ausente) e POR_META (Meta obrigatória)
- [ ] Testado com campos obrigatórios em branco (deve bloquear)
- [ ] Testado com quantidade/valor unitário inválidos (deve bloquear)
- [ ] Exclusão testada como soft delete (registro preservado, oculto da listagem ativa)
