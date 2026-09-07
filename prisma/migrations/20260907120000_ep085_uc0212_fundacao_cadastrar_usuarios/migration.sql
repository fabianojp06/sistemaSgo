-- EP085 / UC02.12 — Fundação do "Cadastrar Usuários" (US-201..205).
-- Risco: BAIXO — enums novos, colunas com default, backfill determinístico de `login`,
-- tabela nova aditiva. Nenhum recálculo financeiro, nenhum dado de negócio alterado.
-- Rollback ao final do arquivo.

-- 1. Novos tipos de operação para a trilha de auditoria (UC02.22).
ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'USUARIO_CRIADO';
ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'USUARIO_PERFIL_ASSOCIADO';
ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'USUARIO_PERFIL_DESASSOCIADO';
ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'USUARIO_PERFIL_EXCECAO_DEFINIDA';
ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'USUARIO_ACESSO_GERADO';
ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'USUARIO_CONVITE_REENVIADO';

-- 2. Situação do acesso inicial do usuário (US-204).
CREATE TYPE "SituacaoAcessoUsuario" AS ENUM ('CONVITE_PENDENTE', 'CONVITE_ENVIADO', 'FALHA_ENVIO_CONVITE', 'ACESSO_ATIVO');

-- 3. Usuario: login de negócio + situacaoAcesso.
--    `login` entra nullable, é backfilled a partir do e-mail e só então vira NOT NULL.
ALTER TABLE "Usuario" ADD COLUMN "login" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "situacaoAcesso" "SituacaoAcessoUsuario" NOT NULL DEFAULT 'ACESSO_ATIVO';

-- Backfill: usuários já existentes recebem login = parte local do e-mail; colisões
-- ganham sufixo pelo id. Já autenticaram antes, logo situacaoAcesso = ACESSO_ATIVO (default acima).
UPDATE "Usuario" u
SET "login" = base.candidato
FROM (
  SELECT
    id,
    CASE
      WHEN COUNT(*) OVER (PARTITION BY lower(split_part(email, '@', 1))) > 1
        THEN split_part(email, '@', 1) || '-' || left(id::text, 8)
      ELSE split_part(email, '@', 1)
    END AS candidato
  FROM "Usuario"
) base
WHERE u.id = base.id AND u."login" IS NULL;

ALTER TABLE "Usuario" ALTER COLUMN "login" SET NOT NULL;
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");

-- Novos usuários (US-201) nascem aguardando convite; muda o default daqui pra frente.
ALTER TABLE "Usuario" ALTER COLUMN "situacaoAcesso" SET DEFAULT 'CONVITE_PENDENTE';

-- 4. Perfil: descrição + status ativo (RN0070). Backward-compatible (ativo default true).
ALTER TABLE "Perfil" ADD COLUMN "descricao" TEXT;
ALTER TABLE "Perfil" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

-- 5. Exceções de acesso por usuário (US-203) — aditiva por ausência.
CREATE TABLE "UsuarioPerfilExcecao" (
    "usuarioId" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "funcionalidadeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "UsuarioPerfilExcecao_pkey" PRIMARY KEY ("usuarioId", "perfilId", "funcionalidadeId")
);
CREATE INDEX "UsuarioPerfilExcecao_tenantId_idx" ON "UsuarioPerfilExcecao"("tenantId");
CREATE INDEX "UsuarioPerfilExcecao_usuarioId_idx" ON "UsuarioPerfilExcecao"("usuarioId");
ALTER TABLE "UsuarioPerfilExcecao" ADD CONSTRAINT "UsuarioPerfilExcecao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsuarioPerfilExcecao" ADD CONSTRAINT "UsuarioPerfilExcecao_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UsuarioPerfilExcecao" ADD CONSTRAINT "UsuarioPerfilExcecao_funcionalidadeId_fkey" FOREIGN KEY ("funcionalidadeId") REFERENCES "Funcionalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Rollback:
--   DROP TABLE "UsuarioPerfilExcecao";
--   ALTER TABLE "Perfil" DROP COLUMN "ativo", DROP COLUMN "descricao";
--   DROP INDEX "Usuario_login_key";
--   ALTER TABLE "Usuario" DROP COLUMN "situacaoAcesso", DROP COLUMN "login";
--   DROP TYPE "SituacaoAcessoUsuario";
--   -- valores adicionados a "TipoOperacao" não são removíveis sem recriar o enum.
