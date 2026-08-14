-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'SYNC_GRADE_SALARIAL_CTCEA';

-- CreateTable
CREATE TABLE "GradeSalarialCtcea" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "faixa" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "salario" DECIMAL(15,2) NOT NULL,
    "cargoMercado" TEXT,
    "cargoCtcea" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeSalarialCtcea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SincronismoGradeSalarialCtceaLock" (
    "tenantId" TEXT NOT NULL,
    "emAndamento" BOOLEAN NOT NULL DEFAULT false,
    "iniciadoEm" TIMESTAMP(3),
    "iniciadoPor" TEXT,

    CONSTRAINT "SincronismoGradeSalarialCtceaLock_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "GradeSalarialCtcea_tenantId_idx" ON "GradeSalarialCtcea"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeSalarialCtcea_tenantId_faixa_nivel_key" ON "GradeSalarialCtcea"("tenantId", "faixa", "nivel");
