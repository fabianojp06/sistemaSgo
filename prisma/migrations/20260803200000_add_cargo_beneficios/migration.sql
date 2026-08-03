-- ADR-019 — US-107a: Encargos Sociais e Benefícios do Cargo (Tabela Mestre),
-- direto em Cargo (não tabela 1:1 separada). custoTotalCargo = salarioTotal +
-- Encargos Sociais + soma dos Benefícios ativos, sempre calculado no backend.

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'CARGO_BENEFICIOS_CONFIGURADOS';
ALTER TYPE "TipoOperacao" ADD VALUE 'CARGO_BENEFICIOS_EDITADOS';

-- CreateEnum
CREATE TYPE "FaixaPlanoSaude" AS ENUM ('BASICO', 'INTERMEDIARIO', 'EXECUTIVO');

-- AlterTable
ALTER TABLE "ParametroSistema" ADD COLUMN "diasUteisPadrao" INTEGER NOT NULL DEFAULT 22;

-- AlterTable
ALTER TABLE "Cargo"
  ADD COLUMN "encargosSociaisPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vaAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vaValorUnitario" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vrAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vrValorUnitario" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "planoSaudeAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "planoSaudeFaixa" "FaixaPlanoSaude",
  ADD COLUMN "planoSaudeValor" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "planoOdontoAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "planoOdontoValor" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "seguroVidaAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "seguroVidaValor" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "auxilioCrecheAtivo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "auxilioCrecheValor" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN "custoTotalCargo" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- Backfill: Cargos já existentes (US-107) ficam com custoTotalCargo = salarioTotal
-- (sem benefícios configurados ainda), em vez de 0 — evita um período em que o
-- custo do cargo aparente ser menor do que já é sabido (salarioTotal).
UPDATE "Cargo" SET "custoTotalCargo" = "salarioTotal";
