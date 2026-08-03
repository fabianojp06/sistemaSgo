-- ADR-016 — US-107: Cargo (Cargos e Salários), vinculado 1:1 a um nó Analítico
-- de UnidadeFuncional. Salário Real é preenchido por fixture (sem integração
-- real com Rubi ainda), mesmo padrão de ContaContabil/StatusSincronismo.

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'CARGO_CRIADO';
ALTER TYPE "TipoOperacao" ADD VALUE 'CARGO_EDITADO';

-- CreateEnum
CREATE TYPE "FonteAtivaSalario" AS ENUM ('MERCADO_MINIMO', 'MERCADO_MAXIMO', 'RUBI');

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propostaId" TEXT NOT NULL,
    "unidadeFuncionalId" TEXT NOT NULL,
    "nomeCargoMercado" TEXT NOT NULL,
    "codigoCargo" TEXT NOT NULL,
    "funcaoGratificada" DECIMAL(15,2),
    "periodoInicio" TIMESTAMP(3) NOT NULL,
    "salarioMercadoMinimo" DECIMAL(15,2) NOT NULL,
    "salarioMercadoMaximo" DECIMAL(15,2) NOT NULL,
    "fonteAtiva" "FonteAtivaSalario" NOT NULL,
    "salarioReal" DECIMAL(15,2),
    "statusSyncSalario" "StatusSincronismo" NOT NULL DEFAULT 'PENDENTE',
    "syncedAt" TIMESTAMP(3),
    "erpUpdatedAt" TIMESTAMP(3),
    "salarioTotal" DECIMAL(15,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_tenantId_codigoCargo_key" ON "Cargo"("tenantId", "codigoCargo");

-- CreateIndex
CREATE INDEX "Cargo_tenantId_propostaId_idx" ON "Cargo"("tenantId", "propostaId");

-- CreateIndex
CREATE INDEX "Cargo_tenantId_unidadeFuncionalId_idx" ON "Cargo"("tenantId", "unidadeFuncionalId");

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_propostaId_fkey" FOREIGN KEY ("propostaId") REFERENCES "Proposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_unidadeFuncionalId_fkey" FOREIGN KEY ("unidadeFuncionalId") REFERENCES "UnidadeFuncional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
