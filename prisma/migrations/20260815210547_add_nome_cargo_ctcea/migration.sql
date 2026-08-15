-- Pendência 2026-08-15: campo dedicado para o nome do cargo vindo do Rubi/CTCEA,
-- separado de "nomeCargoMercado" (que é sempre digitado/decidido pelo usuário).
ALTER TABLE "Cargo" ADD COLUMN "nomeCargoCtcea" TEXT;
