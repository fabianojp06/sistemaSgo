# ADR Patterns — SGO 2.0

Referência para o **ADR Mode** do Tech Lead FSG.

## Numeração e Rastreabilidade

ADRs do SGO 2.0 seguem o padrão `ADR-[NNN]` sequencial por módulo:

- `ADR-CORE-001` — decisões da camada core / multi-tenant
- `ADR-ORC-001` — decisões do módulo orçamentário
- `ADR-WF-001` — decisões do workflow de aprovações
- `ADR-INFRA-001` — decisões de infraestrutura / deploy

Se o usuário não informar o módulo, pergunte uma vez e assuma `CORE` por padrão.

---

## Categorias de Decisão Mais Comuns no SGO 2.0

### Isolamento de Tenant

Padrão de decisão mais crítico do projeto. As opções típicas:

| Estratégia         | Quando faz sentido                        | Risco principal                        |
|--------------------|-------------------------------------------|----------------------------------------|
| Schema por tenant  | < 100 tenants, isolamento máximo          | Migration complexa, operação custosa   |
| RLS (Row-Level)    | Muitos tenants, stack Postgres nativa     | Bypass acidental se RLS não estiver ON |
| tenant_id explícito| Simplicidade, time inexperiente com RLS   | Esquecimento em queries ad-hoc         |
| Banco por tenant   | Compliance extremo, dados sensíveis       | Custo operacional alto                 |

**Recomendação padrão para SGO 2.0:** RLS + `tenant_id` explícito como dupla proteção.

---

### Transações e Integridade Orçamentária

Decisões comuns envolvendo consistência:

**Leitura de saldo com atualização simultânea:**
```sql
-- Padrão recomendado para débito orçamentário
BEGIN;
SELECT saldo_disponivel FROM dotacoes
WHERE id = $1 AND tenant_id = $2
FOR UPDATE;           -- lock pessimista na linha

-- validar saldo aqui na aplicação
UPDATE dotacoes SET saldo_disponivel = saldo_disponivel - $3
WHERE id = $1 AND tenant_id = $2;
COMMIT;
```

**Optimistic Locking (alternativa para leitura pesada / escrita rara):**
```sql
UPDATE dotacoes
SET saldo_disponivel = saldo_disponivel - $3,
    version = version + 1
WHERE id = $1 AND tenant_id = $2 AND version = $4;
-- Se 0 rows afetadas → conflito → retry na aplicação
```

---

### Níveis de Isolamento de Transação

| Nível              | Uso recomendado no SGO                                        |
|--------------------|---------------------------------------------------------------|
| `READ COMMITTED`   | Leituras simples, relatórios sem consistência de ponto no tempo |
| `REPEATABLE READ`  | Workflows de aprovação (leitura consistente do estado inicial) |
| `SERIALIZABLE`     | Operações de crédito/débito de dotação com alto concorrência  |

---

### API Design — Operações Financeiras

Para endpoints que movimentam valores orçamentários:

- **Sempre** usar idempotency key (`X-Idempotency-Key` no header ou `idempotency_key` no body)
- **Sempre** retornar o estado pós-operação completo (não apenas `{ success: true }`)
- **Nunca** usar `DELETE` para estorno — usar `POST /estornos` com referência ao lançamento original
- Operações longas (aprovações multi-step): retornar `202 Accepted` + `Location` para polling

---

## Template de Trade-off Rápido

Quando o usuário pede uma recomendação sem ADR formal, use este formato:

```
**Recomendação:** [opção]

**Por quê agora:** [2-3 razões específicas ao contexto SGO]

**O que você abre mão:** [custo aceito]

**Quando revisar:** [condição de gatilho]
```