-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'VIAGEM_CRIADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'VIAGEM_EDITADA';
ALTER TYPE "TipoOperacao" ADD VALUE 'VIAGEM_EXCLUIDA';

-- CreateTable
CREATE TABLE "Viagem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidadePessoas" INTEGER NOT NULL,
    "mediaDias" INTEGER NOT NULL,
    "custoUnitarioPassagem" DECIMAL(15,2) NOT NULL,
    "contaPassagemId" TEXT NOT NULL,
    "custoUnitarioDiaria" DECIMAL(15,2) NOT NULL,
    "contaDiariaId" TEXT NOT NULL,
    "custoUnitarioTransporte" DECIMAL(15,2) NOT NULL,
    "contaTransporteId" TEXT NOT NULL,
    "custoEstimado" DECIMAL(15,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Viagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Viagem_tenantId_versaoId_idx" ON "Viagem"("tenantId", "versaoId");

-- CreateIndex
CREATE INDEX "Viagem_tenantId_metaId_idx" ON "Viagem"("tenantId", "metaId");

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoProposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_contaPassagemId_fkey" FOREIGN KEY ("contaPassagemId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_contaDiariaId_fkey" FOREIGN KEY ("contaDiariaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_contaTransporteId_fkey" FOREIGN KEY ("contaTransporteId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
