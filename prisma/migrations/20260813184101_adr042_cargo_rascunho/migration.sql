-- CreateEnum
CREATE TYPE "StatusCargo" AS ENUM ('RASCUNHO', 'COMPLETO');

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'CARGO_RASCUNHO_CRIADO';

-- DropForeignKey
ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_contaId_fkey";

-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "status" "StatusCargo" NOT NULL DEFAULT 'COMPLETO',
ALTER COLUMN "periodoInicio" DROP NOT NULL,
ALTER COLUMN "salarioMercadoMinimo" DROP NOT NULL,
ALTER COLUMN "salarioMercadoMaximo" DROP NOT NULL,
ALTER COLUMN "fonteAtiva" DROP NOT NULL,
ALTER COLUMN "contaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE SET NULL ON UPDATE CASCADE;
