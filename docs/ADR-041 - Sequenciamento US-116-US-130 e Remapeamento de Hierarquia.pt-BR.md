## ADR-041: Sequenciamento US-116/US-130 e padrão de remapeamento de hierarquia para importação de Estrutura Organizacional

**Status**: Aceito
**Data**: 2026-08-11
**Módulo SGO**: Cadastros — Empregados / Estrutura Funcional (EP118/24)

### Contexto

US-116 (UI de Estrutura Funcional — `/propostas/{id}/estrutura`) e US-130 (Importar Estrutura Organizacional entre Propostas) estão as duas na fila, ainda não codificadas. O backend de US-106 (`UnidadeFuncional`, `CriarUnidadeFuncionalUseCase`, `InativarUnidadeFuncionalUseCase`) já está em produção; só falta a tela.

US-130 foi refinada assumindo que precisa de US-116 pronta primeiro, porque o fluxo de importação (botão "Importar de outra Proposta") precisa de um lugar na UI para morar. Também ficaram em aberto, do lado técnico: (a) se as duas US devem compartilhar PR/branch, (b) como remapear a hierarquia self-relation (`idPai`) numa cópia — sem precedente no código (`DuplicarPropostaUseCase` só copia registros com FK para chaves estáveis, nunca remapeou self-relation), (c) se o escopo de `UnidadeFuncional` por `Proposta` (decisão do usuário, 2026-08-11) exige migration, e (d) como a trava de Cargo vinculado (RN_EST_04) se comporta em lote na importação.

### Forças em jogo

- **Risco de PR grande**: US-116 sozinha já é uma tela inteira (árvore, criar, inativar, validação de hierarquia) — categorizada como "M" no backlog. Somar US-130 no mesmo PR dobra a superfície de revisão de uma vez só, numa área que ainda não tem nenhuma UI para se apoiar (sem precedente visual pra copiar).
- **Dependência real de UI**: US-130 sem UI onde morar o botão não tem como ser testada manualmente por um usuário — só via teste automatizado, o que o histórico deste projeto (US-129, 3 gaps só achados em teste manual) mostra que não é suficiente para funcionalidades deste porte.
- **Reversibilidade de schema**: nenhuma migration está em jogo aqui — `UnidadeFuncional.propostaId` já é a FK usada desde a ADR-015 original. Isso reduz o custo de errar no sequenciamento (não há schema para desfazer).
- **Precedente de remapeamento**: o único código de cópia entre Propostas (`DuplicarPropostaUseCase`) não cobre self-relation. Inventar esse padrão junto com a pressão de entregar duas US ao mesmo tempo aumenta o risco de um bug sutil na hierarquia (ex: unidade Analítica apontando para o `idPai` errado após remapeamento).

### Alternativas Consideradas

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| **A — US-116 primeiro (PR próprio), US-130 depois (PR próprio)** | Cada PR tem escopo revisável isoladamente; US-116 dá ao usuário uma superfície real pra testar manualmente antes de US-130 chegar; erro de remapeamento de hierarquia em US-130 fica isolado de qualquer regressão em US-116 | Duas rodadas de CI/review em vez de uma; US-130 só chega depois de US-116 estar mergeada | Alta — sequenciamento é só ordem de branches, fácil de mudar se a prioridade mudar |
| **B — Mesmo PR/branch, entregues juntas** | Uma única revisão cobre a tela e o botão de importação já funcionando ponta a ponta desde o primeiro merge | PR grande demais pra revisar bem (tela nova inteira + use case novo de cópia com remapeamento nunca feito antes); se algo quebrar, difícil isolar se é bug da tela ou da importação; não há teste manual de US-116 isolado antes de empilhar mais uma feature em cima | Baixa — reverter exige desfazer as duas features juntas |
| **C — US-130 primeiro, exposta via Server Action sem UI (rota apenas)** | Desacopla a lógica de importação da tela | Usuário não consegue validar manualmente antes de ter UI — mesmo problema de "não pega gap real" já visto em US-129; e ainda cria uma UI provisória descartável, retrabalho | Média |

### Decisão

**Adotar Opção A — sequenciar US-116 primeiro (branch + PR próprio), US-130 depois (branch + PR próprio), a partir da master já com US-116 mergeada.**

Justificativa: nenhuma das duas é migration nem tem outra restrição que force paralelismo; a Opção B só economizaria uma rodada de CI ao custo de revisar corretude de hierarquia self-relation nunca feita antes junto com uma tela nova inteira — exatamente o tipo de PR grande que o histórico deste projeto (US-129) já mostrou que esconde gaps até o teste manual. Opção C resolve o desacoplamento técnico mas reintroduz o mesmo problema que motivou adiar US-130: sem UI, não há teste manual real.

### Padrão de remapeamento de hierarquia (para US-130)

Não há precedente no código — segue o desenho proposto para `ImportarEstruturaOrganizacionalUseCase`:

