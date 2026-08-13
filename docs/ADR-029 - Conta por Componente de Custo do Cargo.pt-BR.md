## ADR-029: Cada componente de custo do Cargo ganha conta analítica própria + snapshot

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Cargos e Salários / Semáforo Orçamentário
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`adr029_conta_componente_custo_cargo.md`) — a decisão já estava implementada em produção (commit `a20b093`) antes deste arquivo existir.

### Contexto

Todo o custo do Empregado caía numa única conta (`contaId` do Cargo/Empregado, ADR-027). A US pedia que cada componente de custo pudesse ser lançado na conta analítica correta (ex.: vale-transporte numa conta, plano de saúde noutra).

### Decisão

Cada componente de custo do Cargo (gratificação, encargos sociais, vale-alimentação, vale-refeição, vale-transporte, plano odontológico, seguro de vida, plano de saúde, auxílio-creche) ganha seu próprio campo de conta analítica opcional (`contaXxxId`) em `Cargo` e `EmpregadoHeadcount`, com valor snapshot (`valorXxxSnapshot`) congelado no cadastro/edição do Empregado — mesmo padrão de congelamento já usado para `custoTotalMensal`/`contaId` (ADR-018/ADR-027).

Peças-chave: `validarContasComponenteCusto.ts` (valida existência/tenant/analítica de cada conta), `montarSnapshotComponenteCustoEmpregado.ts` (monta o snapshot; `valorSalarioSnapshot` é residual — `custoTotalCargo` menos soma dos outros 8 — para a soma nunca sobrar/faltar). `CalcularValorRealizadoUseCase` passou a distribuir o custo entre as contas configuradas.

### Consequências

- ✅ Semáforo Orçamentário passa a distribuir corretamente o custo do Empregado por conta analítica, componente a componente.
- ✅ Padrão de referência para futuros componentes de custo (campo conta + campo valor snapshot + entrada nas 3 peças-chave).
- ⚠️ Motivou o gap resolvido por [[ADR-030]] (edição de benefícios do Cargo não recalcula Empregados já cadastrados).
