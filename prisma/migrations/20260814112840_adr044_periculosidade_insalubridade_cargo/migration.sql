-- CreateEnum
CREATE TYPE "TipoValorAdicional" AS ENUM ('PERCENTUAL', 'VALOR_FIXO');

-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "contaInsalubridadeId" TEXT,
ADD COLUMN     "contaPericulosidadeId" TEXT,
ADD COLUMN     "insalubridadeAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insalubridadeTipo" "TipoValorAdicional",
ADD COLUMN     "insalubridadeValor" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "periculosidadeAtivo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "periculosidadeTipo" "TipoValorAdicional",
ADD COLUMN     "periculosidadeValor" DECIMAL(15,2) NOT NULL DEFAULT 0;
