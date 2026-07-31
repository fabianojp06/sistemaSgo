-- ADR-013 — Semáforo Orçamentário (US-008): limiares opcionais por conta analítica.

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'SEMAFORO_CONFIGURADO';

-- AlterTable
ALTER TABLE "ContaContabil" ADD COLUMN "semaforoVerdePct" INTEGER;
ALTER TABLE "ContaContabil" ADD COLUMN "semaforoAmareloPct" INTEGER;
ALTER TABLE "ContaContabil" ADD COLUMN "semaforoLaranjaPct" INTEGER;

-- CHECK constraint — "todos ou nenhum" + coerência 0<verde<amarelo<laranja<=100 [ADR-013].
ALTER TABLE "ContaContabil" ADD CONSTRAINT "ContaContabil_semaforo_coerente_check"
    CHECK (
        ("semaforoVerdePct" IS NULL AND "semaforoAmareloPct" IS NULL AND "semaforoLaranjaPct" IS NULL)
        OR (
            "semaforoVerdePct" > 0 AND "semaforoVerdePct" <= 100
            AND "semaforoAmareloPct" > "semaforoVerdePct" AND "semaforoAmareloPct" <= 100
            AND "semaforoLaranjaPct" > "semaforoAmareloPct" AND "semaforoLaranjaPct" <= 100
        )
    );
