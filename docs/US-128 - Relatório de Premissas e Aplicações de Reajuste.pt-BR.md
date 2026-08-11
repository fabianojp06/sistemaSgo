## [US-128] — Relatório de Premissas e Aplicações de Reajuste (Consulta, Impressão, Exportação)

**Módulo:** Orçamentário — Premissas / Reajustes
**Épico:** EP48/26 — Módulo Orçamentário
**Prioridade:** Alta
**Estimativa:** M

**Como** Orçamentista, Auditor ou Planejador autenticado no SGO 2.0,
**Quero** visualizar, consultar e exportar o relatório de Premissas / Aplicações de Reajustes contratuais por Proposta e Versão,
**Para** analisar os índices de reajuste previstos por conta analítica ao longo dos anos de vigência do contrato, sem possibilidade de edição manual dos dados exibidos.

### Contexto e Regras de Negócio

Cobre a fatia **somente leitura** do UC04.02 (`docs/4 - Minuta da Especificação do Módulo Orçamentário-V2.docx`, [[modulo_orcamentario_ep48_minuta]]), formalizada nos Cenários 1-7 de `docs/CA_UC04.02_Premissas_Reajustes_Rev00.docx` (Rafael Guerra/GIA, revisado por Fabiano/BA-PO, 2026-08-10). A fatia de **escrita** (simular e aplicar reajuste em lote, Cenários 8-14 do mesmo CA) é **US-129**, deliberadamente separada — são naturezas de risco diferentes (consulta vs. operação financeira em lote).

Opera como View Reativa: nenhum dado é editável em tela [ORIGEM BLINDADA]. Segrega as premissas em dois blocos fixos — "dos Contratos" e "da Parceria (ACT)".

**Decisão do usuário (2026-08-10) — a entidade "Formula" do documento NÃO é nova, é a tela Rateio de Impostos já existente:**
- `Formula` (documento) = `AliquotaImpostoParametro` (schema atual). O campo `tipoIncidencia` (`CONTRATO` | `TERMO_DE_PARCERIA` | `AMBOS`) já é exatamente a segregação de RN0239 ("dos Contratos" vs. "da Parceria/ACT") — sem enum novo, sem entidade nova.
- `aliquotaPct` (`Decimal(5,2)`) é o percentual de reajuste/índice; `dataInicioVigencia`/`dataFimVigencia` é a janela de vigência que alimenta RN0225 (status "Realizado" vs. percentual futuro).
- `RateioImpostoGrade` (vínculo `aliquotaParametroId` + `contaId` analítica + `competencia` + `valorDeclarado` + `aliquotaAplicadaSnapshot`) já é o mecanismo de aplicação por conta e por competência — é a "aplicação" de que fala o título do UC ("Premissas / **Aplicações** de Reajustes").
- **Não há bloqueador de schema nesta US.** Este relatório é essencialmente uma **visão nova sobre dado que já existe** (`AliquotaImpostoParametro` + `RateioImpostoGrade`), reorganizada no layout de matriz ano-a-ano pedido pelo documento — não uma feature nova de domínio.
- **[ADR-040] Mapeamento vigência→grade ano-a-ano FECHADO.** Algoritmo, por conta analítica e por mês: (1) buscar entre os `AliquotaImpostoParametro` já vinculados àquela conta via `RateioImpostoGrade.aliquotaParametroId` aquele cuja janela `[dataInicioVigencia, dataFimVigencia ?? +∞)` cobre o mês; (2) mês `<=` mês corrente → tag "Realizado" sempre, independente de achar parâmetro; (3) mês `>` mês corrente → `aliquotaPct` do parâmetro encontrado, ou "—" se nenhum cobre esse mês (sem herança automática entre reajustes sucessivos — decisão consciente, ver ADR-040 para o porquê e o gatilho de revisão).

**Gap ainda em aberto, não resolvido por esta decisão:**
- **Nível de conta.** O documento assume `ContaAnalitica` sempre no Nível 7; o schema atual (`ContaContabil.nivel`) suporta 1-4. Mesmo bloqueador já registrado para todo o Módulo Orçamentário — [[modulo_orcamentario_ep48_minuta]]. Não resolvido; a Minuta (V2) ainda não é versão final segundo o usuário (2026-08-10). Isso não impede o desenho desta US (o relatório funciona igual em qualquer profundidade de árvore), só impede fechar a codificação final até a Minuta estabilizar.

