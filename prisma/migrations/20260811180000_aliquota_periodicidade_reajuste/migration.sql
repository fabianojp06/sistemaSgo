-- CreateEnum
CREATE TYPE "PeriodicidadeReajuste" AS ENUM ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- AlterTable
ALTER TABLE "AliquotaImpostoParametro" ADD COLUMN "periodicidadeReajuste" "PeriodicidadeReajuste" NOT NULL DEFAULT 'MENSAL';
