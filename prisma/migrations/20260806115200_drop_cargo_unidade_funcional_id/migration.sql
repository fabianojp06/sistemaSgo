-- ADR-026, passo 2/2 — remove o vínculo 1:1 antigo, já substituído por
-- CargoAlocacaoPercentual (migration anterior). Só aplicar depois de
-- confirmar manualmente que o backfill migrou 100% das linhas de "Cargo"
-- (SELECT COUNT(*) FROM "Cargo" deve bater com
-- SELECT COUNT(DISTINCT "cargoId") FROM "CargoAlocacaoPercentual").

-- DropForeignKey
ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_unidadeFuncionalId_fkey";

-- DropIndex
DROP INDEX "Cargo_tenantId_unidadeFuncionalId_idx";

-- AlterTable
ALTER TABLE "Cargo" DROP COLUMN "unidadeFuncionalId";
