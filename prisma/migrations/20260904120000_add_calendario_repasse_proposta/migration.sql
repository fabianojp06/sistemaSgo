-- US-142 / ADR-049 — Calendário de repasse na Proposta (Cronograma de Desembolso por parcelas, layout ANEXO 9).
-- Dois campos opcionais que andam juntos: ambos preenchidos ou ambos nulos.

ALTER TABLE "Proposta" ADD COLUMN "parcelasPorAno" INTEGER;
ALTER TABLE "Proposta" ADD COLUMN "mesInicialRepasse" INTEGER;

ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_parcelasPorAno_check"
  CHECK ("parcelasPorAno" IS NULL OR "parcelasPorAno" IN (1, 2, 3, 4, 6, 12));

ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_mesInicialRepasse_check"
  CHECK ("mesInicialRepasse" IS NULL OR ("mesInicialRepasse" BETWEEN 1 AND 12));

ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_calendario_repasse_par_check"
  CHECK (("parcelasPorAno" IS NULL) = ("mesInicialRepasse" IS NULL));

-- Rollback:
-- ALTER TABLE "Proposta" DROP CONSTRAINT "Proposta_calendario_repasse_par_check";
-- ALTER TABLE "Proposta" DROP CONSTRAINT "Proposta_mesInicialRepasse_check";
-- ALTER TABLE "Proposta" DROP CONSTRAINT "Proposta_parcelasPorAno_check";
-- ALTER TABLE "Proposta" DROP COLUMN "mesInicialRepasse";
-- ALTER TABLE "Proposta" DROP COLUMN "parcelasPorAno";
