## [US-118] — Guia Valor Orçado vira dashboard-resumo da Proposta

**Módulo:** Plano de Contas / Valor Orçado
**Épico:** EP118/24 — Módulo de Cadastros
**Prioridade:** Média
**Estimativa:** M

**Como** usuário responsável pelo orçamento de uma Proposta,
**Quero** que a guia "Valor Orçado" seja a fonte de informação principal sobre quanto já foi orçado no projeto,
**Para** ter, em uma única tela, o total orçado, o detalhamento por conta sintética/analítica e o quadro de força de trabalho, sem precisar navegar entre guias para montar esse panorama.

### Contexto e Regras de Negócio

Hoje a guia "Valor Orçado" é só o formulário de lançamento (`ValorOrcadoContaForm.tsx`): 1 conta analítica + 1 exercício + 1 valor por vez, sem visão consolidada. O usuário pediu que ela passe a exibir:

1. **Valor Global** — mesmo conceito já existente em `Meta.valorGlobal` (US-112/ADR-017): soma de todas as contas analíticas com valor lançado em `ValorOrcadoConta`, todos os exercícios, da Versão vigente. Em Proposta `POR_META`, `Meta.valorGlobal` já é esse valor espelhado — pode ser lido direto quando existir Meta. Em Proposta `CONSOLIDADA` (sem Meta), o mesmo total precisa ser calculado direto do somatório de `ValorOrcadoConta`, com a mesma fórmula, para a tela funcionar em ambas as categorias.
2. **Contas sintéticas com total agregado**, em estrutura expansível (dropdown): cada sintética mostra a soma dos valores das analíticas-filhas; ao expandir, lista as analíticas-filhas e seus valores individuais. Só entram sintéticas com pelo menos uma analítica-filha com valor lançado (contas zeradas ficam ocultas — mesma filosofia já aplicada no Semáforo e no gráfico de ranking).
3. **Número de Empregados da Proposta** — contagem de `EmpregadoHeadcount` ativos (`ativo: true`), mesmo número do KPI "Total de Empregados" da guia Empregados.
4. O formulário de lançamento linha a linha (`ValorOrcadoContaForm.tsx`) continua existindo, agora como parte desta tela maior, não como a tela inteira.

### Critérios de Aceite

**Cenário 1 — Valor Global em Proposta Por Meta**
```gherkin
Dado que a Proposta é categoria POR_META e a Versão vigente tem uma Meta cadastrada
Quando o usuário abre a guia Valor Orçado
Então o Valor Global exibido é igual a Meta.valorGlobal
```

**Cenário 2 — Valor Global em Proposta Consolidada**
```gherkin
Dado que a Proposta é categoria CONSOLIDADA (sem Meta)
E existem lançamentos em ValorOrcadoConta somando R$ 50.000 entre 2 exercícios
Quando o usuário abre a guia Valor Orçado
Então o Valor Global exibido é R$ 50.000, calculado direto do somatório de ValorOrcadoConta
```

**Cenário 3 — Contas sintéticas expansíveis, só as com valor**
```gherkin
Dado que existem 3 contas sintéticas no Plano de Contas, mas só 2 têm alguma analítica-filha com valor lançado nesta Versão
Quando o usuário abre a guia Valor Orçado
Então apenas as 2 contas sintéticas com valor aparecem na lista
E cada uma mostra o total agregado (soma das analíticas-filhas)
E ao clicar/expandir uma sintética, a lista de analíticas-filhas com seus valores individuais é exibida
```

**Cenário 4 — Número de Empregados**
```gherkin
Dado que a Proposta tem 5 EmpregadoHeadcount ativos e 2 inativos (excluídos)
Quando o usuário abre a guia Valor Orçado
Então o número de Empregados exibido é 5
```

**Cenário 5 — Formulário de lançamento continua funcional**
```gherkin
Dado que o usuário está na guia Valor Orçado, com a Versão editável
Quando o usuário lança um novo valor orçado para uma conta analítica/exercício
Então o valor é salvo normalmente (ConfigurarValorOrcadoContaUseCase, sem mudança de regra)
E o Valor Global e a lista de sintéticas são recalculados/atualizados ao lado
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nenhuma nova — leitura de `ValorOrcadoConta`, `Meta`, `ContaContabil` (árvore), `EmpregadoHeadcount` |
| Novo cálculo | Valor Global: reaproveitar `ValorOrcadoTotalizerService` já existente (usado por `ConfigurarValorOrcadoContaUseCase` para recalcular ancestrais) — ou expor um novo método de leitura pura, sem duplicar a lógica de agregação por hierarquia de conta |
| Transação? | Não — é tela de leitura/dashboard, sem nova escrita |
| Auditoria | Não aplicável (sem nova escrita) |
| Regra de negócio | Ocultar contas sintéticas sem nenhuma analítica-filha com valor lançado |

### Dependências

- US-007 (`ConfigurarValorOrcadoContaUseCase`, já implementada)
- US-112 (`Meta.valorGlobal`, já implementada)
- US-108 (`EmpregadoHeadcount`, já implementada)

### Definition of Done

- [ ] Critérios de aceite 1-5 implementados
- [ ] `tsc --noEmit` limpo, lint limpo
- [ ] Testes automatizados para o cálculo de Valor Global em ambas categorias (POR_META e CONSOLIDADA)
- [ ] Testado manualmente no navegador pelo usuário
