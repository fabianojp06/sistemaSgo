# Report Queries — SGO 2.0
 
SQL para relatórios analíticos do domínio orçamentário/financeiro.
Todos os exemplos usam CTEs nomeadas para legibilidade e manutenibilidade.
 
---
 
## Relatório 1: Execução Orçamentária por Dotação
 
O relatório mais crítico do SGO — base do Balanço Orçamentário (Lei 4.320/64, Art. 72).
 
```sql
-- Execução orçamentária por dotação — exercício completo
-- Parâmetros: $1 = org_id, $2 = exercicio
 
WITH
-- 1. Dotações base do exercício
dotacoes_base AS (
  SELECT
    id,
    org_id,
    codigo,
    descricao,
    valor_total       AS dotacao_inicial,
    status
  FROM orcamento.dotacoes
  WHERE org_id = $1
    AND exercicio = $2
),
 
-- 2. Suplementações e anulações (créditos adicionais)
movimentos_dotacao AS (
  SELECT
    dotacao_id,
    SUM(CASE WHEN tipo = 'SUPLEMENTACAO' THEN valor ELSE 0 END) AS total_suplementado,
    SUM(CASE WHEN tipo = 'ANULACAO'      THEN valor ELSE 0 END) AS total_anulado
  FROM orcamento.movimentos_dotacao
  WHERE org_id = $1 AND exercicio = $2
  GROUP BY dotacao_id
),
 
-- 3. Empenhos válidos (exceto cancelados)
empenhos_agg AS (
  SELECT
    dotacao_id,
    SUM(valor) AS total_empenhado,
    COUNT(*)   AS qtd_empenhos
  FROM orcamento.empenhos
  WHERE org_id = $1
    AND exercicio = $2
    AND status != 'CANCELADO'
  GROUP BY dotacao_id
),
 
-- 4. Liquidações confirmadas
liquidacoes_agg AS (
  SELECT
    e.dotacao_id,
    SUM(l.valor) AS total_liquidado
  FROM orcamento.liquidacoes l
  JOIN orcamento.empenhos e ON e.id = l.empenho_id
  WHERE l.org_id = $1
    AND e.exercicio = $2
    AND l.status = 'CONFIRMADA'
  GROUP BY e.dotacao_id
),
 
-- 5. Pagamentos realizados
pagamentos_agg AS (
  SELECT
    e.dotacao_id,
    SUM(p.valor) AS total_pago
  FROM orcamento.pagamentos p
  JOIN orcamento.empenhos e ON e.id = p.empenho_id
  WHERE p.org_id = $1
    AND e.exercicio = $2
    AND p.status = 'REALIZADO'
  GROUP BY e.dotacao_id
)
 
-- Montagem final
SELECT
  d.codigo,
  d.descricao,
  d.dotacao_inicial,
  COALESCE(m.total_suplementado, 0)                                   AS suplementacoes,
  COALESCE(m.total_anulado, 0)                                        AS anulacoes,
  -- Dotação atual = inicial + suplementações - anulações
  d.dotacao_inicial
    + COALESCE(m.total_suplementado, 0)
    - COALESCE(m.total_anulado, 0)                                    AS dotacao_atual,
  COALESCE(e.total_empenhado, 0)                                      AS empenhado,
  COALESCE(liq.total_liquidado, 0)                                    AS liquidado,
  COALESCE(pag.total_pago, 0)                                         AS pago,
  -- Saldos derivados
  (d.dotacao_inicial
    + COALESCE(m.total_suplementado, 0)
    - COALESCE(m.total_anulado, 0))
    - COALESCE(e.total_empenhado, 0)                                  AS saldo_a_empenhar,
  COALESCE(e.total_empenhado, 0) - COALESCE(liq.total_liquidado, 0)  AS saldo_a_liquidar,
  COALESCE(liq.total_liquidado, 0) - COALESCE(pag.total_pago, 0)     AS saldo_a_pagar,
  -- Percentual de execução
  CASE
    WHEN (d.dotacao_inicial + COALESCE(m.total_suplementado, 0) - COALESCE(m.total_anulado, 0)) = 0
    THEN 0
    ELSE ROUND(
      COALESCE(e.total_empenhado, 0) * 100.0
      / (d.dotacao_inicial + COALESCE(m.total_suplementado, 0) - COALESCE(m.total_anulado, 0)),
      2
    )
  END                                                                  AS perc_execucao,
  COALESCE(e.qtd_empenhos, 0)                                         AS qtd_empenhos,
  d.status
 
FROM dotacoes_base d
LEFT JOIN movimentos_dotacao m   ON m.dotacao_id = d.id
LEFT JOIN empenhos_agg e         ON e.dotacao_id = d.id
LEFT JOIN liquidacoes_agg liq    ON liq.dotacao_id = d.id
LEFT JOIN pagamentos_agg pag     ON pag.dotacao_id = d.id
 
ORDER BY d.codigo;
```
 
