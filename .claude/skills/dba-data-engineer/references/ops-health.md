# Ops Health — SGO 2.0
 
Monitoramento, vacuum, bloat, locks e saúde geral do PostgreSQL em produção.
 
---
 
## Dashboard de Saúde: Queries de Monitoramento
 
### Tabelas mais acessadas (candidatas a índice ou otimização)
 
```sql
SELECT
  schemaname,
  relname                                          AS tabela,
  seq_scan                                         AS scans_sequenciais,
  idx_scan                                         AS scans_por_indice,
  ROUND(idx_scan::NUMERIC / NULLIF(seq_scan + idx_scan, 0) * 100, 1) AS pct_indice,
  n_live_tup                                       AS linhas_vivas,
  n_dead_tup                                       AS linhas_mortas,
  pg_size_pretty(pg_total_relation_size(relid))    AS tamanho_total
FROM pg_stat_user_tables
ORDER BY seq_scan DESC
LIMIT 20;
```
 
> ⚠️ `seq_scan` alto + `idx_scan` baixo em tabela grande = índice faltando ou não sendo usado.
 
---
 
### Índices não utilizados (candidatos a DROP)
 
```sql
SELECT
  schemaname,
  relname    AS tabela,
  indexrelname AS indice,
  idx_scan   AS vezes_usado,
  pg_size_pretty(pg_relation_size(indexrelid)) AS tamanho
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey'    -- nunca remover PKs
  AND indexrelname NOT LIKE '%_unique%' -- nunca remover unique constraints
ORDER BY pg_relation_size(indexrelid) DESC;
```
 
---
 
### Bloat de tabela e índice
 
```sql
-- Estimar bloat de tabelas (dead tuples como % do total)
SELECT
  schemaname,
  relname                                               AS tabela,
  n_live_tup                                            AS linhas_vivas,
  n_dead_tup                                            AS linhas_mortas,
  ROUND(n_dead_tup::NUMERIC / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS pct_mortas,
  last_vacuum::DATE                                     AS ultimo_vacuum,
  last_autovacuum::DATE                                 AS ultimo_autovacuum,
  last_analyze::DATE                                    AS ultimo_analyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```
 
> ⚠️ `pct_mortas` > 20% em tabela com escrita frequente = vacuum atrasado.
> Tabelas de empenho e auditoria são as mais propensas.
 
---
 
### Locks ativos (detectar bloqueios)
 
```sql
-- Queries bloqueadas e quem as bloqueia
SELECT
  blocked.pid                            AS pid_bloqueado,
  blocked_activity.query                 AS query_bloqueada,
  blocked_activity.application_name,
  blocking.pid                           AS pid_bloqueador,
  blocking_activity.query                AS query_bloqueadora,
  EXTRACT(EPOCH FROM NOW() - blocked_activity.query_start) AS segundos_esperando
FROM pg_catalog.pg_locks blocked
JOIN pg_catalog.pg_stat_activity blocked_activity  ON blocked_activity.pid = blocked.pid
JOIN pg_catalog.pg_locks blocking
  ON blocking.locktype = blocked.locktype
  AND blocking.database IS NOT DISTINCT FROM blocked.database
  AND blocking.relation IS NOT DISTINCT FROM blocked.relation
  AND blocking.transactionid IS NOT DISTINCT FROM blocked.transactionid
  AND blocking.pid != blocked.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking.pid
WHERE NOT blocked.granted
ORDER BY segundos_esperando DESC;
```
 
---
 
### Queries de longa duração (candidatas a cancelamento)
 
```sql
SELECT
  pid,
  NOW() - query_start                         AS duracao,
  state,
  LEFT(query, 100)                            AS query_resumida,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '30 seconds'
ORDER BY duracao DESC;
 
-- Cancelar query específica (não mata a conexão)
SELECT pg_cancel_backend(pid);
 
-- Matar conexão (último recurso)
SELECT pg_terminate_backend(pid);
```
 
---
 
## Vacuum e Autovacuum
 
### Forçar vacuum em tabela crítica
 
```sql
-- Vacuum leve (pode rodar com tabela em uso)
VACUUM ANALYZE orcamento.empenhos;
 
-- Vacuum full (reescreve a tabela — BLOQUEIA; usar em janela de manutenção)
VACUUM FULL orcamento.empenhos;
 
-- Após vacuum full, recriar índices para eliminar bloat de índice
REINDEX TABLE CONCURRENTLY orcamento.empenhos;
```
 
### Configurar autovacuum mais agressivo para tabelas financeiras
 
```sql
-- Tabelas com alta taxa de UPDATE (ex: dotacoes — saldo muda a cada empenho)
ALTER TABLE orcamento.dotacoes SET (
  autovacuum_vacuum_scale_factor    = 0.01,  -- padrão 0.20 — vacuuma com 1% de dead tuples
  autovacuum_analyze_scale_factor   = 0.005, -- atualiza estatísticas com 0.5% de mudança
  autovacuum_vacuum_cost_delay      = 2      -- ms entre operações (padrão 20ms)
);
```
 
---
 
## Manutenção Preventiva (Runbook Mensal)
 
```sql
-- 1. Checar tabelas com mais dead tuples
SELECT relname, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
 
-- 2. Checar índices não usados
-- (ver query de índices não utilizados acima)
 
-- 3. Verificar estatísticas desatualizadas
SELECT relname, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE last_analyze < NOW() - INTERVAL '7 days'
  OR last_analyze IS NULL
ORDER BY relname;
 
-- 4. Forçar ANALYZE nas tabelas críticas se necessário
ANALYZE orcamento.dotacoes;
ANALYZE orcamento.empenhos;
ANALYZE orcamento.liquidacoes;
 
-- 5. Verificar tamanho das tabelas e crescimento
SELECT
  schemaname,
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS tamanho_total,
  pg_size_pretty(pg_relation_size(relid))        AS tamanho_dados,
  pg_size_pretty(
    pg_total_relation_size(relid) - pg_relation_size(relid)
  )                                              AS tamanho_indices
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;
```
 
---
 
## Configurações Recomendadas para SGO 2.0 (postgresql.conf)
 
```ini
# Memória
shared_buffers = 25%_da_RAM          # ex: 4GB para servidor com 16GB
effective_cache_size = 75%_da_RAM    # ex: 12GB — hint para o planner
work_mem = 64MB                      # por operação de sort/hash; cuidado com conexões paralelas
maintenance_work_mem = 512MB         # para VACUUM, CREATE INDEX
 
# Checkpoint
checkpoint_completion_target = 0.9
wal_buffers = 64MB
 
# Autovacuum
autovacuum_max_workers = 4           # padrão 3; aumentar para bancos com muitas tabelas
autovacuum_naptime = 30s             # padrão 60s; checar com mais frequência
 
# Logging (para diagnóstico)
log_min_duration_statement = 1000    # logar queries > 1s
log_checkpoints = on
log_lock_waits = on
deadlock_timeout = 1s
```
