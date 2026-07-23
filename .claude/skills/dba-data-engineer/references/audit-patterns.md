# Audit Patterns — SGO 2.0
 
Trilha de auditoria para operações financeiras — imutável, rastreável, consultável.
 
---
 
## Princípios da Auditoria Financeira
 
1. **Append-only:** nenhum UPDATE ou DELETE no `log_alteracoes` — nunca
2. **Atômica:** o log é gravado na mesma transação da operação — ou ambos acontecem ou nenhum
3. **Completa:** captura quem, quando, o quê, de qual estado para qual
4. **Consultável:** estrutura que permite auditoria por entidade, ator, período ou tipo de operação
---
 
## Estrutura da Tabela de Auditoria
 
```sql
CREATE TABLE audit.log_alteracoes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL,
 
  -- O que foi alterado
  entidade       TEXT        NOT NULL,   -- 'empenhos', 'dotacoes', 'liquidacoes'
  entidade_id    UUID        NOT NULL,
  operacao       TEXT        NOT NULL
                             CHECK (operacao IN ('CREATE','UPDATE','CANCEL','REVERSE','APPROVE')),
 
  -- Detalhes da alteração
  campo_alterado TEXT,                   -- NULL para CREATE/CANCEL (afeta tudo)
  valor_anterior JSONB,                  -- estado antes
  valor_novo     JSONB,                  -- estado depois
  motivo         TEXT,                   -- obrigatório para CANCEL e REVERSE
 
  -- Quem e quando
  realizado_por  TEXT        NOT NULL,   -- Clerk userId
  realizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_origem      INET,                   -- IP da requisição
 
  -- Referência a operação relacionada (ex: estorno referencia original)
  operacao_ref_id UUID       REFERENCES audit.log_alteracoes(id)
 
) PARTITION BY RANGE (realizado_em);  -- particionar por mês para volume alto
 
-- Partições mensais (criar com pg_partman ou manualmente)
CREATE TABLE audit.log_alteracoes_2025_01
  PARTITION OF audit.log_alteracoes
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
 
-- Índices para consultas frequentes
CREATE INDEX ON audit.log_alteracoes (org_id, entidade, entidade_id);
CREATE INDEX ON audit.log_alteracoes (org_id, realizado_por, realizado_em DESC);
CREATE INDEX ON audit.log_alteracoes (org_id, entidade, operacao, realizado_em DESC);
 
-- Bloquear UPDATE e DELETE via trigger (imutabilidade garantida no banco)
CREATE OR REPLACE FUNCTION audit.bloquear_alteracao_log()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Registros de auditoria são imutáveis. Operação % bloqueada.', TG_OP;
END;
$$ LANGUAGE plpgsql;
 
CREATE TRIGGER trg_audit_imutavel
  BEFORE UPDATE OR DELETE ON audit.log_alteracoes
  FOR EACH ROW EXECUTE FUNCTION audit.bloquear_alteracao_log();
```
 
---
 
## Função de Registro de Auditoria
 
```sql
-- Função utilitária — chamar dentro da transação principal
CREATE OR REPLACE FUNCTION audit.registrar(
  p_org_id        UUID,
  p_entidade      TEXT,
  p_entidade_id   UUID,
  p_operacao      TEXT,
  p_campo         TEXT      DEFAULT NULL,
  p_valor_antes   JSONB     DEFAULT NULL,
  p_valor_depois  JSONB     DEFAULT NULL,
  p_motivo        TEXT      DEFAULT NULL,
  p_realizado_por TEXT      DEFAULT NULL,
  p_ip            INET      DEFAULT NULL,
  p_ref_id        UUID      DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit.log_alteracoes (
    org_id, entidade, entidade_id, operacao,
    campo_alterado, valor_anterior, valor_novo,
    motivo, realizado_por, ip_origem, operacao_ref_id
  ) VALUES (
    p_org_id, p_entidade, p_entidade_id, p_operacao,
    p_campo, p_valor_antes, p_valor_depois,
    p_motivo, p_realizado_por, p_ip, p_ref_id
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
```
 
