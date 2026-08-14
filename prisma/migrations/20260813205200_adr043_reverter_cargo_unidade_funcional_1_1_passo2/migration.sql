-- ADR-043, passo 2/2 — remove CargoAlocacaoPercentual, já substituída pelo vínculo
-- direto Cargo.unidadeFuncionalId (migration anterior). Só aplicar depois de
-- confirmar manualmente (RAISE NOTICE do passo 1) que o backfill cobriu 100% dos
-- Cargos que tinham alocação:
--   SELECT COUNT(DISTINCT "cargoId") FROM "CargoAlocacaoPercentual"
--   deve bater com
--   SELECT COUNT(*) FROM "Cargo" WHERE "unidadeFuncionalId" IS NOT NULL.
--
-- unidadeFuncionalId permanece nullable (não vira NOT NULL) — mesmo padrão de
-- contaId (ADR-042): existe hoje 1 Cargo RASCUNHO sem vínculo funcional ainda.

-- DropForeignKey
ALTER TABLE "CargoAlocacaoPercentual" DROP CONSTRAINT "CargoAlocacaoPercentual_cargoId_fkey";
ALTER TABLE "CargoAlocacaoPercentual" DROP CONSTRAINT "CargoAlocacaoPercentual_unidadeFuncionalId_fkey";

-- DropTable
DROP TABLE "CargoAlocacaoPercentual";
