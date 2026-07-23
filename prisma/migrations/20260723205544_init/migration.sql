-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "TipoOperacao" AS ENUM ('LOGIN_SUCESSO', 'LOGIN_FALHA', 'LOGOFF', 'BLOQUEIO_AUTOMATICO', 'ACESSO_SIMULTANEO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "contadorFalhas" INTEGER NOT NULL DEFAULT 0,
    "trocarSenhaObrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoOperacao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "clerkSessionId" TEXT,
    "tipoOperacao" "TipoOperacao" NOT NULL,
    "descricao" TEXT NOT NULL,
    "ipEstacao" TEXT,
    "quantidadeTentativas" INTEGER,
    "dadosSerializados" JSONB,
    "dataHoraEvento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametroSistema" (
    "tenantId" TEXT NOT NULL,
    "limiteTentativasLogin" INTEGER NOT NULL DEFAULT 5,
    "flagManutencao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ParametroSistema_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_clerkUserId_key" ON "Usuario"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_tenantId_idx" ON "Usuario"("tenantId");

-- CreateIndex
CREATE INDEX "HistoricoOperacao_tenantId_idx" ON "HistoricoOperacao"("tenantId");

-- CreateIndex
CREATE INDEX "HistoricoOperacao_usuarioId_idx" ON "HistoricoOperacao"("usuarioId");

-- AddForeignKey
ALTER TABLE "HistoricoOperacao" ADD CONSTRAINT "HistoricoOperacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

