## [US-108] — Cadastrar e Manter Empregados (Headcount)

**Módulo:** Cadastros — Empregados / RH
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** G

**Como** Gestor de RH (GRH) ou Orçamentista,
**Quero** cadastrar, alterar e excluir empregados/vagas planejadas de uma Proposta, com o custo herdado automaticamente do Cargo selecionado,
**Para** que o headcount da Proposta reflita sempre um custo real e auditável, nunca digitado manualmente.

### Contexto e Regras de Negócio

Esta US cobre o UC03.24 (Manter Empregados), UC03.25 (Cadastrar Empregado), UC03.26 (Alterar Empregado) e UC03.27 (Excluir Empregados) da Minuta V5 — **restrita ao CRUD do headcount (`EmpregadoHeadcount`) com herança de custo do Cargo**. Três recortes de escopo explicitamente fora desta US, decisões confirmadas com o usuário:

1. **Meta não é suportada nesta US.** `Meta` (UC03.13-17) ainda não existe no schema — é o próximo item da fila, depois desta US. `EmpregadoHeadcount` só é aceito para Propostas com `categoria = CONSOLIDADA`. Tentativa de cadastro em Proposta `categoria = POR_META` é bloqueada nesta US (não porque a regra de negócio não exista, mas porque sua fundação — `Meta` — ainda não existe). RN0242 (Ordem resetada por Meta) fica documentada mas não implementada.
2. **Elegibilidade de Benefícios do Empregado (modal individual do UC03.24) vira US-108a.** Depende logicamente de US-107a (Benefícios/Tabela Mestre do Cargo) existir primeiro — não faz sentido o empregado "optar" por um benefício cuja tabela mestre de parâmetros ainda não foi modelada.
3. **Hora Extra, Periculosidade, Faixa e Nível ficam de fora.** Não há definição de tipo de dado, fórmula de impacto no custo, nem se afetam o Totalizador em nenhum lugar da Minuta ou do dicionário de dados — registrado como dívida documental, não como campo do schema.

Achados de qualidade documental (mesmo cuidado já registrado para UC03.07/09/10 e UC03.19):
- **UC03.27 pede exclusão física** ("removido fisicamente da base de dados"), contradizendo a diretriz [SOFT DELETE] que o resto do projeto segue. Decisão confirmada com o usuário: **soft delete via campo `ativo`**, consistente com `Cargo`, `UnidadeFuncional`, `VersaoProposta`. Diverge do texto literal do UC — desvio a ser formalizado pelo Tech Lead (ADR).
- UC03.24 e UC03.25 usam "Cargo CTCEA" e "Vínculo Funcional" como termos de UI para os mesmos campos que no schema são `Cargo.nomeCargoMercado`/`Cargo.unidadeFuncional` — nomenclatura de tela, não de dado.
- REQ_EMP_003 ("Tag de Contingência") e RN0249: nome vazio = vaga "A CONTRATAR" — implementável independente de Meta, mantido nesta US.

**Herança Reativa do Cargo (REQ_EMP_004):** ao selecionar um `Cargo`, o sistema copia (não referencia por join simples) os seguintes valores para o registro do Empregado no momento do cadastro/troca de cargo: Vínculo Funcional (via Cargo), Salário Total, e os componentes que o compõem. Diferente de `ValorOrcadoConta` (calculado on-the-fly), aqui a decisão segue o mesmo padrão adotado em `Cargo.salarioTotal` (US-107, ADR-016): **persistir um snapshot do custo no momento do vínculo**, recalculado sempre que o Cargo do Empregado é trocado — nunca aceito como input direto do usuário [ORIGEM BLINDADA].

### Critérios de Aceite