Regras de negócio aplicáveis (mapeadas 1:1 do CA, já usando a terminologia do schema real):
- **RN0225** — Status Dinâmico de Vigência: mês passado exibe tag "Realizado"; mês futuro exibe o `aliquotaPct` vigente. Comparação de data pura contra o mês corrente do servidor — o SGO 2.0 não integra com ERP Senior real, então "Realizado" é só rótulo de leitura aqui, sem buscar valor externo.
- **RN0227** — Campo descritivo gerado pelo sistema, Somente Leitura.
- **RN0239** — Segregação obrigatória em 2 blocos, via `AliquotaImpostoParametro.tipoIncidencia` (`CONTRATO` / `TERMO_DE_PARCERIA`; `AMBOS` aparece nos dois blocos).
- **RN0383** — Filtro `[Exibir Contas Zeradas (Sim/Não)]` — contas analíticas sem nenhum `RateioImpostoGrade` vinculado.
- **RN0232** — Log síncrono em `HistoricoOperacao` a cada consulta/impressão/exportação com resultado (não logar consulta vazia — Cenário 6).
- **RN0200/RN0398** — Painel de filtros aplicados + carimbo cronológico no rodapé de PDF/XLSX exportados (mesmo padrão já usado em `exportarRelatorio.ts`, ADR-037).

### Critérios de Aceite

**Cenário 1 — Consulta padrão, contas zeradas ocultadas**
```gherkin
Dado que o usuário tem permissão de leitura em Orçamentário > Premissas de Reajustes
E a Proposta selecionada possui contas analíticas com RateioImpostoGrade vinculado a AliquotaImpostoParametro
Quando o usuário seleciona Proposta, Versão, mantém [Exibir Contas Zeradas] = Não e clica em [Consultar]
Então o sistema associa cada conta analítica ao(s) AliquotaImpostoParametro vigente(s) (RN0225)
E renderiza 2 blocos fixos: "dos Contratos" (tipoIncidencia = CONTRATO) e "da Parceria (ACT)" (tipoIncidencia = TERMO_DE_PARCERIA); AMBOS aparece nos 2 (RN0239)
E cada célula de mês passado exibe a tag "Realizado"; mês futuro exibe o aliquotaPct vigente para aquele período
E contas sem nenhum RateioImpostoGrade vinculado são ocultadas
E o log de consulta é gravado em HistoricoOperacao com filtros aplicados (RN0232)
```

**Cenário 2 — Consulta com contas zeradas visíveis**
```gherkin
Dado que existem contas analíticas sem RateioImpostoGrade vinculado na Proposta
Quando o usuário configura [Exibir Contas Zeradas] = Sim e clica em [Consultar]
Então todas as contas analíticas da Proposta aparecem, inclusive as sem rateio (RN0383)
E as contas sem rateio são exibidas com "0,00%" em todas as colunas de ano
E a segregação por blocos (Contratos/ACT) continua valendo independente do filtro
```

**Cenário 3 — Exportar XLSX**
```gherkin
Dado que uma consulta foi realizada com sucesso
Quando o usuário clica em [Exportar]
Então o sistema gera XLSX reaproveitando exportarParaXLSX (ADR-037, sem lib nova)
E o cabeçalho do arquivo estampa Nome do Termo de Parceria + Versão (RN0200)
E o rodapé contém o carimbo cronológico do servidor (RN0398)
E o log de exportação é gravado em HistoricoOperacao
```

**Cenário 4 — Imprimir**
```gherkin
Dado que uma consulta foi realizada com sucesso
Quando o usuário clica em [Imprimir]
Então o sistema aciona window.print() com layout dedicado (mesmo padrão CSS de impressão do Cronograma de Desembolso, US-122)
E o título impresso é "PREMISSAS / APLICAÇÕES DE REAJUSTE (%)" + Nome do TP + " - CONSOLIDADO", com tags "CENÁRIO" + Número da Versão + Data de Emissão
E o rodapé impresso traz o título fixo "PREMISSAS / APLICAÇÕES REAJUSTES (%)"
E o log de impressão é gravado em HistoricoOperacao
```

