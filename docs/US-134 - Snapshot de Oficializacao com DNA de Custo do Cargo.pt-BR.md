## [US-134] — Snapshot de Oficialização com DNA de Custo do Cargo

**Módulo:** Cadastros — Cargos e Salários (UC03.19, REQ_CAR_004/RN_CAR_05/RN_CAR_07)
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M
**Bloqueio conhecido:** depende de US-131/US-132/US-133 estarem implementadas (não há DNA de custo novo para congelar sem os campos que elas introduzem).

**Como** Usuário Comum (GFIN) / Auditor,
**Quero** que a oficialização de uma Proposta congele o "DNA de custo" completo de cada Cargo (Fonte Ativa, valor, benefícios, vínculo funcional e origem salarial),
**Para** que qualquer auditoria futura veja exatamente que dados fundamentaram o custo, mesmo que a Tabela Salarial de mercado ou os benefícios da Tabela Mestre mudem depois.

### Contexto e Regras de Negócio

Documento de origem: REQ_CAR_004, RN_CAR_05 (Congelamento de Histórico), RN_CAR_07 (Origem do Valor de Benefício), RN_TAB_05 (Persistência da Origem no Snapshot). O projeto já tem o padrão de snapshot congelado em `EmpregadoHeadcount` (ADR-018) e nos 9 componentes de custo de ADR-029 — esta US estende esse mesmo padrão para o momento de oficialização da Proposta, não do cadastro do Empregado.

**Diferença importante em relação ao padrão existente:** ADR-018 congela no momento do *vínculo do Empregado ao Cargo*. Esta US pede congelamento no momento da *oficialização da Proposta* — são dois eventos de congelamento distintos e não intercambiáveis; a oficialização precisa capturar o estado do Cargo (Fonte Ativa, origem salarial, componentes Rubi) tal como estava naquele instante, mesmo que o Empregado já tivesse sido cadastrado antes.

### Critérios de Aceite

**Cenário 1 — Snapshot gerado na oficialização**
```gherkin
Dado que uma Proposta com Cargos configurados (Fonte Ativa, benefícios, Tabela Salarial/Faixa/Nível do Rubi) está sendo oficializada
Quando o usuário confirma a oficialização
Então o sistema grava, por Cargo, um snapshot imutável com:
  | Fonte Ativa                                  |
  | Valor resultante da Fonte Ativa               |
  | Cada benefício ativo, com seu valor e origem (Tabela Mestre ou Manual) |
  | Vínculo Funcional (rateio, se aplicável — ver gap sobre RN_CAR_02 abaixo) |
  | Origem do Salário Mín/Máx (Tabela Salarial ou Manual) |
  | Tabela Salarial/Faixa/Nível do Rubi (código + descrição) vigentes no momento |
```

**Cenário 2 — Snapshot não muda com alteração posterior**
```gherkin
Dado que uma Proposta foi oficializada com o snapshot do Cenário 1
Quando a Tabela Salarial de mercado ou a Tabela Mestre de benefícios muda depois
Então o snapshot da Proposta já oficializada permanece inalterado
E somente novos cadastros/oficializações refletem os valores atualizados
```

**Cenário 3 — Bloqueio: oficializar sem Fonte Ativa em algum Cargo do headcount**
```gherkin
Dado que existe ao menos 1 Cargo do headcount sem Fonte Ativa selecionada
Quando o usuário tenta oficializar a Proposta
Então o sistema bloqueia com mensagem indicando quais Cargos estão sem Fonte Ativa (RN_CAR_04)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nova tabela ou campo JSON serializado em `VersaoProposta`/evento de oficialização — decisão de modelagem cabe ao Tech Lead |
| Transação? | Sim — snapshot de todos os Cargos do headcount gravado atomicamente com a mudança de status da Proposta para OFICIALIZADA |
| Auditoria | `HistoricoOperacao` registra a oficialização; o snapshot em si é o registro de auditoria de custo |
| Regra de negócio | RN_CAR_04 (bloqueio sem Fonte Ativa) precisa ser checada antes de qualquer gravação |

### Dependências

- US-131, US-132, US-133 (campos que compõem o DNA de custo precisam existir antes de serem congelados)
- Decisão do Tech Lead sobre onde/como persistir o snapshot (tabela própria vs. JSON), dado que o projeto já tem outros pontos de "congelamento" (ADR-018, ADR-029) — avaliar se cabe reaproveitar um mecanismo único de snapshot em vez de um terceiro padrão

### Definition of Done

- [ ] Critérios de aceite implementados
- [ ] Snapshot comprovadamente imutável após oficialização (teste alterando dados de origem depois e conferindo que o snapshot não muda)
- [ ] RN_CAR_04 bloqueando oficialização sem Fonte Ativa