**Cenário 1 — Cadastrar Empregado com sucesso (headcount nomeado)**
```gherkin
Dado que a Proposta "PROP-2026-001" tem categoria CONSOLIDADA
E existe o Cargo "CARGO-2026-0001 — Analista de Compras Pleno" com Salário Total = 6200.00
Quando o usuário cadastra um Empregado com:
  | Cargo             | CARGO-2026-0001           |
  | Nome              | Maria da Silva            |
  | Período Inicial   | 2026-02-01                |
  | Categoria         | EMPREGADO                 |
  | Nº de Dependentes | 2                         |
Então o Empregado é persistido com "Custo Total Mensal" = 6200.00 (herdado do Cargo, Read-only)
E o "Vínculo Funcional" exibido é herdado do Cargo, não digitado
E um registro de auditoria `EMPREGADO_CRIADO` é gravado em HistoricoOperacao
```

**Cenário 2 — Cadastrar vaga planejada sem nome (RN0249, Tag de Contingência)**
```gherkin
Dado que a Proposta "PROP-2026-001" tem categoria CONSOLIDADA
E existe o Cargo "CARGO-2026-0002"
Quando o usuário cadastra um Empregado com Cargo="CARGO-2026-0002" e Nome em branco
Então o sistema grava o registro com o texto padrão "A CONTRATAR" no lugar do Nome
E o registro é tratado como vaga planejada de contingência
```

**Cenário 3 — Bloqueio: Proposta com categoria POR_META [fora de escopo desta US]**
```gherkin
Dado que a Proposta "PROP-2026-002" tem categoria POR_META
Quando o usuário tenta cadastrar um Empregado para essa Proposta
Então o sistema bloqueia o cadastro
E exibe a mensagem "Empregados de Propostas por Meta ainda não são suportados — aguarde a implementação do módulo de Metas"
```

**Cenário 4 — Bloqueio: campos obrigatórios ausentes (RN0248)**
```gherkin
Dado que o usuário está cadastrando um Empregado
Quando ele tenta salvar sem selecionar um Cargo
Então o sistema bloqueia o salvamento
E exibe a mensagem "Selecione um Cargo antes de salvar o empregado"
E nenhum registro é persistido
```

**Cenário 5 — Bloqueio: Período Inicial retroativo à Proposta (RN0252)**
```gherkin
Dado que a Proposta "PROP-2026-001" tem dataInicio = 2026-01-01
Quando o usuário tenta cadastrar um Empregado com Período Inicial = 2025-12-01
Então o sistema bloqueia o salvamento
E exibe a mensagem "Período Inicial não pode ser anterior à data de início da Proposta"
```

**Cenário 6 — Alterar Empregado: troca de Cargo recalcula o custo herdado [ORIGEM BLINDADA]**
```gherkin
Dado que o Empregado "Maria da Silva" está vinculado ao Cargo "CARGO-2026-0001" (Salário Total 6200.00)
E existe o Cargo "CARGO-2026-0003" com Salário Total = 7100.00
Quando o usuário altera o Empregado trocando o Cargo para "CARGO-2026-0003"
Então o "Custo Total Mensal" do Empregado passa a ser 7100.00
E o "Vínculo Funcional" é atualizado para o do novo Cargo
E um registro de auditoria `EMPREGADO_EDITADO` é gravado com o custo anterior e o novo
```

**Cenário 7 — Bloqueio: tentativa de editar o Custo Total Mensal manualmente [TRAVA O ERRO]**
```gherkin
Dado que um Empregado já foi cadastrado com Custo Total Mensal = 6200.00 (herdado do Cargo)
Quando o usuário tenta submeter uma alteração enviando um valor diferente para "Custo Total Mensal"
Então o sistema ignora o valor recebido para esse campo
E mantém o valor herdado do Cargo vinculado
E o restante dos campos editáveis da requisição é processado normalmente
```

**Cenário 8 — Excluir Empregado com sucesso (soft delete)**
```gherkin
Dado que o Empregado "João Souza" não possui nenhum lançamento operacional vinculado (diárias, viagens, adiantamentos)
E a Proposta está em status RASCUNHO
Quando o usuário confirma a exclusão do Empregado
Então o registro é marcado como `ativo = false` (soft delete — nunca DELETE físico)
E deixa de aparecer na listagem padrão de Empregados
E um registro de auditoria `EMPREGADO_EXCLUIDO` é gravado com o snapshot do estado removido
```

