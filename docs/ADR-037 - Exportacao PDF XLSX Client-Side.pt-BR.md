## ADR-037: Exportação PDF/XLSX 100% client-side, utilitário reutilizável

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Orçamentário — Cronograma de Desembolso (US-122, UC04.01) e módulos seguintes
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-07 20:50 UTC) — a decisão já estava implementada em produção (commit `674c759`) antes deste arquivo existir.

### Contexto

Ao implementar US-122 (Cronograma de Desembolso), usuário pediu para resolver exportação PDF/XLSX, que não existia em nenhuma tela do projeto até então.

### Decisão

Exportação 100% client-side: `jspdf`+`jspdf-autotable` para PDF, `exceljs` para XLSX. Utilitário reutilizável `src/lib/export/exportarRelatorio.ts` (`exportarParaXLSX`/`exportarParaPDF`), evitando Puppeteer/Chromium headless (caro em ambiente serverless). Decisão pensada para servir as próximas ~15 UCs do Módulo Orçamentário, não só esta.

**Limitação conhecida e documentada:** `Viagem` não tem campo de data no schema — no Cronograma, custo inteiro cai no primeiro mês da vigência (decisão explícita do Tech Lead, não é bug).

### Consequências

- ✅ Sem infraestrutura de renderização server-side — exportação funciona em qualquer ambiente sem custo de Chromium headless.
- ✅ Utilitário reaproveitado sem lib nova em US-123-126 (Alíquotas de Impostos) e US-128 (Premissas/Reajustes).
- ⚠️ `npm install` de `jspdf`/`jspdf-autotable`/`exceljs` reportou 12 vulnerabilidades (`npm audit`) — não investigado a fundo, ficou registrado como próximo passo pendente.
- ⚠️ Bug de "Exportar PDF não funciona" encontrado depois numa rodada de QA de Alíquotas de Impostos (ver `diagnostico_2a_rodada_qa_aliquotas_2026_08_08.md`) — já resolvido, não relacionado ao desenho desta ADR.
