-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoOperacao" ADD VALUE 'SENIORIDADE_CRIADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'SENIORIDADE_EXCLUIDA';
ALTER TYPE "TipoOperacao" ADD VALUE 'TABELA_SALARIAL_CADASTRADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'TABELA_SALARIAL_EDITADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'TABELA_SALARIAL_EXCLUIDA';

-- CreateTable
CREATE TABLE "Senioridade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "isPadrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Senioridade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TabelaSalarial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "senioridadeId" TEXT NOT NULL,
    "salarioMinimo" DECIMAL(15,2) NOT NULL,
    "salarioMaximo" DECIMAL(15,2) NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TabelaSalarial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Senioridade_tenantId_idx" ON "Senioridade"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Senioridade_tenantId_descricao_key" ON "Senioridade"("tenantId", "descricao");

-- CreateIndex
CREATE INDEX "TabelaSalarial_tenantId_cargoId_idx" ON "TabelaSalarial"("tenantId", "cargoId");

-- CreateIndex
CREATE INDEX "TabelaSalarial_tenantId_senioridadeId_idx" ON "TabelaSalarial"("tenantId", "senioridadeId");

-- AddForeignKey
ALTER TABLE "TabelaSalarial" ADD CONSTRAINT "TabelaSalarial_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TabelaSalarial" ADD CONSTRAINT "TabelaSalarial_senioridadeId_fkey" FOREIGN KEY ("senioridadeId") REFERENCES "Senioridade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