1. Ler todas as `UnidadeFuncional` ativas da Proposta origem (`propostaId = origemId, ativa: true`), ordenadas por `tipoNivel` de forma que os dois `SINTETICO_*` venham antes dos três `ANALITICO_*` (ordenação determinística por enum, não por `createdAt` — evita depender de ordem de inserção histórica).
2. **Passo 1 — criar as Sintéticas.** Para cada unidade com `idPai === null` (sempre Sintética, pela regra de negócio de US-106), `create` na Proposta destino sem `idPai`, guardando `map.set(unidade.id, novaUnidade.id)`.
3. **Passo 2 — criar as Analíticas.** Para cada unidade com `idPai !== null`, resolver `idPaiNovo = map.get(unidade.idPai)` (garantido existir, pois toda Analítica em US-106 aponta só para uma Sintética, nunca para outra Analítica — árvore de 2 níveis fixos) e `create` com esse `idPai`.
4. Isso evita qualquer necessidade de segunda passada ou `UPDATE` pós-criação — a árvore de 2 níveis fixos (ADR-015) permite resolver tudo em 2 lotes sequenciais dentro da mesma transação, sem grafo genérico nem recursão.
5. Todo o Passo 1 + Passo 2 + a inativação em lote das unidades antigas da destino (ver próxima seção) roda dentro de uma única `prisma.$transaction`, seguindo o mesmo padrão de `DuplicarPropostaUseCase` e `AplicarReajusteUseCase`.

**Nota de generalização:** este desenho depende da árvore ter exatamente 2 níveis fixos (invariante de ADR-015). Se a Estrutura Funcional algum dia ganhar mais níveis, o algoritmo de 2 passos precisa virar N passos por nível (mesma ideia, generalizada) — registrar como gatilho de revisão desta ADR.

### Confirmação de schema

**Nenhuma migration é necessária para US-130.** `UnidadeFuncional.propostaId` (`prisma/schema.prisma:629-633`) já é a FK usada desde a ADR-015 original — a decisão do usuário de manter o escopo por Proposta (em vez de migrar para Versão) apenas formaliza o que já está implementado. A nota técnica pendente na US-106 original já foi corrigida no documento.

### Trava de Cargo vinculado em lote (Cenário 4 de US-130)

`InativarUnidadeFuncionalUseCase` (RN_EST_04) checa `cargoAlocacaoPercentual.count({ where: { unidadeFuncionalId } })` **por unidade**, uma de cada vez, fora de contexto de importação em lote. Para US-130, propor uma checagem nova equivalente, rodada **antes** de abrir a transação de importação:

```ts
const unidadesComCargo = await prisma.unidadeFuncional.findMany({
  where: {
    tenantId,
    propostaId: destinoId,
    ativa: true,
    alocacoesCargo: { some: {} },
  },
  select: { id: true, nome: true },
});
if (unidadesComCargo.length > 0) {
  throw new ImportacaoEstruturaBloqueadaPorCargoVinculadoError(unidadesComCargo.map(u => u.nome));
}
```

Isso não reaproveita `InativarUnidadeFuncionalUseCase` diretamente (ele é por-unidade e já teria efeito colateral de escrita se chamado em loop) — é uma checagem read-only em lote, alinhada ao Cenário 4 do CA ("bloqueia a operação inteira antes de qualquer escrita"). O erro dedicado (`ImportacaoEstruturaBloqueadaPorCargoVinculadoError`) deve listar os nomes das unidades bloqueadoras na mensagem, conforme o CA exige.

### Consequências

- ✅ US-116 chega à produção mais rápido, isolada, com PR revisável e testável manualmente antes de qualquer feature nova em cima.
- ✅ Padrão de remapeamento de hierarquia fica documentado antes da implementação, reduzindo risco do tipo "bug só achado em teste manual" (histórico de US-129).
- ✅ Nenhuma migration necessária — menor risco de sequenciamento errado em produção.
- ⚠️ US-130 fica bloqueada até US-116 mergear — se houver pressão de prazo para entregar a importação mais cedo, essa decisão precisa ser revisitada explicitamente (não é para o fullstack-dev decidir sozinho pular a ordem).
- ⚠️ O algoritmo de remapeamento em 2 passos é acoplado à invariante de 2 níveis fixos da Estrutura Funcional — documentado como gatilho de revisão caso a árvore ganhe mais níveis no futuro.

### Revisão Recomendada

Se a árvore de Estrutura Funcional deixar de ser 2 níveis fixos (mudança na ADR-015), revisar o algoritmo de remapeamento de US-130 para N níveis. Se surgir pressão de prazo para entregar as duas US juntas, revisitar a decisão de sequenciamento explicitamente com o usuário, não silenciosamente no código.

**Ordem de codificação para o fullstack-dev: US-116 primeiro (branch + PR próprio); US-130 só começa depois de US-116 mergeada na master.**
