-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'SYNC_CARGO_MERCADO_CATALOGO';

-- CreateTable
CREATE TABLE "CargoMercadoCatalogo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigoOrigem" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoMercadoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SincronismoCargoMercadoCatalogoLock" (
    "tenantId" TEXT NOT NULL,
    "emAndamento" BOOLEAN NOT NULL DEFAULT false,
    "iniciadoEm" TIMESTAMP(3),
    "iniciadoPor" TEXT,

    CONSTRAINT "SincronismoCargoMercadoCatalogoLock_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "CargoMercadoCatalogo_tenantId_idx" ON "CargoMercadoCatalogo"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoMercadoCatalogo_tenantId_codigoOrigem_key" ON "CargoMercadoCatalogo"("tenantId", "codigoOrigem");