---
 
## Relatório 2: Balancete por Rubrica (OSCIP)
 
```sql
-- Balancete de execução do Termo de Parceria por rubrica
-- Parâmetros: $1 = org_id, $2 = termo_id
 
WITH
rubricas_base AS (
  SELECT id, codigo, descricao, categoria, valor_aprovado
  FROM oscip.rubricas
  WHERE org_id = $1 AND termo_id = $2
  ORDER BY codigo
),
 
remanejamentos AS (
  SELECT
    rubrica_id,
    SUM(CASE WHEN tipo = 'ENTRADA' THEN valor ELSE -valor END) AS saldo_remanejamento
  FROM oscip.remanejamentos
  WHERE org_id = $1 AND termo_id = $2 AND status = 'APROVADO'
  GROUP BY rubrica_id
),
 
despesas AS (
  SELECT
    rubrica_id,
    SUM(valor) AS total_executado,
    COUNT(*)   AS qtd_lancamentos
  FROM oscip.lancamentos_despesa
  WHERE org_id = $1 AND termo_id = $2 AND status = 'CONFIRMADO'
  GROUP BY rubrica_id
)
 
SELECT
  r.codigo,
  r.descricao,
  r.categoria,
  r.valor_aprovado,
  COALESCE(rem.saldo_remanejamento, 0)            AS remanejamentos,
  r.valor_aprovado
    + COALESCE(rem.saldo_remanejamento, 0)        AS valor_atual,
  COALESCE(d.total_executado, 0)                  AS executado,
  COALESCE(d.qtd_lancamentos, 0)                  AS qtd_lancamentos,
  r.valor_aprovado
    + COALESCE(rem.saldo_remanejamento, 0)
    - COALESCE(d.total_executado, 0)              AS saldo_disponivel,
  CASE
    WHEN (r.valor_aprovado + COALESCE(rem.saldo_remanejamento, 0)) = 0 THEN 0
    ELSE ROUND(
      COALESCE(d.total_executado, 0) * 100.0
      / (r.valor_aprovado + COALESCE(rem.saldo_remanejamento, 0)), 2
    )
  END                                             AS perc_executado
 
FROM rubricas_base r
LEFT JOIN remanejamentos rem ON rem.rubrica_id = r.id
LEFT JOIN despesas d         ON d.rubrica_id = r.id
 
ORDER BY r.codigo;
```
 
---
 
## Relatório 3: Extrato de Empenhos com Window Functions
 
