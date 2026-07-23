# Schema Design — SGO 2.0
 
Padrões de modelagem de banco de dados para o domínio orçamentário/financeiro.
 
---
 
## Template Padrão de Tabela Financeira
 
```sql
CREATE TABLE orcamento.empenhos (
  -- Identificação
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID          NOT NULL REFERENCES core.organizacoes(id),
 
  -- Chave de negócio (única por tenant + exercício)
  numero          TEXT          NOT NULL,
  exercicio       SMALLINT      NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
 
  -- Relacionamentos
  dotacao_id      UUID          NOT NULL REFERENCES orcamento.dotacoes(id),
  favorecido_id   UUID          NOT NULL REFERENCES cadastro.favorecidos(id),
 
  -- Dados financeiros — NUNCA FLOAT
  valor           NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  tipo            TEXT          NOT NULL CHECK (tipo IN ('ORDINARIO','ESTIMATIVO','GLOBAL')),
  status          TEXT          NOT NULL DEFAULT 'PENDENTE'
                                CHECK (status IN ('PENDENTE','APROVADO','LIQUIDADO','CANCELADO')),
 
  -- Idempotência (prevenir duplicatas em retry)
  idempotency_key UUID          UNIQUE,
 
  -- Auditoria (obrigatório em toda tabela financeira)
  criado_em       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  criado_por      TEXT          NOT NULL,  -- Clerk userId
  atualizado_por  TEXT,
 
  -- Constraints de negócio
  CONSTRAINT empenhos_numero_unico_por_tenant UNIQUE (org_id, exercicio, numero)
);
 
-- ─── Índices ───────────────────────────────────────────────────────────────────
 
-- Acesso primário: sempre por org_id primeiro
CREATE INDEX idx_empenhos_org           ON orcamento.empenhos (org_id);
CREATE INDEX idx_empenhos_org_status    ON orcamento.empenhos (org_id, status);
CREATE INDEX idx_empenhos_org_dotacao   ON orcamento.empenhos (org_id, dotacao_id);
CREATE INDEX idx_empenhos_org_exercicio ON orcamento.empenhos (org_id, exercicio, criado_em DESC);
 
-- Relatórios por favorecido (consulta de limite de dispensa)
CREATE INDEX idx_empenhos_favorecido    ON orcamento.empenhos (org_id, favorecido_id, exercicio);
 
-- ─── Trigger: atualizado_em automático ─────────────────────────────────────────
CREATE TRIGGER trg_empenhos_updated_at
  BEFORE UPDATE ON orcamento.empenhos
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
 
-- ─── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE orcamento.empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento.empenhos FORCE ROW LEVEL SECURITY;
 
CREATE POLICY tenant_isolation ON orcamento.empenhos
  USING (org_id = current_setting('app.current_org_id')::UUID);
```
 
---
 
## Schemas do SGO 2.0
 
```sql
CREATE SCHEMA core;       -- organizações, usuários, configurações globais
CREATE SCHEMA orcamento;  -- dotações, empenhos, liquidações, pagamentos
CREATE SCHEMA cadastro;   -- favorecidos, fornecedores, plano de contas
CREATE SCHEMA relatorio;  -- views materializadas, tabelas de staging para relatórios
CREATE SCHEMA audit;      -- log de auditoria (append-only)
CREATE SCHEMA workflow;   -- aprovações, etapas, histórico de fluxo
```
 
---
 
## Modelo do Ciclo da Despesa
 
