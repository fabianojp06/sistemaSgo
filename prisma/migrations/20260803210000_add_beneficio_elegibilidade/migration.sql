-- ADR-020 — US-108a: Elegibilidade Individual de Benefícios do Empregado
-- (UC03.28) + retrabalho em Cargo (ADR-019) adicionando Vale Transporte,
-- lacuna documental da Minuta corrigida agora. numeroDependentes de
-- EmpregadoHeadcount fica deprecated (mantido, sem uso funcional novo).

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'BENEFICIO_ELEGIBILIDADE_CONFIGURADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'BENEFICIO_ELEGIBILIDADE_EDITADA';

-- CreateEnum
CREATE TYPE "TipoBeneficioElegibilidade" AS ENUM ('VA', 'VR', 'PLANO_SAUDE', 'PLANO_ODONTO', 'SEGURO_VIDA', 'AUXILIO_CRECHE', 'VALE_TRANSPORTE');

-- AlterTable
ALTER TABLE "Cargo"
  ADD COLUMN "transporteAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "transporteValorUnitario" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EmpregadoBeneficioElegibilidade" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empregadoId" TEXT NOT NULL,
    "tipoBeneficio" "TipoBeneficioElegibilidade" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "periodoInicio" TIMESTAMP(3),
    "periodoFim" TIMESTAMP(3),
    "numeroDependentes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpregadoBeneficioElegibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpregadoBeneficioElegibilidade_tenantId_empregadoId_tipoB_key" ON "EmpregadoBeneficioElegibilidade"("tenantId", "empregadoId", "tipoBeneficio");

-- CreateIndex
CREATE INDEX "EmpregadoBeneficioElegibilidade_tenantId_empregadoId_idx" ON "EmpregadoBeneficioElegibilidade"("tenantId", "empregadoId");

-- AddForeignKey
ALTER TABLE "EmpregadoBeneficioElegibilidade" ADD CONSTRAINT "EmpregadoBeneficioElegibilidade_empregadoId_fkey" FOREIGN KEY ("empregadoId") REFERENCES "EmpregadoHeadcount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