**Cenário 5 — Acesso sem permissão**
```gherkin
Dado que o perfil do usuário não tem a Funcionalidade de leitura deste relatório
Quando o usuário tenta acessar a guia/rota
Então o sistema bloqueia o acesso (mesmo padrão de usuarioTemFuncionalidade já usado em todo o projeto)
E nenhum dado é consultado
```

**Cenário 6 — Proposta sem rateios cadastrados**
```gherkin
Dado que a Proposta selecionada não tem nenhum RateioImpostoGrade cadastrado
Quando o usuário clica em [Consultar]
Então o sistema exibe "Nenhuma premissa de reajuste cadastrada para a proposta e versão selecionadas."
E os botões [Imprimir]/[Exportar] ficam desabilitados
E nenhum log é gravado para consulta vazia
```

**Cenário 7 — Tentativa de edição manual (ORIGEM BLINDADA)**
```gherkin
Dado que a matriz está renderizada em tela
Quando o usuário tenta alterar qualquer célula de percentual ou descrição
Então nada acontece — todos os campos são estritamente Somente Leitura, sem input algum na grid (bloqueio passivo por design, sem mensagem de erro)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Leitura de `AliquotaImpostoParametro`, `RateioImpostoGrade`, `ContaContabil`, `Proposta`/`VersaoProposta`; nenhuma escrita |
| Campos alterados | Nenhum (US somente leitura) |
| Transação? | Não |
| Requer lock? | Não |
| Auditoria | RN0232 — `TipoOperacao` novo: `PREMISSA_REAJUSTE_CONSULTADA` (consulta/impressão/exportação com resultado, nunca em resultado vazio) |
| Regra de negócio | RN0225, RN0227, RN0239, RN0383 |

### Dependências

- **[ADR-040]** define a única migration desta linha de trabalho: ampliar `AliquotaImpostoParametro.aliquotaPct` de `Decimal(5,2)` para `Decimal(9,4)` (compartilhada com US-129, RNF_PR_004). Nenhuma migration adicional é necessária para US-128 isoladamente.
- **Bloqueador de nível de conta** (Módulo Orçamentário como um todo) — ver [[modulo_orcamentario_ep48_minuta]]. Aguardando versão final do documento-fonte.
- **Implementado sem `Funcionalidade` dedicada** — mesmo padrão já usado pela guia irmã "Cronograma de Desembolso" (US-122): é uma guia dentro do detalhe da Proposta, controlada só pelo acesso geral à Proposta/Versão, sem gate de permissão por Funcionalidade individual. Cenário 5 (acesso sem permissão) reflete esse padrão — reforçar aqui só se o produto decidir introduzir controle de acesso por guia em todo o app, o que hoje não existe nem para os relatórios já em produção.

### Definition of Done

- [x] Cenários 1 a 7 implementados e testados manualmente (Cenário 5 segue o padrão de acesso das demais guias de relatório, sem Funcionalidade dedicada — ver Dependências)
- [x] Algoritmo de projeção ano-a-ano (ADR-040, Decisão 1) implementado exatamente como especificado (sem herança automática) — `ListarPremissasReajusteUseCase.ts`
- [x] Segregação em 2 blocos (Contratos/ACT) validada via `tipoIncidencia`
- [x] Filtro Exibir Contas Zeradas funcionando nos 2 estados (client-side, `PremissasReajusteGrid.tsx`)
- [x] Nenhum campo editável na grid (Cenário 7) — tabela 100% somente leitura
- [x] Log de auditoria gravado em consulta com resultado (`PREMISSA_REAJUSTE_CONSULTADA`), nunca em vazio
- [x] Exportação XLSX/impressão reaproveitando `exportarRelatorio.ts` (ADR-037) e o padrão `print:`/`hidden print:block` do Cronograma de Desembolso, sem lib nova
- [x] `tsc --noEmit`, `eslint` e suíte completa (293 testes) verdes após a migration

**Status: implementada** (commit pendente de revisão do usuário). Migration `20260810182916_premissas_reajuste_aliquota_precisao` aplicada (amplia `aliquotaPct` para `Decimal(9,4)`, compartilhada com US-129 — que continua não codificada). Nova guia "Premissas e Reajustes" em `/propostas/[id]/premissas-reajustes`.
