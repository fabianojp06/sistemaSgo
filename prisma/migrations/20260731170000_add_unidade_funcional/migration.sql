-- ADR-015 — US-106: UnidadeFuncional (organograma), escopada por Proposta.

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'UNIDADE_FUNCIONAL_CRIADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'UNIDADE_FUNCIONAL_INATIVADA';

-- CreateEnum
CREATE TYPE "TipoNivelUnidadeFuncional" AS ENUM ('SINTETICO_DIRETORIA', 'SINTETICO_GERENCIA', 'ANALITICO_ASSESSOR', 'ANALITICO_COORDENADORIA', 'ANALITICO_SETOR');

-- CreateTable
CREATE TABLE "UnidadeFuncional" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoNivel" "TipoNivelUnidadeFuncional" NOT NULL,
    "idPai" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadeFuncional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnidadeFuncional_tenantId_propostaId_idx" ON "UnidadeFuncional"("tenantId", "propostaId");

-- CreateIndex
CREATE INDEX "UnidadeFuncional_tenantId_propostaId_idPai_idx" ON "UnidadeFuncional"("tenantId", "propostaId", "idPai");

-- AddForeignKey
ALTER TABLE "UnidadeFuncional" ADD CONSTRAINT "UnidadeFuncional_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeFuncional" ADD CONSTRAINT "UnidadeFuncional_idPai_fkey" FOREIGN KEY ("idPai") REFERENCES "UnidadeFuncional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
