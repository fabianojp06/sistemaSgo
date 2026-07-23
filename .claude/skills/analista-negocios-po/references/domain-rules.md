# Domain Rules — Ciclo Orçamentário e Financeiro
 
Regras de negócio do domínio que o SGO 2.0 deve implementar.
Use como base para especificação de critérios de aceite e validações de sistema.
 
---
 
## 1. Regras de Dotação
 
### RN-DOT-001 — Saldo disponível de dotação
**Normativo:** Art. 59, Lei 4.320/64
**Regra:** O saldo disponível de uma dotação é sempre:
`saldo_disponivel = valor_total_dotacao − Σ(empenhos com status ≠ CANCELADO)`
 
O sistema deve calcular e exibir este valor em tempo real. Nunca armazenar como campo
calculável estático sem recalcular na abertura — risco de inconsistência.
 
**Validação crítica:** nenhum empenho pode ser criado se `valor_empenho > saldo_disponivel`.
 
---
 
### RN-DOT-002 — Suplementação de dotação
**Normativo:** Art. 41, Lei 4.320/64
**Regra:** O aumento de dotação (suplementação) exige:
1. Autorização legal (crédito adicional aprovado)
2. Indicação da fonte de recursos (anulação de outra dotação, excesso de arrecadação ou superávit)
3. Registro do ato autorizativo (número do decreto / resolução)
O sistema deve exigir estes três campos antes de permitir a suplementação.
A anulação parcial de dotação como fonte reduz o saldo da dotação anulada.
 
---
 
### RN-DOT-003 — Status de dotação e transições permitidas
 
| Status atual | → Transição para    | Condição                                      |
|--------------|-----------------------|--------------------------------------------------|
| ATIVA        | BLOQUEADA           | Decisão administrativa; nenhum empenho novo   |
| ATIVA        | ENCERRADA           | Fim do exercício ou cancelamento formal       |
| BLOQUEADA    | ATIVA               | Desbloqueio administrativo                    |
| BLOQUEADA    | ENCERRADA           | Cancelamento formal                           |
| ENCERRADA    | (nenhuma)           | Estado terminal — sem reversão                |
 
---
 
## 2. Regras de Empenho (Setor Público)
 
### RN-EMP-001 — Tipos de empenho
**Normativo:** Art. 60, Lei 4.320/64
 
| Tipo         | Quando usar                                                       |
|--------------|---------------------------------------------------------------------|
| **Ordinário**| Despesa com valor certo e pagamento único (ex: compra de material)|
| **Estimativo**| Despesa com valor estimado (ex: água, energia — valor variável)  |
| **Global**   | Despesas com parcelamento (ex: contrato de serviço mensal)       |
 
O tipo afeta a lógica de validação de liquidação: empenho estimativo e global permitem
liquidações parciais até o limite empenhado; ordinário permite apenas uma liquidação integral.
 
---
 
### RN-EMP-002 — Validações obrigatórias na criação do empenho
 
| # | Validação | Mensagem ao usuário | Ação |
|---|-----------|---------------------|------|
| 1 | `valor_empenho > 0` | "O valor do empenho deve ser maior que zero." | Bloquear |
| 2 | `valor_empenho ≤ saldo_disponivel_dotacao` | "Saldo insuficiente na dotação selecionada. Saldo atual: R$ X." | Bloquear |
| 3 | Dotação com `status = ATIVA` | "A dotação selecionada está bloqueada ou encerrada." | Bloquear |
| 4 | Usuário com permissão de `empenhar` | "Você não tem permissão para empenhar nesta dotação." | Bloquear |
| 5 | Exercício orçamentário aberto | "O exercício orçamentário está encerrado para novos empenhos." | Bloquear |
 
---
 
### RN-EMP-003 — Cancelamento de empenho
**Normativo:** Art. 35, § 2º, Lei 4.320/64
 
- Empenho com `status = PENDENTE` ou `APROVADO` pode ser cancelado
- Cancelamento restaura o saldo da dotação: `saldo_disponivel += valor_empenho_cancelado`
- Empenho com qualquer liquidação confirmada **não pode ser cancelado** — apenas estornado liquidação a liquidação
- Cancelamento gera registro de auditoria obrigatório com: ator, data/hora, motivo, valor restaurado
---
 
### RN-EMP-004 — Anulação vs Cancelamento
| Ação        | Quando usar                                    | Efeito no saldo | Registro |
|-------------|--------------------------------------------------|-------------------|----------|
| Cancelamento| Empenho ainda sem liquidação                   | Restaura 100%   | Log + status CANCELADO |
| Anulação parcial | Reduzir valor de empenho global/estimativo| Restaura a diferença | Log + atualiza valor |
 
