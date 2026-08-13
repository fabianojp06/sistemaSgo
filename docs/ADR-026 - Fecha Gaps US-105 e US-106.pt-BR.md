## ADR-026: Fecha 2 gaps remanescentes de US-105 (Optimistic Locking) e US-106 (rateio N:M de Cargo)

**Status**: Aceito
**Data**: 2026-08-06
**Módulo SGO**: Cadastros — Estrutura Funcional e todas as guias analíticas
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-06, 09:15 UTC) — a decisão já estava implementada em produção (commit `92f48b0`) antes deste arquivo existir.

### Decisão 1 — US-105 completa

Optimistic Locking (`tokenConcorrencia`/`updatedAt`, `ConflitoConcorrenciaError`) estendido de `ValorOrcadoConta`/`RateioImpostoGrade`/`TermoAjuste` para as guias analíticas restantes — `Meta`, `Viagem`, `ItemPatrimonial`, `Empregado`, `QtdeEmpregado`. US-105 (UC03.10) sai de parcial para **completa**.

### Decisão 2 — US-106 completa: Cargo↔UnidadeFuncional migra para N:M

`Cargo↔UnidadeFuncional` (ADR-016, 1:1) migrado para **N:M com rateio percentual** via nova tabela `CargoAlocacaoPercentual` (soma sempre 100%, RN_EST_03). Migration em 2 passos (cria+backfill, depois drop da coluna antiga). `EmpregadoHeadcount.vinculoFuncionalHerdado` passou a refletir múltiplas alocações. RN_EST_01 já era satisfeita por construção; RN_EST_05 (saneamento na importação Rubi) fica para quando existir integração real.

### Consequências

- ✅ Optimistic Locking uniforme em todas as guias financeiras da Proposta.
- ✅ Cargo pode ratear seu custo entre múltiplas Unidades Funcionais, resolvendo a limitação identificada da ADR-016.
- ⚠️ Migration de 2 passos exige atenção de ordem de deploy (cria+backfill antes de dropar a coluna antiga) — mesmo cuidado repetido depois em ADR-034/ADR-038.
