## ADR-022: Viagem modelada com 3 componentes de custo, cada um com conta própria

**Status**: Aceito (revisado em 2026-08-07, ver Decisão 2)
**Data**: 2026-08-04
**Módulo SGO**: Cadastros — Viagens (US-109, UC03.29-33)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `prisma/schema.prisma` e `CONTEXTO_SESSOES.md` — a decisão já estava implementada em produção (commit `5ee2def`) antes deste arquivo existir. Ver também [[US-109]].

### Decisão 1 — 3 componentes de custo, 3 contas analíticas

`Viagem` não tem uma única conta — tem 3 (`contaPassagemId`/`contaDiariaId`/`contaTransporteId`), cada componente calculado independentemente e somado em `custoEstimado` [ORIGEM BLINDADA], sempre calculado no servidor. As 3 contas devem ser analíticas (RN_PLA_003), validadas via `contasPorId`/`isAnalitica` em `CadastrarViagemUseCase`.

### Decisão 2 — `metaId` opcional (correção de escopo, 2026-08-07)

Na primeira versão, Viagem exigia Meta sempre (exclusiva de `POR_META`). Usuário testou lançar Viagem numa Proposta `CONSOLIDADA` e recebeu bloqueio indevido — regra corrigida para `metaId` opcional, obrigatório só quando `Proposta.categoria=POR_META`, mesmo padrão de `ItemPatrimonial` (ADR-023). Confirmado 0 registros de `Viagem` em produção no momento da correção — migration `20260807143336_viagem_meta_opcional` segura, sem backfill. Classe de erro `ViagemForaDeEscopoCategoriaError` removida (sem mais uso).

### Consequências

- ✅ Composição de custo por componente (Passagem/Diária/Transporte) reutilizada depois pelo dashboard de insights (ADR-036) e pelo Cronograma de Desembolso (ADR-037/US-122, com a limitação de Viagem não ter campo de data — custo cai inteiro no primeiro mês).
- ✅ Sem lock pessimista — mesma simplicidade transacional de Cargo/Meta.
- ⚠️ A correção da Decisão 2 exigiu inverter o teste do Cenário 2 (antes validava bloqueio, passou a validar criação com `metaId: null`) — atenção ao ler testes antigos de `CadastrarViagemUseCase.test.ts` anteriores a 2026-08-07.
