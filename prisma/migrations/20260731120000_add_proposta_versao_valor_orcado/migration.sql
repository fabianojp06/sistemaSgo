-- ADR-012 — Proposta/VersaoProposta mínimas + ValorOrcadoConta (US-007)

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'VALOR_ORCADO_CONFIGURADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'VERSAO_PROPOSTA_CRIADA';

-- CreateEnum
CREATE TYPE "TipoProposta" AS ENUM ('CONTRATO', 'TERMO_DE_PARCERIA');

-- CreateEnum
CREATE TYPE "CategoriaProposta" AS ENUM ('CONSOLIDADA', 'POR_META');

-- CreateEnum
CREATE TYPE "StatusProposta" AS ENUM ('RASCUNHO', 'EM_ELABORACAO', 'OFICIALIZADO', 'ENCERRADO');

-- CreateTable
CREATE TABLE "Proposta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoProposta" NOT NULL,
    "categoria" "CategoriaProposta" NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "status" "StatusProposta" NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VersaoProposta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "numeroVersao" INTEGER NOT NULL,
    "descricao" TEXT,
    "status" "StatusProposta" NOT NULL DEFAULT 'RASCUNHO',
    "vigente" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "VersaoProposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValorOrcadoConta" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "exercicio" INTEGER NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValorOrcadoConta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposta_tenantId_codigo_key" ON "Proposta"("tenantId", "codigo");

-- CreateIndex
CREATE INDEX "Proposta_tenantId_status_idx" ON "Proposta"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VersaoProposta_tenantId_propostaId_numeroVersao_key" ON "VersaoProposta"("tenantId", "propostaId", "numeroVersao");

-- CreateIndex
CREATE INDEX "VersaoProposta_tenantId_propostaId_vigente_idx" ON "VersaoProposta"("tenantId", "propostaId", "vigente");

-- CreateIndex — ADR-012: garante um único vigente=true por proposta. Prisma não
-- suporta unique parcial nativamente, por isso este índice é escrito à mão.
CREATE UNIQUE INDEX "VersaoProposta_unica_vigente_por_proposta"
    ON "VersaoProposta"("tenantId", "propostaId")
    WHERE "vigente" = true;

-- CreateIndex
CREATE UNIQUE INDEX "ValorOrcadoConta_tenantId_versaoId_contaId_exercicio_key" ON "ValorOrcadoConta"("tenantId", "versaoId", "contaId", "exercicio");

-- CreateIndex
CREATE INDEX "ValorOrcadoConta_tenantId_versaoId_idx" ON "ValorOrcadoConta"("tenantId", "versaoId");

-- AddForeignKey
ALTER TABLE "VersaoProposta" ADD CONSTRAINT "VersaoProposta_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorOrcadoConta" ADD CONSTRAINT "ValorOrcadoConta_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoProposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValorOrcadoConta" ADD CONSTRAINT "ValorOrcadoConta_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
