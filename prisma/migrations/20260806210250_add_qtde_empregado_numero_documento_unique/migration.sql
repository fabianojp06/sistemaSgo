-- AlterTable: numeroDocumento passa a ser único por Proposta (formato "C-XXX" gerado automaticamente, US-113)
ALTER TABLE "QtdeEmpregado" ADD CONSTRAINT "QtdeEmpregado_tenantId_propostaId_numeroDocumento_key" UNIQUE ("tenantId", "propostaId", "numeroDocumento");
