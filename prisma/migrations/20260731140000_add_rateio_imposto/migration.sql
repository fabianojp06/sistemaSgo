-- ADR-014 — US-101: AliquotaImpostoParametro (parâmetro fiscal global por tenant)
-- e RateioImpostoGrade (grade de lançamentos por versão × tributo × competência).

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'RATEIO_IMPOSTO_CONFIGURADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'RATEIO_IMPOSTO_DESATIVADO';

-- CreateEnum
CREATE TYPE "TipoIncidenciaImposto" AS ENUM ('CONTRATO', 'TERMO_DE_PARCERIA', 'AMBOS');

-- CreateTable
CREATE TABLE "AliquotaImpostoParametro" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeNormalizado" TEXT NOT NULL,
    "aliquotaPct" DECIMAL(5,2) NOT NULL,
    "dataInicioVigencia" TIMESTAMP(3) NOT NULL,
    "tipoIncidencia" "TipoIncidenciaImposto" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AliquotaImpostoParametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateioImpostoGrade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "aliquotaParametroId" TEXT NOT NULL,
    "competencia" TIMESTAMP(3) NOT NULL,
    "valorDeclarado" DECIMAL(15,2) NOT NULL,
    "aliquotaAplicadaSnapshot" DECIMAL(5,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateioImpostoGrade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AliquotaImpostoParametro_tenantId_nomeNormalizado_key" ON "AliquotaImpostoParametro"("tenantId", "nomeNormalizado");

-- CreateIndex
CREATE INDEX "AliquotaImpostoParametro_tenantId_tipoIncidencia_idx" ON "AliquotaImpostoParametro"("tenantId", "tipoIncidencia");

-- CreateIndex
CREATE UNIQUE INDEX "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_c_key" ON "RateioImpostoGrade"("tenantId", "versaoId", "aliquotaParametroId", "competencia");

-- CreateIndex
CREATE INDEX "RateioImpostoGrade_tenantId_versaoId_idx" ON "RateioImpostoGrade"("tenantId", "versaoId");

-- AddForeignKey
ALTER TABLE "RateioImpostoGrade" ADD CONSTRAINT "RateioImpostoGrade_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoProposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateioImpostoGrade" ADD CONSTRAINT "RateioImpostoGrade_aliquotaParametroId_fkey" FOREIGN KEY ("aliquotaParametroId") REFERENCES "AliquotaImpostoParametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
