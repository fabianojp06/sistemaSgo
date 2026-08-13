-- ADR-043, passo 1/2 — reverte ADR-026: RN_CAR_02 (rateio percentual N:M) foi revogada
-- pelo documento de negócio Rev. Jun/2026 em favor de RN_CAR_08 (vínculo 1:1, custo
-- integral ao setor). Recria Cargo.unidadeFuncionalId (nullable — mesmo motivo de
-- contaId no ADR-042: um Cargo RASCUNHO ainda não tem vínculo) e faz o backfill a
-- partir de CargoAlocacaoPercentual. CargoAlocacaoPercentual só é removida no passo
-- 2/2, depois de confirmar manualmente que o backfill abaixo cobriu 100% dos Cargos
-- COMPLETO que tinham alocação.
--
-- Critério de desempate (defensivo — checado em produção antes desta migration via
-- SELECT "cargoId", COUNT(*) FROM "CargoAlocacaoPercentual" GROUP BY "cargoId" HAVING
-- COUNT(*) > 1, que retornou vazio: os 8 registros existentes têm 1 Unidade Funcional
-- por Cargo, percentual=100): maior "percentual" vence; empate desempatado pela
-- alocação de "createdAt" mais antigo.

-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN "unidadeFuncionalId" TEXT;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_unidadeFuncionalId_fkey" FOREIGN KEY ("unidadeFuncionalId") REFERENCES "UnidadeFuncional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Cargo_tenantId_unidadeFuncionalId_idx" ON "Cargo"("tenantId", "unidadeFuncionalId");

-- Backfill + log de auditoria (RAISE NOTICE — mesmo padrão de conferência manual pós-migration
-- já usado nas migrations de dado deste projeto, ex: ADR-026/passo 2, sem escrever em
-- HistoricoOperacao porque esta é uma operação de sistema/migration, não uma ação de usuário
-- com tenantId/usuarioId de contexto).
DO $$
DECLARE
  vencedor RECORD;
  total_candidatos INT;
BEGIN
  FOR vencedor IN
    SELECT DISTINCT ON (cap."cargoId")
      cap."cargoId",
      cap."unidadeFuncionalId",
      cap.percentual,
      cap."createdAt"
    FROM "CargoAlocacaoPercentual" cap
    ORDER BY cap."cargoId", cap.percentual DESC, cap."createdAt" ASC
  LOOP
    SELECT COUNT(*) INTO total_candidatos
    FROM "CargoAlocacaoPercentual"
    WHERE "cargoId" = vencedor."cargoId";

    UPDATE "Cargo"
    SET "unidadeFuncionalId" = vencedor."unidadeFuncionalId"
    WHERE "id" = vencedor."cargoId";

    IF total_candidatos > 1 THEN
      RAISE NOTICE 'ADR-043 backfill: Cargo % migrado com % candidatos — vencedor % (percentual=%, criterio=maior percentual, desempate por createdAt mais antigo). Conferir manualmente.',
        vencedor."cargoId", total_candidatos, vencedor."unidadeFuncionalId", vencedor.percentual;
    ELSE
      RAISE NOTICE 'ADR-043 backfill: Cargo % migrado sem ambiguidade (1 alocacao) para unidade % (percentual=%).',
        vencedor."cargoId", vencedor."unidadeFuncionalId", vencedor.percentual;
    END IF;
  END LOOP;
END $$;
