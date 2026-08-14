-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'SYNC_GRADE_SALARIAL_CTCEA';

-- DropForeignKey
ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_unidadeFuncionalId_fkey";

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

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_unidadeFuncionalId_fkey" FOREIGN KEY ("unidadeFuncionalId") REFERENCES "UnidadeFuncional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
