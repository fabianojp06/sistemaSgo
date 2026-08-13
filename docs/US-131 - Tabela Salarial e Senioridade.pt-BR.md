## [US-131] — Manter Tabela Salarial de Mercado (por Cargo e Senioridade)

**Módulo:** Cadastros — Cargos e Salários (UC03.19, seção 5 da Rev. Jun/2026 — Tabela Salarial 🆕)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M

**Como** Usuário GRH,
**Quero** cadastrar faixas de salário de mercado por Cargo e Senioridade, e consultá-las a partir da tela de Cargos,
**Para** que o preenchimento de Salário Mínimo/Máximo do Cargo tenha uma fonte de pesquisa de mercado auditável, em vez de digitação livre sem referência.

### Contexto e Regras de Negócio

Documento de origem: `Tela-Cadastro-de-Cargos-Salarios-Rev-Jun2026.docx`, seção 5 (GAP-CAR-001, ✅ resolvido) e REQ_TAB_001-005/RN_TAB_01-05. É uma tela nova, natureza de tabela de mercado **independente** — sem vínculo com os campos Tabela Salarial/Faixa/Nível que virão do Rubi (US-132), que são dados soberanos do Senior.

**Senioridade é um catálogo extensível por tenant:** Júnior/Pleno/Sênior nascem como registros protegidos (`isPadrao=true`, não podem ser excluídos); GRH pode cadastrar níveis customizados, excluídos apenas se não tiverem registro vinculado na Tabela Salarial (RN_TAB_01).

**Cargo + Senioridade não é chave única** (RN_TAB_03) — pode haver múltiplos registros para o mesmo par (ex.: 2 pesquisas de mercado em datas diferentes); a consulta a partir da tela de Cargos exibe todos, agrupados por senioridade, e o usuário escolhe qual usar.

Ao selecionar uma faixa na Tabela Salarial a partir da tela de Cargos, o sistema copia `salarioMinimo`/`salarioMaximo` para os campos correspondentes do Cargo e grava a origem (`TABELA_SALARIAL`); uma edição manual subsequente desses campos muda a origem para `MANUAL` (RN_TAB_04/05 — ver US-133 para o comportamento na tela de Cargos).

### Critérios de Aceite

**Cenário 1 — Cadastrar faixa salarial de mercado**
```gherkin
Dado que o Cargo "Analista de Sistemas" já existe no SGO
E a Senioridade "Sênior" existe (padrão, protegida)
Quando o usuário GRH cadastra na Tabela Salarial:
  | Cargo        | Analista de Sistemas |
  | Senioridade  | Sênior                |
  | Salário Mín. | 6500.00               |
  | Salário Máx. | 9200.00               |
Então o sistema persiste o registro
E grava `criadoPor`/`criadoEm` para auditoria
```

**Cenário 2 — Bloqueio: Salário Mínimo >= Salário Máximo [TRAVA O ERRO]**
```gherkin
Dado que o usuário está cadastrando uma faixa com Salário Mínimo = 9000.00 e Salário Máximo = 8500.00
Quando ele tenta salvar
Então o sistema bloqueia com "Salário Mínimo deve ser menor que o Salário Máximo." [TRAVA O ERRO]
E nenhum registro é persistido
```

**Cenário 3 — Cadastrar Senioridade customizada**
```gherkin
Dado que o usuário GRH precisa de um nível "Especialista", inexistente no catálogo padrão
Quando ele cadastra a Senioridade "Especialista" (isPadrao=false)
Então o sistema persiste o novo nível
E ele passa a estar disponível para seleção na Tabela Salarial
```

**Cenário 4 — Bloqueio: excluir Senioridade padrão ou com registros vinculados**
```gherkin
Dado que o usuário tenta excluir a Senioridade "Sênior" (padrão) OU uma Senioridade customizada com registros na Tabela Salarial
Quando ele aciona "Excluir"
Então o sistema bloqueia com mensagem explicando o motivo (padrão protegida / possui registros vinculados) [TRAVA O ERRO]
```

**Cenário 5 — Consultar Tabela Salarial a partir da tela de Cargos**
```gherkin
Dado que o Cargo "Analista de Sistemas" tem 3 registros na Tabela Salarial (Júnior, Pleno, Sênior)
Quando o usuário aciona o botão "Tabela Salarial" na tela de Cargos
Então o sistema abre a lista filtrada pelo Cargo em contexto, agrupada por Senioridade
E o usuário pode selecionar 1 registro para copiar Mín/Máx para o Cargo (ver US-133, Cenário 1)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas novas | `TabelaSalarial` (id, cargoId, senioridadeId, salarioMinimo, salarioMaximo, criadoPor, criadoEm), `Senioridade` (id, descricao, isPadrao, ativo) |
| Transação? | Não — CRUD simples, sem operação multi-tabela atômica |
| Requer lock? | Não |
| Auditoria | `criadoPor`/`criadoEm` na própria tabela; exclusão de Senioridade registrada em `HistoricoOperacao` |
| Seed | Senioridade padrão (Júnior/Pleno/Sênior, `isPadrao=true`) seedada por tenant na primeira execução do módulo |
| Regra de negócio | Validação Mín < Máx no use case; bloqueio de exclusão de Senioridade padrão ou referenciada |

### Dependências

- Nenhuma — tela e tabelas independentes, mas consumida por US-133 (preenchimento automático na tela de Cargos)

### Definition of Done

- [ ] Critérios de aceite implementados e aprovados em homologação
- [ ] Bloqueio de Mín >= Máx testado
- [ ] Exclusão de Senioridade padrão bloqueada
- [ ] Exclusão de Senioridade customizada com registros vinculados bloqueada
- [ ] Múltiplos registros por par Cargo+Senioridade suportados (sem unique constraint indevida)
