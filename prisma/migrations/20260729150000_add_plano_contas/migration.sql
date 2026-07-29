-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'SYNC_PLANO_CONTAS';
ALTER TYPE "TipoOperacao" ADD VALUE 'AGRUPADOR_CRIADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'AGRUPADOR_EDITADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'AGRUPADOR_EXCLUIDO';

-- CreateEnum
CREATE TYPE "StatusSincronismo" AS ENUM ('SINCRONIZADO', 'PENDENTE', 'ERRO');

-- CreateEnum
CREATE TYPE "NaturezaConta" AS ENUM ('OPEX', 'CAPEX');

-- CreateTable
CREATE TABLE "ContaContabil" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigoErp" TEXT NOT NULL,
    "nomeConta" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "idPai" TEXT,
    "isAnalitica" BOOLEAN NOT NULL,
    "natureza" "NaturezaConta",
    "statusSync" "StatusSincronismo" NOT NULL DEFAULT 'PENDENTE',
    "syncedAt" TIMESTAMP(3),
    "erpUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaContabil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaAgrupadora" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaAgrupadora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContaAgrupadoraItem" (
    "agrupadoraId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,

    CONSTRAINT "ContaAgrupadoraItem_pkey" PRIMARY KEY ("agrupadoraId","contaId")
);

-- CreateTable
CREATE TABLE "SincronismoPlanoContasLock" (
    "tenantId" TEXT NOT NULL,
    "emAndamento" BOOLEAN NOT NULL DEFAULT false,
    "iniciadoEm" TIMESTAMP(3),
    "iniciadoPor" TEXT,

    CONSTRAINT "SincronismoPlanoContasLock_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContaContabil_tenantId_codigoErp_key" ON "ContaContabil"("tenantId", "codigoErp");

-- CreateIndex
CREATE INDEX "ContaContabil_tenantId_nivel_idx" ON "ContaContabil"("tenantId", "nivel");

-- CreateIndex
CREATE INDEX "ContaContabil_tenantId_isAnalitica_idx" ON "ContaContabil"("tenantId", "isAnalitica");

-- CreateIndex
CREATE UNIQUE INDEX "ContaAgrupadora_tenantId_nome_key" ON "ContaAgrupadora"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "ContaAgrupadora_tenantId_idx" ON "ContaAgrupadora"("tenantId");

-- CreateIndex
CREATE INDEX "ContaAgrupadoraItem_contaId_idx" ON "ContaAgrupadoraItem"("contaId");

-- AddForeignKey
ALTER TABLE "ContaContabil" ADD CONSTRAINT "ContaContabil_idPai_fkey" FOREIGN KEY ("idPai") REFERENCES "ContaContabil"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaAgrupadoraItem" ADD CONSTRAINT "ContaAgrupadoraItem_agrupadoraId_fkey" FOREIGN KEY ("agrupadoraId") REFERENCES "ContaAgrupadora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaAgrupadoraItem" ADD CONSTRAINT "ContaAgrupadoraItem_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
