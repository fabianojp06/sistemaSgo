-- ADR-026, passo 1/2 — cria a tabela de rateio percentual e migra o vínculo
-- 1:1 existente (Cargo.unidadeFuncionalId) como uma alocação de 100%. A
-- coluna antiga só é removida na migration seguinte (passo 2/2), depois de
-- confirmar manualmente que o backfill abaixo migrou todas as linhas.

-- CreateTable
CREATE TABLE "CargoAlocacaoPercentual" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "unidadeFuncionalId" TEXT NOT NULL,
    "percentual" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CargoAlocacaoPercentual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CargoAlocacaoPercentual_tenantId_cargoId_idx" ON "CargoAlocacaoPercentual"("tenantId", "cargoId");

-- CreateIndex
CREATE INDEX "CargoAlocacaoPercentual_tenantId_unidadeFuncionalId_idx" ON "CargoAlocacaoPercentual"("tenantId", "unidadeFuncionalId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoAlocacaoPercentual_tenantId_cargoId_unidadeFuncionalId_key" ON "CargoAlocacaoPercentual"("tenantId", "cargoId", "unidadeFuncionalId");

-- AddForeignKey
ALTER TABLE "CargoAlocacaoPercentual" ADD CONSTRAINT "CargoAlocacaoPercentual_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CargoAlocacaoPercentual" ADD CONSTRAINT "CargoAlocacaoPercentual_unidadeFuncionalId_fkey" FOREIGN KEY ("unidadeFuncionalId") REFERENCES "UnidadeFuncional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: cada Cargo existente vira uma alocação de 100% na sua unidade atual.
INSERT INTO "CargoAlocacaoPercentual" ("id", "tenantId", "cargoId", "unidadeFuncionalId", "percentual", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "tenantId", "id", "unidadeFuncionalId", 100.00, now(), now()
FROM "Cargo";
