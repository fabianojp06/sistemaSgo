-- Pendência 2026-08-15: campo dedicado para o nome do cargo vindo do Rubi/CTCEA,
-- separado de "nomeCargoMercado" (que é sempre digitado/decidido pelo usuário).
ALTER TABLE "Cargo" ADD COLUMN "nomeCargoCtcea" TEXT;

-- Backfill: Cargos já importados do Rubi (tabSalCodigo preenchido) têm o nome do
-- Rubi hoje só em nomeCargoMercado (comportamento antigo, corrigido por esta feature).
-- Copia para o novo campo para não deixar "Nome Cargo CTCEA" vazio no painel;
-- nomeCargoMercado não é tocado (deixa de ser sobrescrito daqui em diante).
UPDATE "Cargo"
SET "nomeCargoCtcea" = "nomeCargoMercado"
WHERE "tabSalCodigo" IS NOT NULL;
