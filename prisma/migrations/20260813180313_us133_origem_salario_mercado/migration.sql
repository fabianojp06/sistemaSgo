-- CreateEnum
CREATE TYPE "OrigemSalarioMercado" AS ENUM ('TABELA_SALARIAL', 'MANUAL');

-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "origemSalarioMaximo" "OrigemSalarioMercado" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "origemSalarioMinimo" "OrigemSalarioMercado" NOT NULL DEFAULT 'MANUAL';
