-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoOperacao" ADD VALUE 'QTDE_EMPREGADO_CADASTRADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'QTDE_EMPREGADO_EDITADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'QTDE_EMPREGADO_EXCLUIDA';

-- AlterTable
ALTER TABLE "EmpregadoHeadcount" ADD COLUMN     "metaId" TEXT;

-- CreateTable
CREATE TABLE "QtdeEmpregado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "metaId" TEXT,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3) NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "quantidadeEmpregados" INTEGER NOT NULL,
    "quantidadeEstagiarios" INTEGER NOT NULL,
    "quantidadeJovemAprendiz" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QtdeEmpregado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QtdeEmpregado_tenantId_propostaId_idx" ON "QtdeEmpregado"("tenantId", "propostaId");

-- CreateIndex
CREATE INDEX "QtdeEmpregado_tenantId_metaId_idx" ON "QtdeEmpregado"("tenantId", "metaId");

-- CreateIndex
CREATE INDEX "EmpregadoHeadcount_tenantId_metaId_idx" ON "EmpregadoHeadcount"("tenantId", "metaId");

-- AddForeignKey
ALTER TABLE "EmpregadoHeadcount" ADD CONSTRAINT "EmpregadoHeadcount_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QtdeEmpregado" ADD CONSTRAINT "QtdeEmpregado_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QtdeEmpregado" ADD CONSTRAINT "QtdeEmpregado_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
