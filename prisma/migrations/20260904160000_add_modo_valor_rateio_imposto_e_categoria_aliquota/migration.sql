-- EPICO Impostos / ADR-050 / US-144 — motor de cálculo automático de imposto (conta analítica).
-- Risco: BAIXO — enums + colunas nullable/com default. Nenhum recálculo, nenhum dado alterado.
-- Linhas atuais de RateioImpostoGrade viram modoValor = DECLARADO (grandfather total).

ALTER TYPE "TipoOperacao" ADD VALUE IF NOT EXISTS 'IMPOSTOS_GERADOS';

CREATE TYPE "ModoValorRateioImposto" AS ENUM ('DECLARADO', 'CALCULADO');
ALTER TABLE "RateioImpostoGrade"
  ADD COLUMN "modoValor" "ModoValorRateioImposto" NOT NULL DEFAULT 'DECLARADO',
  ADD COLUMN "valorBaseSnapshot" DECIMAL(15,2);

CREATE TYPE "CategoriaAliquotaImposto" AS ENUM ('TRIBUTO', 'INDICE_REAJUSTE');
ALTER TABLE "AliquotaImpostoParametro"
  ADD COLUMN "categoria" "CategoriaAliquotaImposto" NOT NULL DEFAULT 'TRIBUTO';

-- Backfill manual sugerido (o usuário revisa quais alíquotas são índice de reajuste):
--   UPDATE "AliquotaImpostoParametro" SET "categoria" = 'INDICE_REAJUSTE'
--   WHERE "nome" ILIKE ANY (ARRAY['%IPCA%','%INPC%','%IGP%','%dissídio%','%dissidio%','%reajuste%']);

-- Rollback:
--   ALTER TABLE "AliquotaImpostoParametro" DROP COLUMN "categoria";
--   ALTER TABLE "RateioImpostoGrade" DROP COLUMN "valorBaseSnapshot", DROP COLUMN "modoValor";
--   DROP TYPE "CategoriaAliquotaImposto";
--   DROP TYPE "ModoValorRateioImposto";
