# Partitioning Patterns — SGO 2.0
 
Estratégias de particionamento para tabelas grandes do domínio financeiro/orçamentário.
 
---
 
## Quando Particionar
 
| Critério                                      | Decisão              |
|-----------------------------------------------|----------------------|
| Tabela com < 500k linhas/ano                  | Não particionar      |
| Tabela com 500k–2M linhas/ano                 | Avaliar; índices primeiro |
| Tabela com > 2M linhas/ano                    | Particionar          |
| Queries sempre filtram por exercício/data     | Particionar por período |
| Queries sempre filtram por org_id             | Avaliar partition por tenant |
| Necessidade de `DROP` rápido de dados antigos | Particionar (partition pruning) |
 
---
 
## Estratégia 1: Particionamento por Exercício (LIST)
 
Ideal para tabelas orçamentárias onde todo acesso inclui o exercício.
 
```sql
-- Tabela principal (pai)
CREATE TABLE orcamento.empenhos (
  id              UUID          NOT NULL DEFAULT gen_random_uuid(),
  org_id          UUID          NOT NULL,
  exercicio       SMALLINT      NOT NULL,
  numero          TEXT          NOT NULL,
  dotacao_id      UUID          NOT NULL,
  favorecido_id   UUID          NOT NULL,
  valor           NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  status          TEXT          NOT NULL DEFAULT 'PENDENTE',
  criado_em       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  criado_por      TEXT          NOT NULL,
  -- PK deve incluir a chave de particionamento
  PRIMARY KEY (id, exercicio)
) PARTITION BY LIST (exercicio);
 
-- Partição por exercício
CREATE TABLE orcamento.empenhos_2024
  PARTITION OF orcamento.empenhos
  FOR VALUES IN (2024);
 
CREATE TABLE orcamento.empenhos_2025
  PARTITION OF orcamento.empenhos
  FOR VALUES IN (2025);
 
-- Script para criar partição do próximo exercício (rodar em dezembro)
-- CREATE TABLE orcamento.empenhos_2026 PARTITION OF orcamento.empenhos FOR VALUES IN (2026);
 
-- Índices: criados na tabela pai, propagados automaticamente para partições
CREATE INDEX ON orcamento.empenhos (org_id, exercicio, status);
CREATE INDEX ON orcamento.empenhos (org_id, dotacao_id, exercicio);
 
-- RLS na tabela pai — aplica em todas as partições
ALTER TABLE orcamento.empenhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento.empenhos FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orcamento.empenhos
  USING (org_id = current_setting('app.current_org_id')::UUID);
```
 
**Vantagem:** queries com `WHERE exercicio = 2025` fazem partition pruning — Postgres
ignora todas as outras partições e acessa apenas a partição relevante.
 
---
 
## Estratégia 2: Particionamento por Data (RANGE)
 
Para tabelas de auditoria e logs com volume diário alto.
 
```sql
CREATE TABLE audit.log_alteracoes (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL,
  entidade       TEXT        NOT NULL,
  entidade_id    UUID        NOT NULL,
  operacao       TEXT        NOT NULL,
  valor_anterior JSONB,
  valor_novo     JSONB,
  realizado_por  TEXT        NOT NULL,
  realizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, realizado_em)
) PARTITION BY RANGE (realizado_em);
 
-- Partições mensais (criar automaticamente com pg_partman ou script mensal)
CREATE TABLE audit.log_alteracoes_2025_01
  PARTITION OF audit.log_alteracoes
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
 
CREATE TABLE audit.log_alteracoes_2025_02
  PARTITION OF audit.log_alteracoes
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
 
-- Descarte de partições antigas sem DELETE (instantâneo, sem lock)
-- DROP TABLE audit.log_alteracoes_2022_01;  -- remove dados de jan/2022 em milissegundos
```
 
---
 
## Estratégia 3: Sub-particionamento (exercício → org_id)
 
Para sistemas com muitos tenants e volume muito alto por exercício.
 
```sql
-- Partição por exercício (LIST), depois por org_id (HASH)
CREATE TABLE orcamento.lancamentos (
  id        UUID        NOT NULL DEFAULT gen_random_uuid(),
  org_id    UUID        NOT NULL,
  exercicio SMALLINT    NOT NULL,
  valor     NUMERIC(15,2) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, exercicio, org_id)
) PARTITION BY LIST (exercicio);
 
CREATE TABLE orcamento.lancamentos_2025
  PARTITION OF orcamento.lancamentos
  FOR VALUES IN (2025)
  PARTITION BY HASH (org_id);
 
-- 4 sub-partições por hash de org_id
CREATE TABLE orcamento.lancamentos_2025_0
  PARTITION OF orcamento.lancamentos_2025
  FOR VALUES WITH (modulus 4, remainder 0);
-- ... e assim por diante para remainder 1, 2, 3
```
 
---
 
## Verificar Partition Pruning
 
```sql
-- Confirmar que o Postgres está usando partition pruning
EXPLAIN SELECT * FROM orcamento.empenhos
WHERE org_id = '...' AND exercicio = 2025;
-- Deve mostrar: "Partitions: empenhos_2025" — não todas as partições
 
-- Se mostrar todas as partições, verificar:
-- 1. exercicio está no WHERE?
-- 2. Tipo do parâmetro bate com o tipo da coluna? (SMALLINT vs INT)
-- 3. enable_partition_pruning = on? (padrão)
SHOW enable_partition_pruning;
```
 
---
 
## pg_partman: Automação de Partições
 
Para produção, usar pg_partman para criar partições automaticamente:
 
```sql
-- Instalar extensão (requer superuser)
CREATE EXTENSION pg_partman SCHEMA partman;
 
-- Configurar gerenciamento automático de partições mensais
SELECT partman.create_parent(
  p_parent_table  => 'audit.log_alteracoes',
  p_control       => 'realizado_em',
  p_type          => 'range',
  p_interval      => 'monthly',
  p_premake       => 3   -- cria 3 partições futuras com antecedência
);
 
-- Rodar manutenção (via cron job ou pg_cron)
SELECT partman.run_maintenance();
```
 
---
 
## Queries de Monitoramento de Partições
 
```sql
-- Listar partições de uma tabela com tamanho
SELECT
  child.relname                          AS particao,
  pg_size_pretty(pg_relation_size(child.oid)) AS tamanho,
  pg_size_pretty(pg_total_relation_size(child.oid)) AS tamanho_total
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname = 'empenhos'
ORDER BY child.relname;
 
-- Verificar se partition pruning está funcionando
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM orcamento.empenhos WHERE exercicio = 2025;
-- Deve mostrar "Partitions selected: 1 (out of N)"
```
