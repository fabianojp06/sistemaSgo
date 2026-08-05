-- CreateEnum
CREATE TYPE "StatusTermoAjuste" AS ENUM ('PENDENTE_APROVACAO_N1', 'PENDENTE_APROVACAO_GESTOR_MASTER', 'HOMOLOGADO', 'REJEITADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoOperacao" ADD VALUE 'TERMO_AJUSTE_SOLICITADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'TERMO_AJUSTE_APROVADO_N1';
ALTER TYPE "TipoOperacao" ADD VALUE 'TERMO_AJUSTE_HOMOLOGADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'TERMO_AJUSTE_REJEITADO';

-- CreateTable
CREATE TABLE "TermoAjuste" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "contaOrigemId" TEXT NOT NULL,
    "contaDestinoId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "status" "StatusTermoAjuste" NOT NULL DEFAULT 'PENDENTE_APROVACAO_N1',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermoAjuste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TermoAjuste_tenantId_versaoId_idx" ON "TermoAjuste"("tenantId", "versaoId");

-- CreateIndex
CREATE INDEX "TermoAjuste_tenantId_status_idx" ON "TermoAjuste"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "TermoAjuste" ADD CONSTRAINT "TermoAjuste_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoProposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoAjuste" ADD CONSTRAINT "TermoAjuste_contaOrigemId_fkey" FOREIGN KEY ("contaOrigemId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermoAjuste" ADD CONSTRAINT "TermoAjuste_contaDestinoId_fkey" FOREIGN KEY ("contaDestinoId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
