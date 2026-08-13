## ADR-036: Dashboard de insights de Viagens reaproveita a decomposição por componente

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Viagens (dashboard de insights)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-07 20:07 UTC) — a decisão já estava implementada em produção (commit `cc0302a`) antes deste arquivo existir.

### Contexto

Usuário pediu "insights só com dados de Viagem, gráfico assim como nas outras telas". AN/PO ofereceu 4 opções (KPIs+ranking / composição por componente / ranking por conta / custo médio por pessoa-dia); usuário escolheu KPIs+ranking e composição por componente.

### Decisão

Extrair `calcularComponentesCustoViagem` em `calcularCustoEstimadoViagem.ts` — a fórmula do total passou a **somar** os 3 componentes (Passagem/Diária/Transporte) como única fonte de verdade, em vez de ter só o total sem decomposição nem teste. Dashboard calculado 100% client-side via `useMemo` sobre o state já existente: 4 KPIs (Nº de Viagens, Custo Total Estimado, Custo Médio por Viagem, Total de Pessoas-Viagem) + 2 `BarChartHorizontal` (ranking por Viagem, composição Passagem×Diária×Transporte).

### Consequências

- ✅ `calcularComponentesCustoViagem` vira a fonte compartilhada de decomposição de custo — reutilizada também na descrição de US-109 (ver [[ADR-022]]).
- ✅ `calcularCustoEstimadoViagem.test.ts` (3 casos novos) — cálculo [ORIGEM BLINDADA] que antes não tinha cobertura própria.
- Zero query nova no servidor — mesmo padrão client-side já validado em ADR-035.
