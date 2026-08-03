-- CreateEnum
CREATE TYPE "TipoFuncionalidade" AS ENUM ('NAVEGAVEL', 'CONTEXTUAL');

-- AlterTable
ALTER TABLE "Funcionalidade" ADD COLUMN "tipo" "TipoFuncionalidade" NOT NULL DEFAULT 'NAVEGAVEL';

-- ADR-021: ações que vivem dentro de outra tela (não têm rota própria) deixam de
-- aparecer como link navegável no menu da Tela Principal.
UPDATE "Funcionalidade"
SET "tipo" = 'CONTEXTUAL'
WHERE "chave" IN (
    'plano-contas.classificar-natureza',
    'plano-contas.configurar-valor-orcado',
    'plano-contas.configurar-semaforo',
    'plano-contas.configurar-rateio-imposto'
);
