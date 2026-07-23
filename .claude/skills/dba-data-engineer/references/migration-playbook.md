# Migration Playbook — SGO 2.0
 
Scripts de migration seguros para produção. Cada migration tem classificação de risco,
estimativa de lock e estratégia de rollback.
 
---
 
## Classificação de Risco
 
| Risco  | Descrição                                               | Requer janela? |
|--------|-----------------------------------------------------------|----------------|
| LOW    | Sem lock prolongado; rollback trivial                   | Não            |
| MEDIUM | Lock breve (< 1s) ou operação com impacto indireto     | Recomendado    |
| HIGH   | Lock prolongado, reescrita de tabela ou sem rollback    | Obrigatório    |
 
---
 
## Template de Migration
 
```sql
-- ============================================================
-- Migration: [NNN]_[descricao_kebab_case]
-- Descrição: [o que faz]
-- Autor:     [nome]
-- Data:      [AAAA-MM-DD]
-- Risco:     LOW / MEDIUM / HIGH
-- Lock:      [estimativa de tempo e escopo do lock]
-- Rollback:  [estratégia / DOWN abaixo]
-- ============================================================
 
-- === UP =====================================================
 
-- <SQL da migration>
 
-- === DOWN ===================================================
 
-- <SQL de rollback>
```
 
---
 
## Operações por Risco
 
### LOW — Seguras a qualquer momento
 
```sql
-- Adicionar coluna com DEFAULT (não bloqueia leituras no PG 11+)
ALTER TABLE orcamento.empenhos
  ADD COLUMN observacao TEXT;
 
-- Adicionar coluna NOT NULL com DEFAULT (PG 11+ não reescreve a tabela)
ALTER TABLE orcamento.empenhos
  ADD COLUMN exercicio SMALLINT NOT NULL DEFAULT 2025;
 
-- Criar índice CONCURRENTLY (não bloqueia writes)
CREATE INDEX CONCURRENTLY idx_empenhos_org_exercicio
  ON orcamento.empenhos (org_id, exercicio);
-- ⚠️ CONCURRENTLY não pode rodar dentro de bloco BEGIN/COMMIT — executar fora de transação
 
-- Criar nova tabela
CREATE TABLE orcamento.notas_empenho ( ... );
 
-- Adicionar CHECK constraint NOT VALID (valida só registros novos)
ALTER TABLE orcamento.empenhos
  ADD CONSTRAINT chk_valor_positivo CHECK (valor > 0) NOT VALID;
-- Depois validar em background:
ALTER TABLE orcamento.empenhos VALIDATE CONSTRAINT chk_valor_positivo;
```
 
### MEDIUM — Planejar horário de menor uso
 
```sql
-- Adicionar FK (adquire lock breve para validar dados existentes)
-- Estratégia: criar FK NOT VALID, validar depois
ALTER TABLE orcamento.empenhos
  ADD CONSTRAINT fk_empenhos_dotacao
  FOREIGN KEY (dotacao_id) REFERENCES orcamento.dotacoes(id)
  NOT VALID;
 
ALTER TABLE orcamento.empenhos VALIDATE CONSTRAINT fk_empenhos_dotacao;
 
-- Renomear coluna (PG 13+ é rápido; versões anteriores reescrevem)
ALTER TABLE orcamento.empenhos RENAME COLUMN valor_old TO valor;
 
-- DROP COLUMN (marca como invisível, não reescreve — mas gera bloat)
ALTER TABLE orcamento.empenhos DROP COLUMN campo_legado;
-- Seguir de VACUUM FULL em janela de manutenção para recuperar espaço
```
 
### HIGH — Obrigatoriamente em janela de manutenção
 