```sql
-- Hierarquia: dotacao → empenho → liquidacao → pagamento
-- Constraint: saldo não pode ser negativo em nenhum nível
 
CREATE TABLE orcamento.dotacoes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID          NOT NULL REFERENCES core.organizacoes(id),
  exercicio         SMALLINT      NOT NULL,
  codigo            TEXT          NOT NULL,
  descricao         TEXT          NOT NULL,
  valor_total       NUMERIC(15,2) NOT NULL CHECK (valor_total > 0),
  -- saldo_disponivel é calculado, mas cacheado para performance com lock
  saldo_disponivel  NUMERIC(15,2) NOT NULL CHECK (saldo_disponivel >= 0),
  status            TEXT          NOT NULL DEFAULT 'ATIVA'
                                  CHECK (status IN ('ATIVA','BLOQUEADA','ENCERRADA')),
  version           BIGINT        NOT NULL DEFAULT 0, -- optimistic lock
  criado_em         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  criado_por        TEXT          NOT NULL,
  CONSTRAINT dotacoes_saldo_valido CHECK (saldo_disponivel <= valor_total),
  CONSTRAINT dotacoes_codigo_unico UNIQUE (org_id, exercicio, codigo)
);
 
CREATE TABLE orcamento.liquidacoes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID          NOT NULL,
  empenho_id    UUID          NOT NULL REFERENCES orcamento.empenhos(id),
  valor         NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  status        TEXT          NOT NULL DEFAULT 'PENDENTE'
                              CHECK (status IN ('PENDENTE','CONFIRMADA','ESTORNADA')),
  -- Documento de ateste obrigatório
  doc_numero    TEXT          NOT NULL,
  doc_tipo      TEXT          NOT NULL CHECK (doc_tipo IN ('NF','NFS','RECIBO','CONTRATO','OUTRO')),
  -- Estorno referencia o original
  estorno_de_id UUID          REFERENCES orcamento.liquidacoes(id),
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  criado_por    TEXT          NOT NULL,
  CONSTRAINT liquidacoes_estorno_valido CHECK (
    (estorno_de_id IS NULL) OR (status = 'ESTORNADA')
  )
);
 
CREATE TABLE orcamento.pagamentos (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID          NOT NULL,
  empenho_id     UUID          NOT NULL REFERENCES orcamento.empenhos(id),
  liquidacao_id  UUID          NOT NULL REFERENCES orcamento.liquidacoes(id),
  valor          NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  status         TEXT          NOT NULL DEFAULT 'PENDENTE'
                               CHECK (status IN ('PENDENTE','REALIZADO','ESTORNADO')),
  data_pagamento DATE,
  idempotency_key UUID         UNIQUE,
  criado_em      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  criado_por     TEXT          NOT NULL
);
```
 
---
 
## Tipos e Enums
 
```sql
-- Para enums usados em múltiplas tabelas, criar TYPE
CREATE TYPE orcamento.status_documento AS ENUM (
  'PENDENTE', 'APROVADO', 'CONFIRMADO', 'LIQUIDADO', 'CANCELADO', 'ESTORNADO'
);
 
-- Para enums simples de uma tabela, CHECK constraint é suficiente e mais flexível
-- (não requer migration para adicionar valor)
status TEXT NOT NULL CHECK (status IN ('ATIVA', 'BLOQUEADA', 'ENCERRADA'))
```
 
---
 
## Função utilitária: set_updated_at
 
```sql
-- Criar uma vez no schema core, reusar em todas as tabelas
CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```
 
---
 
## Checklist de Modelagem
 
Antes de finalizar qualquer DDL, verificar:
 
- [ ] `org_id` presente e com FK para `core.organizacoes`
- [ ] Valores monetários como `NUMERIC(15,2)` — sem `FLOAT`
- [ ] Timestamps como `TIMESTAMPTZ` — sem `TIMESTAMP`
- [ ] IDs como `UUID DEFAULT gen_random_uuid()` — sem `SERIAL`
- [ ] `CHECK` constraints em colunas de valor (nunca negativo), status (enum válido), saldo (≤ total)
- [ ] `UNIQUE` na chave de negócio por tenant
- [ ] `FOREIGN KEY` com `ON DELETE RESTRICT` em tabelas financeiras
- [ ] Campos de auditoria: `criado_em`, `atualizado_em`, `criado_por`, `atualizado_por`
- [ ] `version` (optimistic lock) em tabelas com escrita concorrente de saldo
- [ ] Índice em `org_id` (mínimo) e índices compostos para filtros frequentes
- [ ] RLS habilitado e política de isolamento criada
- [ ] Trigger `set_updated_at` aplicado
- [ ] Particionamento avaliado se volume > 500k linhas/ano esperado
