## [US-124] — Cadastrar Alíquota de Imposto

**Módulo:** Cadastros — Alíquotas de Impostos
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Administrador ou Orçamentista com permissão de escrita em Cadastros,
**Quero** cadastrar formalmente um novo tributo e sua alíquota, com histórico de vigência e limites legais,
**Para** que o parâmetro fique disponível para rateio em Propostas sem depender de alteração manual no banco/seed.

### Contexto e Regras de Negócio

Cobre o UC03.40. Formaliza o cadastro de `AliquotaImpostoParametro`, hoje só populável via `prisma/seed.mjs` — não existe nenhum use case de criação no código atual (verificado: nenhum arquivo referencia `aliquotaImpostoParametro.create` fora do seed).

Inclui o campo `contaSinteticaId` (opcional) decidido em **ADR-038**: a alíquota pode carregar uma conta sintética como *sugestão* de natureza de despesa padrão, usada para pré-preencher o formulário de Rateio de Impostos (US-101, `RateioImpostoPanel.tsx`). Isso **não substitui** a obrigatoriedade de `RateioImpostoGrade.contaId` (conta analítica, ADR-027) — a trava de conta obrigatória continua inteiramente no rateio por Proposta, não neste cadastro.

### Campos do Formulário

| Campo | Tipo | Obrig. | Regra |
|---|---|---|---|
| Nome do Imposto | Texto | Sim | Máx. 20 chars, único case-insensitive [RN_IMP_005] |
| Alíquota Padrão (%) | Numérico | Sim | 0,00–100,00%; ISS obrigatoriamente 2,00–5,00% [RN_IMP_006] |
| Tipo de Incidência | Combo | Sim | CONTRATO / TERMO_DE_PARCERIA / AMBOS [RN_PRO_010] |
| Data Início Vigência | Data | Sim | Não retroativa à data do servidor [RN_IMP_007] |
| Data Fim Vigência | Data | Não | NULL = vigência aberta; se informada, posterior à Data Início |
| Limite Mínimo (%) | Numérico | Não | Relevante para ISS, padrão 2,00% |
| Limite Máximo (%) | Numérico | Não | Relevante para ISS, padrão 5,00% |
| Conta Sintética (sugestão) | Select | Não | ADR-038 — apenas default de UX no rateio, não trava nada |
| Observação | Texto longo | Não | Máx. 500 chars |

### Critérios de Aceite

**Cenário 1 — Cadastro com sucesso**
```gherkin
Dado que não existe nenhuma alíquota chamada "COFINS"
Quando o usuário preenche Nome = "COFINS", Alíquota = 3.00, Tipo de Incidência = AMBOS, Data Início = hoje
E clica em [Salvar]
Então o sistema persiste o registro em AliquotaImpostoParametro com ativo = TRUE
E grava log ALIQUOTA_IMPOSTO_CRIADA em HistoricoOperacao na mesma transação [RN0232]
E a nova alíquota aparece na grid do UC03.39 com mensagem de sucesso
```

**Cenário 2 — Bloqueio: nome duplicado (case-insensitive) [TRAVA O ERRO]**
```gherkin
Dado que já existe a alíquota "ISS" cadastrada
Quando o usuário tenta cadastrar "iss" (minúsculo)
Então o sistema bloqueia com "Operação Rejeitada [TRAVA O ERRO]: Já existe uma alíquota cadastrada com o nome iss. Utilize um nome único."
E nenhum registro é persistido
```

**Cenário 3 — Bloqueio: alíquota de ISS fora da faixa legal [TRAVA O ERRO / RN_IMP_006]**
```gherkin
Dado que o usuário está cadastrando uma alíquota com Nome = "ISS"
Quando ele informa Alíquota = 6.50
E clica em [Salvar]
Então o sistema bloqueia com "Alíquota de ISS Inválida [TRAVA O ERRO]: A alíquota de ISS deve estar entre 2,00% e 5,00% conforme a LC 116/2003."
E nenhum registro é persistido
```

**Cenário 4 — Bloqueio: data de início retroativa [TRAVA O ERRO / RN_IMP_007]**
```gherkin
Dado que a data atual do servidor é 2026-08-07
Quando o usuário informa Data Início Vigência = 2026-08-01
E clica em [Salvar]
Então o sistema bloqueia com "Data Inválida [TRAVA O ERRO]: A data de início da vigência não pode ser retroativa à data atual."
E nenhum registro é persistido
```

**Cenário 5 — Alíquota fora da faixa geral [TRAVA O ERRO]**
```gherkin
Dado que o usuário está cadastrando uma alíquota
Quando ele informa Alíquota Padrão = 105.00
E clica em [Salvar]
Então o sistema bloqueia com "Alíquota Inválida [TRAVA O ERRO]: O valor deve estar entre 0,00% e 100,00%."
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `AliquotaImpostoParametro` (migration nova — ver campos do ADR-038) |
| Campos novos | `ativo` (Boolean default true), `dataFimVigencia` (DateTime?), `limiteMinimoPct`/`limiteMaximoPct` (Decimal? 5,2), `observacao` (String? 500), `contaSinteticaId` (String?, FK ContaContabil), `version` (Int default 0) |
| Transação? | Sim — INSERT + log em `HistoricoOperacao` na mesma transação [RN0232]; rollback se log falhar |
| Requer lock? | Não nesta operação (criação, não há concorrência sobre registro ainda inexistente) |
| Auditoria | `ALIQUOTA_IMPOSTO_CRIADA` |
| Regra de negócio | RN_IMP_005 (unicidade), RN_IMP_006 (faixa legal ISS), RN_IMP_007 (não-retroatividade), RN_TAX_06 (isolamento retroativo — nova alíquota não recalcula Propostas já Oficializadas) |

### Dependências

- **ADR-038**: migration de schema é pré-requisito compartilhado com US-123/125/126.
- **US-123 (Manter)**: tela de origem (botão [Novo]).

### Definition of Done

- [ ] Critérios de aceite 1 a 5 implementados e testados
- [ ] Validações E1–E5 do UC03.40 cobertas com teste de unidade no use case
- [ ] Log de auditoria gerado na mesma transação do INSERT
- [ ] Testado com nome duplicado em variação de caixa (case-insensitive)
- [ ] Testado com ISS fora da faixa 2–5%
- [ ] `contaSinteticaId`, quando preenchido, não é validado como obrigatório em lugar nenhum do fluxo (é sugestão, não trava)
