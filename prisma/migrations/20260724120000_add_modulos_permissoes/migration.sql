-- CreateTable
CREATE TABLE "Modulo" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionalidade" (
    "id" TEXT NOT NULL,
    "moduloId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Funcionalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilFuncionalidade" (
    "perfilId" TEXT NOT NULL,
    "funcionalidadeId" TEXT NOT NULL,

    CONSTRAINT "PerfilFuncionalidade_pkey" PRIMARY KEY ("perfilId","funcionalidadeId")
);

-- CreateTable
CREATE TABLE "UsuarioPerfil" (
    "usuarioId" TEXT NOT NULL,
    "perfilId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "UsuarioPerfil_pkey" PRIMARY KEY ("usuarioId","perfilId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Modulo_chave_key" ON "Modulo"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionalidade_moduloId_chave_key" ON "Funcionalidade"("moduloId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_tenantId_nome_key" ON "Perfil"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "Perfil_tenantId_idx" ON "Perfil"("tenantId");

-- CreateIndex
CREATE INDEX "UsuarioPerfil_tenantId_idx" ON "UsuarioPerfil"("tenantId");

-- AddForeignKey
ALTER TABLE "Funcionalidade" ADD CONSTRAINT "Funcionalidade_moduloId_fkey" FOREIGN KEY ("moduloId") REFERENCES "Modulo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilFuncionalidade" ADD CONSTRAINT "PerfilFuncionalidade_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilFuncionalidade" ADD CONSTRAINT "PerfilFuncionalidade_funcionalidadeId_fkey" FOREIGN KEY ("funcionalidadeId") REFERENCES "Funcionalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_perfilId_fkey" FOREIGN KEY ("perfilId") REFERENCES "Perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
