/*
  Warnings:

  - Added the required column `contaId` to the `Cargo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contaId` to the `EmpregadoHeadcount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contaId` to the `RateioImpostoGrade` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "contaId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "EmpregadoHeadcount" ADD COLUMN     "contaId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RateioImpostoGrade" ADD COLUMN     "contaId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "RateioImpostoGrade" ADD CONSTRAINT "RateioImpostoGrade_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpregadoHeadcount" ADD CONSTRAINT "EmpregadoHeadcount_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "ContaContabil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
