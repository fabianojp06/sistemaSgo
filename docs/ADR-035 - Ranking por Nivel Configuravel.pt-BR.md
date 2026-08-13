## ADR-035: Ranking do dashboard Valor Orçado agrupável por nível configurável (client-side)

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Dashboard-resumo da Proposta (US-118/US-121)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-07 17:48 UTC) — a decisão já estava implementada em produção (commit `f39468e`) antes deste arquivo existir.

### Contexto

Usuário achou que o ranking do dashboard "não fará sentido" agrupado só na conta sintética raiz — pediu para agrupar pelo nível do código ERP, configurável (o usuário escolhe entre 2, 3 ou 4).

### Decisão

Manter `montarResumoValorOrcado.ts` retornando a árvore completa (não só raízes pré-recortadas) e resolver a troca de nível 100% client-side via `useMemo`, sem nova query — o servidor já carregava todas as `ContaContabil` do tenant de qualquer forma. Regra de "conta de parada" no caminho raiz→folha: para no primeiro nó com `nivel >= N` OU que já é `isAnalitica` antes disso (o que vier primeiro) — garante que 100% do valor sempre aparece no ranking, nenhum ramo "some" por ser mais raso que o nível pedido.

Também resolvido: cor por hash determinístico do `contaId` (não por posição), estável entre reordenações do ranking.

### Consequências

- ✅ Zero query nova — filtragem por nível é derivada no client de dados já carregados.
- ⚠️ Risco identificado e aceito: mudar o contrato de retorno de `montarResumoValorOrcado.ts` teria quebrado silenciosamente testes dependentes do formato antigo — só havia 1 consumidor no momento, risco local, mitigado com 4 testes novos garantindo que a soma das barras sempre bate com o total.
- Motivou depois a reescrita completa de `BarChartHorizontal.tsx` (SVG→HTML/CSS), registrada informalmente na mesma sessão sem virar ADR numerado próprio (puramente de UI, sem decisão de domínio).