```sql
-- Extrato com saldo acumulado por dotação — útil para auditoria
-- Parâmetros: $1 = org_id, $2 = dotacao_id, $3 = data_inicio, $4 = data_fim
 
SELECT
  e.numero,
  e.criado_em::DATE                                              AS data_empenho,
  f.nome                                                         AS favorecido,
  e.tipo,
  e.status,
  e.valor,
  -- Saldo acumulado de empenhos válidos na dotação
  SUM(CASE WHEN e.status != 'CANCELADO' THEN e.valor ELSE 0 END)
    OVER (
      PARTITION BY e.org_id, e.dotacao_id
      ORDER BY e.criado_em
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                            AS valor_empenhado_acumulado,
  d.saldo_disponivel                                             AS saldo_atual_dotacao,
  -- Total liquidado por empenho
  COALESCE(liq.total_liquidado, 0)                              AS total_liquidado,
  -- Total pago por empenho
  COALESCE(pag.total_pago, 0)                                   AS total_pago,
  -- Saldo a liquidar
  CASE WHEN e.status != 'CANCELADO'
    THEN e.valor - COALESCE(liq.total_liquidado, 0)
    ELSE 0
  END                                                            AS saldo_a_liquidar
 
FROM orcamento.empenhos e
JOIN orcamento.dotacoes d      ON d.id = e.dotacao_id
JOIN cadastro.favorecidos f    ON f.id = e.favorecido_id
LEFT JOIN (
  SELECT empenho_id, SUM(valor) AS total_liquidado
  FROM orcamento.liquidacoes
  WHERE org_id = $1 AND status = 'CONFIRMADA'
  GROUP BY empenho_id
) liq ON liq.empenho_id = e.id
LEFT JOIN (
  SELECT empenho_id, SUM(valor) AS total_pago
  FROM orcamento.pagamentos
  WHERE org_id = $1 AND status = 'REALIZADO'
  GROUP BY empenho_id
) pag ON pag.empenho_id = e.id
 
WHERE e.org_id     = $1
  AND e.dotacao_id = $2
  AND e.criado_em  >= $3
  AND e.criado_em  <  $4
 
ORDER BY e.criado_em, e.numero;
```
 
---
 
## Relatório 4: Ranking de Favorecidos por Volume
 
```sql
-- Útil para controle de limite de dispensa (Art. 75, Lei 14.133/21)
-- Parâmetros: $1 = org_id, $2 = exercicio
 
SELECT
  f.cpf_cnpj,
  f.nome,
  COUNT(e.id)                AS qtd_empenhos,
  SUM(e.valor)               AS valor_total_empenhado,
  SUM(e.valor)
    OVER ()                  AS total_geral,             -- total de todos os favorecidos
  ROUND(
    SUM(e.valor) * 100.0
    / SUM(e.valor) OVER (), 2
  )                          AS perc_do_total,
  RANK() OVER (ORDER BY SUM(e.valor) DESC) AS ranking
 
FROM orcamento.empenhos e
JOIN cadastro.favorecidos f ON f.id = e.favorecido_id
 
WHERE e.org_id    = $1
  AND e.exercicio = $2
  AND e.status   != 'CANCELADO'
 
GROUP BY f.id, f.cpf_cnpj, f.nome
 
ORDER BY valor_total_empenhado DESC;
```
 
---
 
## Views Materializadas para Relatórios Pesados
 
```sql
-- View materializada de execução orçamentária (atualização programada ou sob demanda)
CREATE MATERIALIZED VIEW relatorio.execucao_orcamentaria AS
  -- <query completa do Relatório 1 sem parâmetros — filtrar no app>
  SELECT ... FROM ...
WITH DATA;
 
-- Índice na view materializada
CREATE INDEX idx_mv_execucao_org_exercicio
  ON relatorio.execucao_orcamentaria (org_id, exercicio);
 
-- Atualização (chamar após mutações em dotações/empenhos/liquidações/pagamentos)
REFRESH MATERIALIZED VIEW CONCURRENTLY relatorio.execucao_orcamentaria;
-- CONCURRENTLY: permite leituras durante o refresh (requer índice UNIQUE na view)
```
 
---
 
## Dicas de Uso no Prisma ($queryRaw)
 
```typescript
// Relatório parametrizado via Prisma — sempre usar tagged template (proteção contra SQL injection)
const resultado = await prisma.$queryRaw<ExecucaoRow[]>`
  WITH dotacoes_base AS (
    SELECT id, codigo, descricao, valor_total
    FROM orcamento.dotacoes
    WHERE org_id = ${orgId}::uuid
      AND exercicio = ${exercicio}
  )
  -- ...resto da query
  SELECT * FROM dotacoes_base
  ORDER BY codigo
`
 
// Decimal vem como string do $queryRaw — converter:
const rows = resultado.map(r => ({
  ...r,
  valor_total:  Number(r.valor_total),
  empenhado:    Number(r.empenhado),
}))
```
