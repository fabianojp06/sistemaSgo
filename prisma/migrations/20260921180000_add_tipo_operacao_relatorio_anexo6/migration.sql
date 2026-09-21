-- ANEXO 6 (Composição dos Custos de Remuneração e Benefícios) — trilha de
-- auditoria da exportação do relatório, mesmo padrão de
-- RELATORIO_CRONOGRAMA_DESEMBOLSO_EXPORTADO (US-138).
--
-- Migration puramente aditiva: acrescenta um valor ao enum TipoOperacao.
-- Não altera, move nem apaga nenhum dado existente. Escrita à mão de
-- propósito — `prisma migrate diff` contra produção é proibido no projeto
-- desde o incidente de 2026-08-14 (ver CLAUDE.md).

-- AlterEnum
ALTER TYPE "TipoOperacao" ADD VALUE 'RELATORIO_ANEXO6_CUSTO_EMPREGADOS_EXPORTADO';
