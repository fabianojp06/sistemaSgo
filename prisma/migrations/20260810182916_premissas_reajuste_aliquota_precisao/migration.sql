-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'PREMISSA_REAJUSTE_CONSULTADA';

-- AlterTable
ALTER TABLE "AliquotaImpostoParametro" ALTER COLUMN "aliquotaPct" SET DATA TYPE DECIMAL(9,4);