---
 
## 3. Regras de Liquidação
 
### RN-LIQ-001 — Pré-requisitos da liquidação
**Normativo:** Art. 63, Lei 4.320/64
 
A liquidação deve verificar:
1. Empenho com `status IN (APROVADO)` — não pode liquidar empenho pendente ou cancelado
2. `valor_liquidacao > 0`
3. Para empenho **ordinário**: `valor_liquidacao = valor_empenho` (liquidação total)
4. Para empenho **estimativo/global**: `Σ(liquidações confirmadas) + valor_nova_liquidacao ≤ valor_empenho`
5. Evidência de entrega: documento de atesto obrigatório (número NF, nota de recebimento, etc.)
---
 
### RN-LIQ-002 — Estorno de liquidação
- Liquidação com `status = CONFIRMADA` pode ser estornada se o pagamento ainda não foi realizado
- Liquidação vinculada a pagamento confirmado: **não pode ser estornada** sem estornar o pagamento primeiro
- Estorno gera novo registro (nunca altera o original) com referência ao lançamento estornado
- Nunca usar `DELETE` — criar registro de estorno com `referencia_id = id_liquidacao_original`
---
 
## 4. Regras de Pagamento
 
### RN-PAG-001 — Pré-requisitos do pagamento
**Normativo:** Art. 64, Lei 4.320/64
 
1. Deve existir liquidação confirmada vinculada ao empenho
2. `valor_pagamento ≤ Σ(liquidações confirmadas) − Σ(pagamentos realizados)`
3. Dados bancários do credor validados e presentes
4. Autorização do ordenador de despesa (conforme perfil de permissão)
---
 
### RN-PAG-002 — Idempotência de pagamento
O sistema deve implementar chave de idempotência para evitar pagamento duplo:
- Gerar `idempotency_key` único por operação de pagamento
- Se mesma chave for recebida novamente, retornar o resultado anterior sem processar novamente
- Log de tentativa duplicada deve ser registrado com alerta
---
 
## 5. Regras de OSCIP / Termo de Parceria
 
### RN-OSCIP-001 — Saldo de rubrica
**Normativo:** Decreto 3.100/99, Art. 7º
 
`saldo_rubrica = valor_rubrica_aprovado + remanejamentos_recebidos − remanejamentos_cedidos − Σ(despesas_confirmadas)`
 
Nenhuma despesa pode ser registrada em rubrica com saldo zero ou negativo.
 
---
 
### RN-OSCIP-002 — Limites de remanejamento
**Normativo:** Cláusula padrão de Termo de Parceria (verificar instrumento específico)
 
Regra mais comum (validar no instrumento do concedente):
- Remanejamento de até **10% do valor da rubrica de origem** não requer autorização formal
- Acima de 10%: requer aprovação do concedente com juntada de justificativa formal
- Remanejamento de rubrica de pessoal para custeio ou investimento: geralmente vedado — verificar cláusula
O sistema deve:
1. Calcular o percentual automaticamente
2. Exibir alerta se ultrapassar o limite sem aprovação
3. Exigir campo "número do ofício de aprovação do concedente" quando acima do limite
---
 
### RN-OSCIP-003 — Prestação de contas parcial
- Relatórios de execução devem ser gerados por período (mensal/trimestral conforme o termo)
- Cada rubrica deve exibir: valor aprovado, valor executado, saldo, % de execução
- Despesa sem comprovante (NF-e, recibo formal) não pode ser confirmada — campo obrigatório
- Rendimentos financeiros da conta vinculada devem ser registrados como receita do termo e aplicados conforme autorização do concedente
---
 
## 6. Regras Transversais de Auditoria
 
### RN-AUD-001 — Log obrigatório para todas as operações financeiras
 
Toda operação que altere valor, status ou responsável de um documento financeiro deve gerar
registro em `log_auditoria` com:
 
| Campo           | Valor                                                     |
|-----------------|---------------------------------------------------------------|
| `entidade`      | Nome da tabela (ex: `empenhos`)                          |
| `entidade_id`   | ID do registro afetado                                    |
| `operacao`      | CREATE / UPDATE / CANCEL / REVERSE                       |
| `campo_alterado`| Nome do campo (para UPDATEs)                             |
| `valor_anterior`| Valor antes da operação                                   |
| `valor_novo`    | Valor após a operação                                     |
| `realizado_por` | ID do usuário (Clerk userId)                              |
| `realizado_em`  | Timestamp com fuso horário                               |
| `ip_origem`     | IP da requisição (para auditoria de segurança)           |
| `motivo`        | Campo obrigatório para cancelamentos e estornos          |
 
**Nenhuma operação financeira pode ser implementada sem o registro de auditoria correspondente.**
