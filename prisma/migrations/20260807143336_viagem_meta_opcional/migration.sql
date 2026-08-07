-- DropForeignKey
ALTER TABLE "Viagem" DROP CONSTRAINT "Viagem_metaId_fkey";

-- AlterTable
ALTER TABLE "Viagem" ALTER COLUMN "metaId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "Meta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
