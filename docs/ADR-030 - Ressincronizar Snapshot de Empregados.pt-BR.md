## ADR-030: Ação explícita "Ressincronizar Empregados" para atualizar snapshot pós-edição do Cargo

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Cargos e Salários / Semáforo Orçamentário
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`adr030_ressincronizar_snapshot_empregados.md`) — a decisão já estava implementada em produção (commit `ea44fec`) antes deste arquivo existir.

### Contexto

Usuário relatou: configurou contas de benefício no Cargo (ADR-029), Semáforo não atualizou. Causa raiz: `EmpregadoHeadcount` guarda snapshot congelado do custo do Cargo (ADR-018) — `ConfigurarBeneficiosCargoUseCase`/`EditarCargoUseCase` só alteram a tabela `Cargo`, nunca recalculam Empregados já cadastrados.

### Decisão

Não recalcular automaticamente dentro da mesma transação de editar o Cargo — quebraria a garantia de congelamento intencional pós-consolidação (ADR-018). Em vez disso, ação explícita e auditável: `RessincronizarSnapshotEmpregadosCargoUseCase` re-herda `custoTotalMensal`/`contaId`/`vinculoFuncionalHerdado` + os 9 componentes de ADR-029 para Empregados do Cargo; ignora (não altera) Empregados de Proposta já oficializada, reportando no resultado.

Botão "Ressincronizar Empregados" em `CargoPanel.tsx`, visível ao editar um Cargo existente. Novo valor de enum `TipoOperacao.EMPREGADOS_SNAPSHOT_RESSINCRONIZADO`.

### Consequências

- ✅ Congelamento intencional pós-consolidação (ADR-018) preservado — nada recalcula sozinho.
- ✅ Se usuário reclamar de valores desatualizados no Semáforo após editar Cargo/benefícios, o fluxo correto é: editar o Cargo → clicar "Ressincronizar Empregados"; se a Proposta já estiver oficializada, os Empregados não atualizam por desenho — não é bug.
- Ver também [[ADR-029]].
