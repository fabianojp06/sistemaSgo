## ADR-027: `Cargo.contaId`, `EmpregadoHeadcount.contaId` (snapshot) e `RateioImpostoGrade.contaId` obrigatórios

**Status**: Aceito
**Data**: 2026-08-06
**Módulo SGO**: Cadastros — Semáforo Orçamentário (US-008a) / toda a base de RH e Rateio
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-06, 13:40 UTC) — a decisão já estava implementada em produção (commit `2775f25`) antes deste arquivo existir.

### Contexto

Ao implementar `CalcularValorRealizadoUseCase` (1ª rodada de US-008a), achado: Empregado/RateioImpostoGrade não tinham `contaId` no schema — impossível comparar Valor Realizado contra Valor Orçado por conta analítica para essas 2 fontes. Usuário respondeu com regra de negócio nova e retroativa: **"todo custo, todo lançamento no sistema deverá estar associado a uma conta"**, e esclareceu que a conta reflete a natureza da despesa (ex: "Despesa com Pessoal"), não o organograma — validando `Cargo.contaId` fixo, independente do rateio percentual `CargoAlocacaoPercentual` (ADR-026).

### Decisão

`Cargo.contaId` obrigatório; `EmpregadoHeadcount.contaId` como snapshot herdado do Cargo (mesmo padrão de `vinculoFuncionalHerdado`, ADR-018); `RateioImpostoGrade.contaId` obrigatório. Confirmado via `prisma.count()` real no Supabase que as 3 tabelas tinham 0 registros em produção — migration `NOT NULL` direto, sem backfill.

`CalcularValorRealizadoUseCase` passou a somar as 4 fontes (Viagem/ItemPatrimonial/Empregado/RateioImpostoGrade) e `parcial` deixou de ser `true` fixo — agora via constante extensível `HA_FONTE_DE_CUSTO_SEM_CONTA_CONHECIDA` (hoje `false`).

### Consequências

- ✅ Semáforo Orçamentário (US-008a) passa a somar Valor Realizado de todas as fontes, sem gap de dados.
- ✅ Regra "todo lançamento deve ter conta" vira invariante estrutural do projeto, não só recomendação.
- Base direta para US-101a (Server Action/UI de Rateio de Impostos) implementada na mesma sessão.
