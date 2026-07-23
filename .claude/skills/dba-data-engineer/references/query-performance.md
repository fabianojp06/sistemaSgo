# Query Performance — SGO 2.0
 
Diagnóstico e otimização de queries lentas no PostgreSQL.
 
---
 
## Fluxo de Diagnóstico
 
```
1. Obter EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
2. Identificar o nó mais custoso (→ maior "actual time")
3. Classificar o problema (ver tabela abaixo)
4. Aplicar a solução correspondente
5. Medir antes e depois com EXPLAIN ANALYZE
```
 
```sql
-- Sempre usar estas opções para diagnóstico completo
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ...;
```
 
---
 
## Classificação de Problemas por Sintoma
 
| Sintoma no EXPLAIN                        | Causa provável                  | Solução                               |
|---------------------------------------------|---------------------------------|---------------------------------------|
| `Seq Scan` em tabela grande               | Índice ausente ou não usado     | Criar índice; verificar tipo de dado  |
| `rows=X (actual rows=Y)` muito diferentes | Estatísticas desatualizadas     | `ANALYZE tabela;`                     |
| `Hash Join` → `Nested Loop` inesperado    | Estimativa de cardinalidade ruim| `ANALYZE`; ajustar `work_mem`         |
| `Sort` sem `Index Scan`                   | `ORDER BY` sem índice           | Índice incluindo a coluna de ordem    |
| `Bitmap Heap Scan` com muitos blocos      | Tabela com alto bloat           | `VACUUM ANALYZE`                      |
| Tempo alto em `Filter`                    | Índice existe mas não é usado   | Checar tipo de dado e cast implícito  |
| `Parallel Seq Scan`                       | Consulta analítica sem índice   | Índice parcial ou view materializada  |
 
---
 
## Índices: Decisão de Criação
 
### Índice simples vs composto
 
```sql
-- Simples: filtra só por org_id (seletividade baixa em multi-tenant)
CREATE INDEX idx_empenhos_org ON orcamento.empenhos (org_id);
 
-- Composto: filtra por org_id + status (muito mais seletivo)
CREATE INDEX idx_empenhos_org_status ON orcamento.empenhos (org_id, status);
 
-- Regra: org_id SEMPRE primeiro no índice composto
-- O Postgres usa o índice composto para queries que filtram só por org_id (leftmost prefix)
-- mas NÃO usa para queries que filtram só por status sem org_id
```
 
### Índice parcial (para filtros com valor fixo comum)
 
```sql
-- Apenas empenhos pendentes — a maioria das queries de workflow
CREATE INDEX idx_empenhos_pendentes
  ON orcamento.empenhos (org_id, criado_em DESC)
  WHERE status = 'PENDENTE';
 
-- Dotações ativas — relatórios excluem encerradas/bloqueadas
CREATE INDEX idx_dotacoes_ativas
  ON orcamento.dotacoes (org_id, exercicio, codigo)
  WHERE status = 'ATIVA';
```
 
### Índice covering (INCLUDE) para evitar heap fetch
 
```sql
-- Query frequente: listar empenhos com valor e status sem acessar heap
CREATE INDEX idx_empenhos_listagem
  ON orcamento.empenhos (org_id, exercicio, criado_em DESC)
  INCLUDE (numero, valor, status, favorecido_id);
-- Com INCLUDE, o Postgres satisfaz a query só com o índice (Index Only Scan)
```
 
### Índice para busca textual
 
```sql
-- Busca por código ou descrição (contains)
CREATE INDEX idx_dotacoes_descricao_trgm
  ON orcamento.dotacoes USING GIN (descricao gin_trgm_ops);
-- Requer: CREATE EXTENSION pg_trgm;
-- Suporta LIKE '%texto%' e iLIKE via índice
```
 
---
 
## Reescrita de Queries Comuns
 
### Anti-pattern: subquery correlacionada
 
```sql
-- ❌ Lento — executa subquery para cada linha da tabela externa
SELECT e.id, e.numero, e.valor,
  (SELECT SUM(l.valor) FROM orcamento.liquidacoes l
   WHERE l.empenho_id = e.id AND l.status = 'CONFIRMADA') AS valor_liquidado
FROM orcamento.empenhos e
WHERE e.org_id = $1;
 
-- ✅ Rápido — LEFT JOIN com agregação
SELECT e.id, e.numero, e.valor,
  COALESCE(liq.total_liquidado, 0) AS valor_liquidado
FROM orcamento.empenhos e
LEFT JOIN (
  SELECT empenho_id, SUM(valor) AS total_liquidado
  FROM orcamento.liquidacoes
  WHERE org_id = $1 AND status = 'CONFIRMADA'
  GROUP BY empenho_id
) liq ON liq.empenho_id = e.id
WHERE e.org_id = $1;
```
 
### Anti-pattern: função em coluna indexada
 
```sql
-- ❌ Impede uso do índice em criado_em
WHERE DATE(criado_em) = '2025-01-15'
 
-- ✅ Usa o índice
WHERE criado_em >= '2025-01-15 00:00:00+00'
  AND criado_em <  '2025-01-16 00:00:00+00'
```
 
### Anti-pattern: LIKE com wildcard à esquerda
 
```sql
-- ❌ Não usa índice B-tree
WHERE codigo LIKE '%001%'
 
-- ✅ Usa índice GIN com pg_trgm
WHERE codigo ILIKE '%001%'  -- com índice GIN trgm criado
-- ou para wildcard apenas à direita (prefixo), B-tree funciona:
WHERE codigo LIKE '01.%'    -- usa índice B-tree normal
```
 
---
 
## Configurações de Sessão para Queries Analíticas
 
```sql
-- Para relatórios pesados (balancetes, execução orçamentária)
SET work_mem = '256MB';          -- mais memória para sorts e hash joins
SET enable_seqscan = OFF;        -- forçar uso de índice (diagnóstico apenas)
 
-- Para verificar configuração atual
SHOW work_mem;
SHOW max_parallel_workers_per_gather;
```
 
---
 
## pg_stat_statements: Identificar Queries Mais Lentas
 
```sql
-- Requer: CREATE EXTENSION pg_stat_statements;
 
-- Top 10 queries por tempo total
SELECT
  LEFT(query, 80)            AS query_resumida,
  calls,
  ROUND(total_exec_time)     AS total_ms,
  ROUND(mean_exec_time)      AS media_ms,
  ROUND(stddev_exec_time)    AS desvio_ms,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
 
-- Queries com pior tempo médio (> 1s)
SELECT LEFT(query, 80), calls, ROUND(mean_exec_time) AS media_ms
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC;
```
 
---
 
## Checklist de Performance
 
Antes de qualquer relatório ou query nova entrar em produção:
 
- [ ] `EXPLAIN ANALYZE` executado com volume representativo (não com tabela vazia)
- [ ] Sem `Seq Scan` em tabelas com mais de 10k linhas
- [ ] `org_id` presente no `WHERE` e coberto pelo índice
- [ ] Nenhuma função em coluna indexada no `WHERE`
- [ ] Subqueries correlacionadas substituídas por JOINs ou CTEs
- [ ] `LIMIT` aplicado em listagens (nunca buscar tudo sem limite)
