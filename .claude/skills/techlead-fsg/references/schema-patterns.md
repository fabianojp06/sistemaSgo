# Schema Patterns — SGO 2.0

Referência para o **Schema Mode** e **Perf Mode** do Tech Lead FSG.

## Tipos de Dados: Regras Inegociáveis

| Dado                   | Tipo correto              | Nunca usar        |
|------------------------|---------------------------|-------------------|
| Valores monetários     | `NUMERIC(15,2)`           | `FLOAT`, `DOUBLE` |
| Centavos (alternativa) | `BIGINT` (centavos)       | `DECIMAL` genérico|
| Datas sem hora         | `DATE`                    | `TIMESTAMP`       |
| Timestamps             | `TIMESTAMPTZ`             | `TIMESTAMP` (sem TZ) |
| IDs internos           | `UUID` (gen_random_uuid())| `SERIAL` / `BIGSERIAL` |
| Status/Enum            | `TEXT` + `CHECK` constraint ou enum Postgres | `INT` com mapeamento |
| JSON estruturado       | `JSONB`                   | `JSON`, `TEXT`    |

---

## Template de Tabela Padrão (com Multi-Tenant e Auditoria)

```sql
CREATE TABLE orcamento.dotacoes (
  -- Identificação
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES core.tenants(id),

  -- Dados do domínio
  codigo       TEXT NOT NULL,
  descricao    TEXT NOT NULL,
  valor_total  NUMERIC(15,2) NOT NULL CHECK (valor_total >= 0),
  saldo_disp   NUMERIC(15,2) NOT NULL CHECK (saldo_disp >= 0),
  status       TEXT NOT NULL DEFAULT 'ativa'
               CHECK (status IN ('ativa', 'bloqueada', 'encerrada')),

  -- Otimistic locking
  version      BIGINT NOT NULL DEFAULT 0,

  -- Auditoria (obrigatório)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID NOT NULL REFERENCES core.users(id),
  updated_by   UUID NOT NULL REFERENCES core.users(id),

  -- Constraint de negócio
  CONSTRAINT saldo_nao_negativo CHECK (saldo_disp <= valor_total)
);

-- Índices obrigatórios
CREATE INDEX idx_dotacoes_tenant ON orcamento.dotacoes (tenant_id);
CREATE INDEX idx_dotacoes_tenant_status ON orcamento.dotacoes (tenant_id, status);
CREATE UNIQUE INDEX idx_dotacoes_tenant_codigo ON orcamento.dotacoes (tenant_id, codigo);

-- Trigger para updated_at automático
CREATE TRIGGER trg_dotacoes_updated_at
  BEFORE UPDATE ON orcamento.dotacoes
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
```

---

## Multi-Tenant: Schema Organization

```sql
-- Schemas por responsabilidade
CREATE SCHEMA core;       -- tenant, users, auth
CREATE SCHEMA orcamento;  -- dotações, lançamentos
CREATE SCHEMA workflow;   -- aprovações, etapas
CREATE SCHEMA audit;      -- log de alterações
```

**RLS — Row Level Security:**

```sql
ALTER TABLE orcamento.dotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento.dotacoes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON orcamento.dotacoes
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

Configurar `app.current_tenant_id` no início de cada sessão/conexão via middleware.

---

## Padrão de Log de Auditoria

```sql
CREATE TABLE audit.log_alteracoes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  tabela       TEXT NOT NULL,
  registro_id  UUID NOT NULL,
  operacao     TEXT NOT NULL CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_antes  JSONB,
  dados_depois JSONB,
  alterado_por UUID NOT NULL,
  alterado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_tabela ON audit.log_alteracoes (tenant_id, tabela);
CREATE INDEX idx_audit_registro ON audit.log_alteracoes (tenant_id, tabela, registro_id);
```

---

## Performance: Índices Compostos para SGO

Padrão de índice composto para queries por tenant:

```sql
-- Sempre começar o índice com tenant_id
CREATE INDEX idx_lancamentos_tenant_data
  ON orcamento.lancamentos (tenant_id, data_lancamento DESC);

-- Para filtros de status por tenant
CREATE INDEX idx_lancamentos_tenant_status_data
  ON orcamento.lancamentos (tenant_id, status, data_lancamento DESC)
  WHERE status NOT IN ('cancelado', 'estornado');  -- índice parcial
```

---

## Migrations: Padrão de Segurança

Toda migration deve ter:

```sql
-- migrations/0042_add_saldo_bloqueado_to_dotacoes.sql
-- Descrição: Adiciona coluna saldo_bloqueado para controle de empenhos
-- Autor: [nome]
-- Data: [data]
-- Reversível: SIM (ver DOWN abaixo)
-- Impacto em produção: LOW — ADD COLUMN com DEFAULT, sem lock prolongado

-- UP
ALTER TABLE orcamento.dotacoes
  ADD COLUMN saldo_bloqueado NUMERIC(15,2) NOT NULL DEFAULT 0
  CHECK (saldo_bloqueado >= 0);

-- DOWN
ALTER TABLE orcamento.dotacoes DROP COLUMN saldo_bloqueado;
```

**Operações de alto risco (requerer janela de manutenção):**
- `ALTER TABLE ... SET NOT NULL` em tabela grande (full table scan)
- Adicionar índice sem `CONCURRENTLY`
- Renomear coluna usada por código em produção

**Sempre usar `CREATE INDEX CONCURRENTLY`** para tabelas em produção.

---

## Query Patterns Frequentes no SGO

### Saldo disponível por rubrica (com lock)
```sql
SELECT id, saldo_disp, version
FROM orcamento.dotacoes
WHERE id = $1
  AND tenant_id = $2
  AND status = 'ativa'
FOR UPDATE;
```

### Extrato de lançamentos por período
```sql
SELECT l.*, d.codigo as dotacao_codigo
FROM orcamento.lancamentos l
JOIN orcamento.dotacoes d ON d.id = l.dotacao_id AND d.tenant_id = l.tenant_id
WHERE l.tenant_id = $1
  AND l.data_lancamento BETWEEN $2 AND $3
  AND l.status != 'cancelado'
ORDER BY l.data_lancamento DESC, l.created_at DESC
LIMIT $4 OFFSET $5;
```