```sql
-- ❌ SET NOT NULL em coluna sem DEFAULT (full table scan + lock)
-- ✅ Estratégia segura em 3 passos:
 
-- Passo 1: Adicionar coluna nullable com DEFAULT
ALTER TABLE orcamento.empenhos ADD COLUMN novo_campo TEXT DEFAULT 'valor_padrao';
 
-- Passo 2: Backfill (pode rodar em batches para não bloquear)
UPDATE orcamento.empenhos
SET novo_campo = 'valor_padrao'
WHERE novo_campo IS NULL;
-- Para tabelas grandes, fazer em batches:
-- UPDATE orcamento.empenhos SET novo_campo = 'x' WHERE id IN (SELECT id FROM orcamento.empenhos WHERE novo_campo IS NULL LIMIT 1000);
 
-- Passo 3: Adicionar constraint NOT NULL (rápido se coluna já está preenchida)
ALTER TABLE orcamento.empenhos ALTER COLUMN novo_campo SET NOT NULL;
 
-- ───────────────────────────────────────────────────────────────
 
-- Mudar tipo de coluna (ex: TEXT → UUID) — reescreve a tabela
-- ✅ Estratégia: coluna paralela
-- 1. Criar nova coluna com tipo correto
ALTER TABLE orcamento.empenhos ADD COLUMN novo_id UUID;
-- 2. Preencher com conversão
UPDATE orcamento.empenhos SET novo_id = org_id_old::uuid WHERE novo_id IS NULL;
-- 3. Adicionar constraints na nova
ALTER TABLE orcamento.empenhos ALTER COLUMN novo_id SET NOT NULL;
-- 4. Em manutenção: renomear colunas
ALTER TABLE orcamento.empenhos RENAME COLUMN org_id TO org_id_deprecated;
ALTER TABLE orcamento.empenhos RENAME COLUMN novo_id TO org_id;
-- 5. Próxima release: DROP COLUMN org_id_deprecated
```
 
---
 
## Particionamento como Migration
 
Converter tabela existente para particionada sem downtime (PG 12+):
 
```sql
-- Estratégia: tabela nova particionada + migração gradual
 
-- 1. Criar tabela particionada
CREATE TABLE orcamento.empenhos_v2 (
  LIKE orcamento.empenhos INCLUDING ALL
) PARTITION BY LIST (exercicio);
 
-- 2. Criar partições
CREATE TABLE orcamento.empenhos_2024
  PARTITION OF orcamento.empenhos_v2
  FOR VALUES IN (2024);
 
CREATE TABLE orcamento.empenhos_2025
  PARTITION OF orcamento.empenhos_v2
  FOR VALUES IN (2025);
 
-- 3. Copiar dados em background (sem lock)
INSERT INTO orcamento.empenhos_v2
SELECT * FROM orcamento.empenhos WHERE exercicio = 2024;
INSERT INTO orcamento.empenhos_v2
SELECT * FROM orcamento.empenhos WHERE exercicio = 2025;
 
-- 4. Em janela de manutenção: renomear
ALTER TABLE orcamento.empenhos     RENAME TO empenhos_legado;
ALTER TABLE orcamento.empenhos_v2  RENAME TO empenhos;
 
-- 5. Manter empenhos_legado por 1 ciclo de release para rollback
```
 
---
 
## Checklist Pré-Deploy
 
- [ ] Migration testada em ambiente de staging com volume similar ao produção
- [ ] `EXPLAIN ANALYZE` executado nas queries impactadas após a migration
- [ ] Rollback (DOWN) testado e validado
- [ ] Para índices: `CREATE INDEX CONCURRENTLY` — nunca dentro de `BEGIN/COMMIT`
- [ ] Para tabelas grandes (> 100k linhas): estimativa de duração medida em staging
- [ ] Backup do banco realizado antes de migrations HIGH
- [ ] Monitoramento de locks ativo durante deploy: `SELECT * FROM pg_locks JOIN pg_stat_activity ...`
## Checklist Pós-Deploy
 
- [ ] `SELECT COUNT(*)` nas tabelas afetadas para verificar dados
- [ ] Queries críticas executadas com `EXPLAIN ANALYZE` para confirmar uso de índice
- [ ] `\d tabela` para confirmar estrutura final
- [ ] Logs de erro do banco monitorados por 15 min após deploy
- [ ] `ANALYZE tabela;` executado para atualizar estatísticas
