-- DropForeignKey
ALTER TABLE "PerfilFuncionalidade" DROP CONSTRAINT "PerfilFuncionalidade_funcionalidadeId_fkey";

-- DropForeignKey
ALTER TABLE "PerfilFuncionalidade" DROP CONSTRAINT "PerfilFuncionalidade_perfilId_fkey";

-- DropForeignKey
ALTER TABLE "UnidadeFuncional" DROP CONSTRAINT "UnidadeFuncional_idPai_fkey";

-- DropForeignKey
ALTER TABLE "UsuarioPerfil" DROP CONSTRAINT "UsuarioPerfil_perfilId_fkey";

-- DropForeignKey
ALTER TABLE "UsuarioPerfil" DROP CONSTRAINT "UsuarioPerfil_usuarioId_fkey";

-- CreateTable
CREATE TABLE "ItemPatrimonial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versaoId" TEXT NOT NULL,
    "metaId" TEXT,
    "contaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DECIMAL(15,2) NOT NULL,
    "valorTotal" DECIMAL(15,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemPatrimonial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemPatrimonial_tenantId_versaoId_idx" ON "ItemPatrimonial"("tenantId", "versaoId");

-- CreateIndex
CREATE INDEX "ItemPatrimonial_tenantId_metaId_idx" ON "ItemPatrimonial"("tenantId", "metaId");

-- CreateIndex
CREATE INDEX "ItemPatrimonial_tenantId_contaId_idx" ON "ItemPatrimonial"("tenantId", "contaId");

-- AddForeignKey
ALTER TABLE "PerfilFuncionalidade" ADD CONSTRAINT "PerfilFuncionalidade_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilFuncionalidade" ADD CONSTRAINT "PerfilFuncionalidade_funcionalidadeId_fkey" FOREIGN KEY ("funcionalidadeId") REFERENCES "Funcionalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPatrimonial" ADD CONSTRAINT "ItemPatrimonial_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoProposta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPatrimonial" ADD CONSTRAINT "ItemPatrimonial_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPatrimonial" ADD CONSTRAINT "ItemPatrimonial_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeFuncional" ADD CONSTRAINT "UnidadeFuncional_idPai_fkey" FOREIGN KEY ("idPai") REFERENCES "UnidadeFuncional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "EmpregadoBeneficioElegibilidade_tenantId_empregadoId_tipoB_key" RENAME TO "EmpregadoBeneficioElegibilidade_tenantId_empregadoId_tipoBe_key";

-- RenameIndex
ALTER INDEX "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_c_key" RENAME TO "RateioImpostoGrade_tenantId_versaoId_aliquotaParametroId_co_key";
