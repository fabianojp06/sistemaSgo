## [US-125] — Alterar Alíquota de Imposto

**Módulo:** Cadastros — Alíquotas de Impostos
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Administrador ou Orçamentista com permissão de escrita em Cadastros,
**Quero** editar uma alíquota existente sem afetar Propostas já Oficializadas,
**Para** corrigir/atualizar parâmetros fiscais mantendo a imutabilidade orçamentária de snapshots já congelados.

### Contexto e Regras de Negócio

Cobre o UC03.41. Regra central [RN_TAX_03/RN_TAX_06], já validada em produção pelo comportamento existente de `RateioImpostoGrade.aliquotaAplicadaSnapshot`: alterar `AliquotaImpostoParametro.aliquotaPct` **nunca** recalcula Propostas Oficializadas — o snapshot gravado no rateio é imutável. Esta US só formaliza a tela/validações de edição do parâmetro global; o mecanismo de snapshot já existe desde US-101/ADR (`ConfigurarRateioImpostoUseCase` grava `aliquotaAplicadaSnapshot` no momento do rateio).

Exige Optimistic Locking (RNF_TAX_006) via campo `version` (adicionado em ADR-038/US-124) — mesmo padrão já usado em `ValorOrcadoConta`/`RateioImpostoGrade` (US-105).

### Campos do Formulário (Edição)

Mesmos campos de US-124 (Cadastrar), todos editáveis, incluindo `contaSinteticaId` (sugestão, ADR-038). Sem campo travado — diferente de outras entidades do sistema (ex: Salário Real do Cargo), aqui não há campo Read-only.

### Critérios de Aceite

**Cenário 1 — Edição com sucesso**
```gherkin
Dado que a alíquota "PIS" existe com aliquotaPct = 0.65 e version = 0
Quando o usuário altera Alíquota Padrão para 1.65
E clica em [Salvar]
Então o sistema persiste com UPDATE e incrementa version para 1 [RNF_TAX_006]
E grava log delta ALIQUOTA_IMPOSTO_EDITADA em HistoricoOperacao com estado anterior e posterior [RN0232]
E Propostas já Oficializadas que usaram "PIS" mantêm aliquotaAplicadaSnapshot inalterado [RN_TAX_03]
```

**Cenário 2 — Aviso de impacto em Propostas em elaboração (não bloqueante)**
```gherkin
Dado que a alíquota "ISS" está referenciada em RateioImpostoGrade de uma Proposta com status EM_ELABORACAO
Quando o usuário abre o formulário de edição dessa alíquota
Então o sistema exibe o aviso "Atenção: Esta alíquota está sendo utilizada em Propostas em elaboração. Alterações afetarão novos saves nessas Propostas, mas NÃO recalcularão Propostas já Oficializadas." [RN_IMP_008]
E o formulário permanece editável (aviso não bloqueia)
```

**Cenário 3 — Conflito de concorrência (Optimistic Lock) [TRAVA O ERRO]**
```gherkin
Dado que dois usuários abrem o formulário de edição da mesma alíquota "COFINS" (version = 2)
Quando o Usuário A salva primeiro (version vai para 3)
E o Usuário B tenta salvar em seguida enviando version = 2
Então o sistema rejeita com HTTP 409 e mensagem "Conflito de Edição [TRAVA O ERRO]: Outro usuário modificou este registro simultaneamente. Recarregue antes de prosseguir." [RNF_TAX_006]
E nenhuma alteração do Usuário B é persistida
```

**Cenário 4 — Bloqueio: nome duplicado ao editar**
```gherkin
Dado que existem as alíquotas "ISS" e "IOF"
Quando o usuário edita "IOF" e tenta renomear para "iss" (case-insensitive)
Então o sistema bloqueia com a mesma mensagem de US-124 Cenário 2
E nenhuma alteração é persistida
```

**Cenário 5 — Bloqueio: ISS fora da faixa legal ao editar**
```gherkin
Dado que o usuário está editando a alíquota "ISS"
Quando ele altera o valor para 1.50
E clica em [Salvar]
Então o sistema bloqueia com a mesma mensagem de US-124 Cenário 3
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `AliquotaImpostoParametro` (UPDATE) |
| Campos alterados | Todos os campos de US-124, mais `version` (incrementado a cada UPDATE) |
| Transação? | Sim — UPDATE condicional por `version` + log delta na mesma transação [RN0232] |
| Requer lock? | Sim — Optimistic Locking por `version`, mesmo padrão de US-105 |
| Auditoria | `ALIQUOTA_IMPOSTO_EDITADA`, payload com estado anterior × posterior |
| Regra de negócio | RN_TAX_03 (imutabilidade de snapshot Oficializado), RN_TAX_06 (isolamento retroativo), RN_IMP_008 (aviso não-bloqueante), RNF_TAX_006 (Optimistic Locking) |

### Dependências

- **ADR-038 / US-124**: campo `version` e demais campos do schema precisam existir.
- **US-123 (Manter)**: tela de origem (botão [Editar]).

### Definition of Done

- [ ] Critérios de aceite 1 a 5 implementados e testados
- [ ] Optimistic Locking testado com conflito real de concorrência (Cenário 3)
- [ ] Confirmado por teste que editar `aliquotaPct` não altera `RateioImpostoGrade.aliquotaAplicadaSnapshot` de rateios já existentes
- [ ] Aviso de impacto (Cenário 2) não bloqueia o salvamento
- [ ] Log delta com estado antes/depois gravado corretamente
