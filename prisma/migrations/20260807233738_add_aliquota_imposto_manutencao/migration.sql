-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoOperacao" ADD VALUE 'ALIQUOTA_IMPOSTO_CRIADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'ALIQUOTA_IMPOSTO_EDITADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'ALIQUOTA_IMPOSTO_INATIVADA';

-- AlterTable
ALTER TABLE "AliquotaImpostoParametro" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contaSinteticaId" TEXT,
ADD COLUMN     "dataFimVigencia" TIMESTAMP(3),
ADD COLUMN     "limiteMaximoPct" DECIMAL(5,2),
ADD COLUMN     "limiteMinimoPct" DECIMAL(5,2),
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "AliquotaImpostoParametro_tenantId_ativo_idx" ON "AliquotaImpostoParametro"("tenantId", "ativo");

-- AddForeignKey
ALTER TABLE "AliquotaImpostoParametro" ADD CONSTRAINT "AliquotaImpostoParametro_contaSinteticaId_fkey" FOREIGN KEY ("contaSinteticaId") REFERENCES "ContaContabil"("id") ON DELETE SET NULL ON UPDATE CASCADE;
