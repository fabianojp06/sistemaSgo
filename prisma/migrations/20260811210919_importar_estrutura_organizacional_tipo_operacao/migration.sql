-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'ESTRUTURA_ORGANIZACIONAL_IMPORTADA';

-- RenameIndex
ALTER INDEX "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_contaI" RENAME TO "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_co_key";