**Cenário 9 — Bloqueio: exclusão de Empregado com vínculo operacional ativo [TRAVA O ERRO, E1 de UC03.27]**
```gherkin
Dado que o Empregado "João Souza" possui uma diária ou viagem homologada vinculada
Quando o usuário tenta excluí-lo
Então o sistema bloqueia a exclusão
E exibe a mensagem "Exclusão Rejeitada: este empregado possui lançamentos operacionais vinculados (diárias, viagens ou adiantamentos)"
```
*(Nota: este cenário depende dos módulos de Viagens/Bens ainda não implementados — mantido como especificação, verificação de vínculo retorna sempre "sem vínculo" até esses módulos existirem.)*

**Cenário 10 — Bloqueio: exclusão fora dos status editáveis da Proposta**
```gherkin
Dado que a Proposta do Empregado está com status OFICIALIZADO
Quando o usuário tenta excluir o Empregado
Então o sistema bloqueia a exclusão
E exibe a mensagem "Ação Negada [TRAVA O ERRO]: esta Proposta está oficializada e seus dados estão congelados"
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nova tabela `EmpregadoHeadcount` (nome definitivo a critério do Tech Lead) |
| Campos alterados | tenantId, propostaId (FK, só CONSOLIDADA), cargoId (FK Cargo), nome (nullable → "A CONTRATAR"), categoria (enum, ex: EMPREGADO/ESTAGIARIO/JOVEM_APRENDIZ), periodoInicio, periodoFim (nullable), numeroDependentes, vinculoFuncionalHerdado (snapshot, texto ou FK), custoTotalMensal (Decimal, snapshot herdado do Cargo), ativo (soft delete) |
| Transação? | Sim — criação/edição/exclusão do Empregado é atômica; snapshot de custo recalculado na mesma transação do vínculo de Cargo |
| Requer lock? | Não neste momento — mesmo raciocínio de `Cargo` (US-107): sem edição concorrente motivadora ainda |
| Auditoria | `EMPREGADO_CRIADO`, `EMPREGADO_EDITADO`, `EMPREGADO_EXCLUIDO` em HistoricoOperacao |
| Regra de negócio | RN0248 (Cargo obrigatório), RN0249 (Tag de Contingência), RN0252 (não retroativo), REQ_EMP_004 (herança reativa do Cargo), bloqueio de categoria POR_META |

### Dependências

- **US-107 (Cargo)**: satisfeita — Empregado herda custo e vínculo funcional do Cargo.
- **US-108a (a criar) — Elegibilidade de Benefícios do Empregado**: fora de escopo aqui; depende de US-107a existir primeiro.
- **Meta (item 6 da fila, ainda não iniciado)**: bloqueia suporte a Proposta `categoria=POR_META` — Cenário 3 documenta o bloqueio, não implementa a regra completa.
- **Viagens/Bens (ainda não iniciados)**: Cenário 9 (bloqueio de exclusão por vínculo operacional) fica com verificação sempre-negativa até esses módulos existirem.
- **Qtde. Empregado (item 7 da fila)**: consome os dados agregados de `EmpregadoHeadcount` — esta US o desbloqueia parcialmente.

### Definition of Done

- [ ] Critérios de aceite 1, 2, 4, 5, 6, 7, 8, 10 implementados e testados
- [ ] Cenário 3 (bloqueio POR_META) implementado como bloqueio simples (categoria ≠ CONSOLIDADA sempre rejeitada por ora)
- [ ] Cenário 9 documentado, não implementado (retorna sempre "sem vínculo" até Viagens/Bens existirem)
- [ ] Custo Total Mensal e Vínculo Funcional são sempre herdados do Cargo, nunca aceitos como input direto
- [ ] Exclusão é sempre soft delete (`ativo=false`), nunca DELETE físico
- [ ] Log de auditoria gerado para criação/edição/exclusão, incluindo snapshot do estado anterior
- [ ] Testado com Proposta Oficializada (exclusão/edição devem bloquear)
- [ ] Testado com tentativa de edição manual do Custo Total Mensal (deve ser ignorada, resto do update passa)
