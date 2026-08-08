## [US-126] — Excluir (Inativar) Alíquota de Imposto

**Módulo:** Cadastros — Alíquotas de Impostos
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** P

**Como** Administrador com permissão de exclusão em Cadastros,
**Quero** inativar logicamente uma alíquota sem referências ativas,
**Para** removê-la dos lookups de novas Propostas sem perder histórico de auditoria nem quebrar rateios existentes.

### Contexto e Regras de Negócio

Cobre o UC03.42. Segue as diretrizes já usadas em todo o sistema: **[SOFT DELETE]** (nunca exclusão física de registro com histórico de uso) e **[TRAVA O ERRO]** (bloqueio síncrono antes de qualquer commit). Mesmo padrão de `DesativarTributoRateioUseCase`, já existente para `RateioImpostoGrade` — aqui o alvo é o parâmetro global `AliquotaImpostoParametro`, não a linha de rateio.

### Critérios de Aceite

**Cenário 1 — Exclusão lógica sem referências ativas**
```gherkin
Dado que a alíquota "IOF" não está referenciada em nenhum RateioImpostoGrade com ativo = TRUE em Proposta não congelada
Quando o usuário clica em [Excluir] na linha "IOF" e confirma no modal
Então o sistema varre tb_rateio_imposto_grade e confirma ausência de vínculo ativo [RN_IMP_009]
E atualiza ativo = FALSE em AliquotaImpostoParametro (sem DELETE físico) [RN_IMP_010]
E grava log ALIQUOTA_IMPOSTO_INATIVADA em HistoricoOperacao com payload do estado anterior [RN0232]
E a alíquota deixa de aparecer nos lookups de novas Propostas
```

**Cenário 2 — Bloqueio: referência ativa detectada [TRAVA O ERRO / RN_IMP_009]**
```gherkin
Dado que a alíquota "ISS" está referenciada em RateioImpostoGrade com ativo = TRUE em uma Proposta com status EM_ELABORACAO
Quando o usuário tenta excluir "ISS"
Então o sistema bloqueia com "Exclusão Bloqueada [TRAVA O ERRO]: Esta alíquota está sendo utilizada em Propostas ativas. Remova as referências antes de excluir."
E ativo permanece TRUE, nenhum dado é alterado
```

**Cenário 3 — Cancelamento no modal de confirmação**
```gherkin
Dado que o modal de confirmação de exclusão da alíquota "PIS" está aberto
Quando o usuário clica em [Cancelar]
Então o modal fecha sem nenhuma operação
E a alíquota permanece ativa e visível
E nenhum log é gravado
```

**Cenário 4 — Botão [Excluir] desabilitado na origem (reforço do Cenário 5 de US-123)**
```gherkin
Dado que a alíquota "ISS" tem referência ativa
Quando a grid do UC03.39 é renderizada
Então o botão [Excluir] já aparece desabilitado para essa linha, sem permitir sequer abrir o modal
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `AliquotaImpostoParametro` (UPDATE `ativo = false`), leitura de `RateioImpostoGrade` para varredura |
| Campos alterados | `ativo` |
| Transação? | Sim — UPDATE + log na mesma transação ACID [RNF_EXC_REQ_002]; rollback atômico se log falhar |
| Requer lock? | Não além da varredura síncrona pré-commit (não é edição concorrente do mesmo registro, é checagem de referência) |
| Auditoria | `ALIQUOTA_IMPOSTO_INATIVADA`, payload JSON com snapshot completo do estado anterior |
| Regra de negócio | RN_IMP_004 (condicional do botão), RN_IMP_009 (bloqueio por referência ativa), RN_IMP_010 (soft delete mandatório) |

### Dependências

- **US-123 (Manter)**: tela de origem (botão [Excluir] e modal de confirmação).
- **US-124/US-125**: schema (`ativo`) já deve existir via ADR-038.

### Definition of Done

- [ ] Critérios de aceite 1 a 4 implementados e testados
- [ ] Testado com referência ativa em Proposta EM_ELABORACAO (deve bloquear)
- [ ] Testado com referência apenas em Proposta Oficializada/congelada (não deve bloquear — snapshot já é imutável, não depende mais do parâmetro ativo)
- [ ] Confirmado que nenhum DELETE físico é executado em nenhum cenário
- [ ] Log de auditoria com payload completo do estado anterior
