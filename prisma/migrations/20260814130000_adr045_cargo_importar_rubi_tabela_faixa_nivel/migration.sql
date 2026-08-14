-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'CARGO_IMPORTADO_RUBI';

-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "faixaCodigo" TEXT,
ADD COLUMN     "faixaDescricao" TEXT,
ADD COLUMN     "nivelCodigo" TEXT,
ADD COLUMN     "nivelDescricao" TEXT,
ADD COLUMN     "tabSalCodigo" TEXT,
ADD COLUMN     "tabSalDescricao" TEXT;