---
 
## Uso no Código da Aplicação (via $queryRaw)
 
```typescript
// Dentro de prisma.$transaction()
await prisma.$executeRaw`
  SELECT audit.registrar(
    ${orgId}::uuid,
    'empenhos',
    ${empenhoId}::uuid,
    'CREATE',
    NULL,
    NULL,
    ${JSON.stringify({ numero, valor, dotacaoId, status: 'PENDENTE' })}::jsonb,
    NULL,
    ${userId},
    ${ipAddress}::inet,
    NULL
  )
`
 
// Para UPDATE de status (cancelamento)
await prisma.$executeRaw`
  SELECT audit.registrar(
    ${orgId}::uuid,
    'empenhos',
    ${empenhoId}::uuid,
    'CANCEL',
    'status',
    ${JSON.stringify({ status: statusAnterior })}::jsonb,
    ${JSON.stringify({ status: 'CANCELADO' })}::jsonb,
    ${motivo},
    ${userId},
    ${ipAddress}::inet,
    NULL
  )
`
```
 
---
 
## Trigger de Auditoria Automática (alternativa)
 
Para tabelas onde toda alteração deve ser capturada sem depender da aplicação:
 
```sql
CREATE OR REPLACE FUNCTION audit.capturar_alteracao()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit.log_alteracoes (
      org_id, entidade, entidade_id, operacao, valor_novo, realizado_por
    ) VALUES (
      NEW.org_id, TG_TABLE_NAME, NEW.id, 'CREATE',
      to_jsonb(NEW), current_setting('app.current_user_id', true)
    );
 
  ELSIF TG_OP = 'UPDATE' THEN
    -- Captura apenas se houve mudança real
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO audit.log_alteracoes (
        org_id, entidade, entidade_id, operacao,
        valor_anterior, valor_novo, realizado_por
      ) VALUES (
        NEW.org_id, TG_TABLE_NAME, NEW.id, 'UPDATE',
        to_jsonb(OLD), to_jsonb(NEW),
        current_setting('app.current_user_id', true)
      );
    END IF;
  END IF;
  RETURN NULL; -- AFTER trigger, retorno ignorado
END;
$$ LANGUAGE plpgsql;
 
-- Aplicar na tabela de empenhos
CREATE TRIGGER trg_empenhos_auditoria
  AFTER INSERT OR UPDATE ON orcamento.empenhos
  FOR EACH ROW EXECUTE FUNCTION audit.capturar_alteracao();
```
 
---
 
## Queries de Consulta da Trilha
 
```sql
-- Histórico completo de um empenho
SELECT
  la.operacao,
  la.campo_alterado,
  la.valor_anterior,
  la.valor_novo,
  la.motivo,
  la.realizado_por,
  la.realizado_em,
  la.ip_origem
FROM audit.log_alteracoes la
WHERE la.org_id      = $1
  AND la.entidade    = 'empenhos'
  AND la.entidade_id = $2
ORDER BY la.realizado_em;
 
-- Ações de um usuário no período
SELECT
  la.entidade,
  la.entidade_id,
  la.operacao,
  la.realizado_em
FROM audit.log_alteracoes la
WHERE la.org_id        = $1
  AND la.realizado_por = $2
  AND la.realizado_em BETWEEN $3 AND $4
ORDER BY la.realizado_em DESC;
 
-- Cancelamentos e estornos do dia (alerta de auditoria)
SELECT
  la.entidade,
  la.entidade_id,
  la.valor_anterior->>'valor' AS valor,
  la.motivo,
  la.realizado_por,
  la.realizado_em
FROM audit.log_alteracoes la
WHERE la.org_id    = $1
  AND la.operacao IN ('CANCEL', 'REVERSE')
  AND la.realizado_em >= NOW() - INTERVAL '24 hours'
ORDER BY la.realizado_em DESC;
```
