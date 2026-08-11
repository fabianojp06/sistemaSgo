-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'REAJUSTE_LOTE_SIMULADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'REAJUSTE_LOTE_APLICADO';

-- AlterTable
ALTER TABLE "RateioImpostoGrade" ALTER COLUMN "aliquotaAplicadaSnapshot" SET DATA TYPE DECIMAL(9,4);

-- [US-129] contaId entra na chave única: antes só existia 1 linha por (parametro,
-- competencia) no tenant/versão inteiros, impedindo o efeito cascata (RN_PR_001)
-- de um mesmo AliquotaImpostoParametro sobre N contas filhas na mesma competência.
DROP INDEX "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_co_key";
CREATE UNIQUE INDEX "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_contaId_competencia_key" ON "RateioImpostoGrade"("tenantId", "versaoId", "aliquotaParametroId", "contaId", "competencia");
