# Multi-Tenant Patterns — SGO 2.0

Referência para o **Tenant Mode** do Tech Lead FSG.

## Estratégia Adotada: RLS + tenant_id Explícito

O SGO 2.0 usa **dupla proteção**:
1. `tenant_id` explícito em toda query (primeira linha de defesa)
2. RLS (Row-Level Security) no Postgres (segunda linha — falha segura)

Nunca confiar em apenas uma das camadas.

---

## Tenant Context: Ciclo de Vida

```
Request HTTP
    ↓
Middleware Next.js
    → verifica JWT / session
    → extrai tenant_id
    → injeta em header interno: x-tenant-id
    ↓
Route Handler / Server Component
    → lê x-tenant-id do header
    → passa para use-case como parâmetro explícito
    ↓
Use Case
    → recebe tenantId como parâmetro
    → passa para repository
    ↓
Repository (Postgres)
    → SET LOCAL app.current_tenant_id = $tenantId (para RLS)
    → WHERE tenant_id = $tenantId em toda query
```

---

## Implementação: Tenant Context no Postgres

```typescript
// lib/db/tenant-aware-client.ts

import { Pool, PoolClient } from 'pg'

export class TenantAwareDb {
  constructor(private pool: Pool) {}

  async withTenant<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      // Configurar tenant para RLS
      await client.query(
        `SET LOCAL app.current_tenant_id = $1`,
        [tenantId]
      )
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
```

---

## Checklist: Nova Entidade/Tabela

Ao criar qualquer nova tabela no SGO 2.0, responder:

1. **É global ou por tenant?**
   - Global (ex: plano de contas padrão, tipos de rubrica): sem `tenant_id`, RLS não se aplica
   - Por tenant (ex: dotações, lançamentos): obrigatório `tenant_id NOT NULL`

2. **Precisa de RLS?**
   - Sim, se contém dados de um único tenant que não devem vazar para outros
   - Não, se é dado de referência global

3. **Índice em tenant_id?**
   - Sempre criar `CREATE INDEX ON tabela (tenant_id)` como mínimo
   - Para queries com filtros adicionais: índice composto com tenant_id primeiro

4. **FK para `core.tenants(id)`?**
   - Sempre, para integridade referencial

---

## Isolamento em Queries: Exemplos

### ✅ Correto
```typescript
// Repository — tenant_id explícito em toda query
async findById(id: string, tenantId: string): Promise<Dotacao | null> {
  const { rows } = await this.db.query(
    `SELECT * FROM orcamento.dotacoes WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  )
  return rows[0] ? this.mapper.toDomain(rows[0]) : null
}
```

### ❌ Errado — vazamento de tenant
```typescript
// NUNCA fazer isso — busca por ID sem filtro de tenant
async findById(id: string): Promise<Dotacao | null> {
  const { rows } = await this.db.query(
    `SELECT * FROM orcamento.dotacoes WHERE id = $1`,  // tenant A pode ver dado do tenant B!
    [id]
  )
  return rows[0] ? this.mapper.toDomain(rows[0]) : null
}
```

---

## Cenários de Borda: Multi-Tenant

### Usuário com acesso a múltiplos tenants
O usuário troca de tenant via seleção explícita na UI. A cada troca:
- Emitir novo token JWT com `tenant_id` atualizado
- Invalidar cache do tenant anterior

### Dados compartilhados entre tenants (ex: tabela de contas)
Usar schema `core` para tabelas globais sem `tenant_id`.
Nunca misturar dados globais e por-tenant na mesma tabela.

### Relatórios cross-tenant (administrador)
Endpoint separado, role separada, audit log obrigatório.
Nunca usar as mesmas queries do domínio principal — criar read models separados.

### Migração de dados entre tenants
Operação manual, com script auditado, aprovação explícita, transação com savepoint.
Nunca fazer via aplicação — sempre via script DBA com registro em `audit.log_alteracoes`.