-- Migration: add_municipio_ibge_viagem  (US-141 / ADR-048)
--
-- Risco: BAIXO — apenas adiciona colunas nullable a uma tabela existente e um índice.
--   Não altera nenhum dado, não altera coluna existente. ADD COLUMN sem DEFAULT volátil
--   é metadata-only no PostgreSQL >= 11 (não reescreve a tabela).
--
-- Aplicar via SQL Editor do Supabase (ambiente de dev sem .env). Depois registrar no
-- histórico do Prisma com `prisma migrate resolve --applied 20260902120000_add_municipio_ibge_viagem`
-- usando o Session Pooler (pooler.supabase.com:5432, usuário postgres.<project_ref>).
--
-- Rollback:
--   DROP INDEX IF EXISTS "Viagem_tenantId_municipioIbge_idx";
--   ALTER TABLE "Viagem" DROP COLUMN IF EXISTS "longitude";
--   ALTER TABLE "Viagem" DROP COLUMN IF EXISTS "latitude";
--   ALTER TABLE "Viagem" DROP COLUMN IF EXISTS "uf";
--   ALTER TABLE "Viagem" DROP COLUMN IF EXISTS "municipioNome";
--   ALTER TABLE "Viagem" DROP COLUMN IF EXISTS "municipioIbge";

-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN "municipioIbge" TEXT;
ALTER TABLE "Viagem" ADD COLUMN "municipioNome" TEXT;
ALTER TABLE "Viagem" ADD COLUMN "uf" TEXT;
ALTER TABLE "Viagem" ADD COLUMN "latitude" DECIMAL(9,6);
ALTER TABLE "Viagem" ADD COLUMN "longitude" DECIMAL(9,6);

-- CreateIndex
CREATE INDEX "Viagem_tenantId_municipioIbge_idx" ON "Viagem"("tenantId", "municipioIbge");
