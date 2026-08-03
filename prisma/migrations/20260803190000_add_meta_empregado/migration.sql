-- ADR-017 — US-112: Meta (1:1 opcional por VersaoProposta, valorGlobal sempre
-- espelhado do total orçado). ADR-018 — US-108: EmpregadoHeadcount (headcount
-- escopado por Proposta CONSOLIDADA, com snapshot herdado do Cargo).

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'META_CRIADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'META_EDITADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'META_EXCLUIDA';
ALTER TYPE "TipoOperacao" ADD VALUE 'EMPREGADO_CRIADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'EMPREGADO_EDITADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'EMPREGADO_EXCLUIDO';

-- CreateEnum
CREATE TYPE "StatusMeta" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "CategoriaEmpregado" AS ENUM ('EMPREGADO', 'ESTAGIARIO', 'JOVEM_APRENDIZ');

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valorGlobal" DECIMAL(15,2) NOT NULL,
    "status" "StatusMeta" NOT NULL DEFAULT 'ATIVO',
    "observacao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meta_versaoId_key" ON "Meta"("versaoId");

-- CreateIndex
CREATE INDEX "Meta_tenantId_versaoId_idx" ON "Meta"("tenantId", "versaoId");

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoProposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EmpregadoHeadcount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaEmpregado" NOT NULL,
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "periodoFim" TIMESTAMP(3),
    "numeroDependentes" INTEGER NOT NULL DEFAULT 0,
    "vinculoFuncionalHerdado" TEXT NOT NULL,
    "custoTotalMensal" DECIMAL(15,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpregadoHeadcount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmpregadoHeadcount_tenantId_propostaId_idx" ON "EmpregadoHeadcount"("tenantId", "propostaId");

-- CreateIndex
CREATE INDEX "EmpregadoHeadcount_tenantId_cargoId_idx" ON "EmpregadoHeadcount"("tenantId", "cargoId");

-- AddForeignKey
ALTER TABLE "EmpregadoHeadcount" ADD CONSTRAINT "EmpregadoHeadcount_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpregadoHeadcount" ADD CONSTRAINT "EmpregadoHeadcount_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
