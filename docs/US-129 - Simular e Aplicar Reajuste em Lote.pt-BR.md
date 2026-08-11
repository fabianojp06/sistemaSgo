## [US-129] — Simular e Aplicar Reajuste em Lote (Efeito Cascata Descendente)

**Módulo:** Orçamentário — Premissas / Reajustes
**Épico:** EP48/26 — Módulo Orçamentário
**Prioridade:** Média
**Estimativa:** G

**Como** Orçamentista com permissão de escrita,
**Quero** simular o impacto de um índice de reajuste antes de confirmar, e depois aplicá-lo em lote sobre uma Conta Analítica, Agrupador ou Categoria,
**Para** reajustar dotações planejadas de forma auditável, sem risco de aplicar um valor errado de forma irreversível.

### Contexto e Regras de Negócio

Cobre a fatia de **escrita** do UC04.02 (Cenários 8-14 de `docs/CA_UC04.02_Premissas_Reajustes_Rev00.docx`). É uma **operação financeira crítica** — segue o Protocolo Transacional obrigatório do projeto (validar → transação → travar registro → executar → auditar na mesma transação → nunca `Float`). Depende de **US-128** apenas pela leitura compartilhada de `AliquotaImpostoParametro`/`RateioImpostoGrade`; a tela de simulação/aplicação é separada da tela de consulta.

**Decisões do usuário (2026-08-10):**

1. **"Formula" = Rateio de Impostos, já existente** (mesma decisão de US-128) — `AliquotaImpostoParametro` (índice/percentual + `tipoIncidencia`) e `RateioImpostoGrade` (aplicação por conta analítica + competência). Sem entidade nova de schema para o motor de reajuste em si; a "aplicação em lote" desta US é, na prática, criar/atualizar linhas de `RateioImpostoGrade` em cascata a partir de um `AliquotaImpostoParametro`.
2. **O cálculo do reajuste deve ser realizado em TODOS os status da Proposta** — isso **substitui RN_PR_003** do documento original (que bloqueava reajuste em Propostas "Encerrado/Inativo/Cancelado"). Decisão explícita do usuário, documentada aqui porque diverge do CA assinado por Rafael Guerra/GIA (`docs/CA_UC04.02_Premissas_Reajustes_Rev00.docx`, ainda com status "pendente validação André/SCOR" — avisar a cadeia de validação sobre essa mudança antes de fechar o CA formalmente). **Cenário 8 abaixo foi reescrito para refletir isso** (não bloqueia mais por status).
3. **Sobreposição com ADR-039 (EM ABERTO) — segue como está.** Usuário confirmou manter a estrutura atual das 2 US (US-128/129) e revisitar a relação com o ADR-039 depois que ele for atualizado/respondido. Não é bloqueador para o refinamento técnico desta US, mas o motor de cascata (RN_PR_001) deve ser desenhado tendo em mente que pode precisar convergir com o motor do ADR-039 mais adiante — evitar acoplamento que dificulte essa futura unificação.

**[ADR-040] Fluxo de retroatividade FECHADO.** RN_PR_002 nunca toca linhas históricas de `RateioImpostoGrade` (preserva a invariante de imutabilidade já testada, RN_TAX_03/06). Ao confirmar um reajuste retroativo: (1) meses futuros dentro da nova vigência seguem o fluxo normal de `ConfigurarRateioImpostoUseCase`, criando/atualizando `RateioImpostoGrade` competência a competência; (2) meses passados dentro do range retroativo **não são alterados** — em vez disso, o sistema cria **uma única linha nova** de `RateioImpostoGrade` na competência do **mês atual**, com `valorDeclarado` = soma das diferenças (novo % − % anterior) × base de cada mês retroativo afetado; (3) não precisa de campo novo em `RateioImpostoGrade` para marcar "é ajuste" — o payload JSON do log delta (RN_PR_004) já registra quais meses/contas originaram a linha; (4) `ValorRealizadoService` não precisa de nenhuma mudança — a linha de ajuste é datada no mês atual e entra naturalmente no cálculo desse mês.

**[ADR-040] Precisão de `aliquotaPct` FECHADA.** Amplia-se `AliquotaImpostoParametro.aliquotaPct` de `Decimal(5,2)` para `Decimal(9,4)` (migration segura, sem perda de dado — expansão de scale). Efeito colateral a tratar na implementação: `AliquotaImpostoListPanel.tsx:328` formata hoje com `toFixed(2)` fixo — ajustar para exibir até 4 casas sem zeros à direita desnecessários. Validar após a migration se algum teste compara `aliquotaPct` como string literal de 2 casas (ex. `ConfigurarRateioImpostoUseCase.test.ts:123`).

Regras de negócio aplicáveis (mapeadas do CA, com a alteração do item 2 acima):
- **RN_PR_001** — Efeito Cascata Descendente: reajuste em Agrupador/Categoria (`ContaAgrupadora`/`ContaAgrupadoraItem`, já existente) replica para todas as Contas Analíticas filhas.
- **RN_PR_002** — Retroatividade Controlada: vigência retroativa recalcula só "Planejado/Projeção"; "Realizado" (`ValorRealizadoService`) nunca muda.
- ~~RN_PR_003~~ — **Removida por decisão do usuário**: o cálculo roda em qualquer status de Proposta, sem bloqueio.
- **RN_PR_004** — Log Delta: `HistoricoOperacao` com payload JSON (IDs das contas, valor original, valor novo).
- **RN_PR_005** — Categoria nula → aplica globalmente, rotula "Todas".
- **RN_PR_006** — Arredondamento Half-Even, 2 casas decimais no valor monetário resultante (`Prisma.Decimal.ROUND_HALF_EVEN`, já usado em `montarCronogramaDesembolso.ts`/US-122 — reaproveitar o padrão).
- **RNF_PR_001/002** — Isolamento transacional + rollback total em falha de lote — `prisma.$transaction()` com `isolationLevel` explícito, sem exceção.
- **RNF_PR_003** — Performance: lote de até 2.000 contas em ≤5s; acima de 2s, exibir barra de progresso.
- **RNF_PR_004** — Índice com até 4 casas decimais — resolvido em ADR-040 (ampliação de `aliquotaPct` para `Decimal(9,4)`).

### Critérios de Aceite

**Cenário 8 — Cálculo de reajuste roda em qualquer status de Proposta**
```gherkin
Dado que o usuário selecionou uma Proposta em qualquer status (RASCUNHO, EM_ELABORACAO, OFICIALIZADO ou ENCERRADO)
Quando o usuário aplica um reajuste sobre essa Proposta
Então o sistema processa o cálculo normalmente, sem bloqueio por status (decisão do usuário, substitui RN_PR_003 do CA original)
E o log delta registra o status da Proposta no momento da aplicação, para rastreabilidade futura
```

**Cenário 9 — Simulação (Preview), sem persistir**
```gherkin
Dado que o usuário selecionou uma Proposta e um AliquotaImpostoParametro de referência
Quando o usuário escolhe o escopo (Conta/Agrupador/Categoria) e clica em [Simular]
Então o sistema exibe o preview dos valores resultantes, sem gravar nada no banco
E os valores usam arredondamento Half-Even, 2 casas decimais (RN_PR_006)
E nenhum log é gravado em HistoricoOperacao durante a simulação
E o preview já reflete o efeito cascata sobre as contas filhas do escopo (RN_PR_001)
```

**Cenário 10 — Confirmar aplicação com efeito cascata**
```gherkin
Dado que o usuário simulou (Cenário 9) e clica em [Confirmar Reajuste]
Quando a confirmação é processada
Então o sistema aplica o percentual em todas as Contas Analíticas filhas do Agrupador/Categoria, dentro de uma única prisma.$transaction() (RN_PR_001)
E cada valor resultante usa Half-Even, 2 casas decimais (RN_PR_006)
E o log delta é gravado na mesma transação em HistoricoOperacao com payload JSON (IDs, valor original, valor novo) (RN_PR_004)
E a grid é atualizada refletindo os novos percentuais
```

**Cenário 11 — Reajuste retroativo preserva o Realizado**
```gherkin
Dado que o usuário aplica um reajuste com vigência anterior ao mês corrente
Quando a aplicação é confirmada
Então o sistema recalcula apenas a coluna "Planejado/Projeção" dos meses passados (RN_PR_002)
E nenhum valor computado por ValorRealizadoService é alterado
E o log delta registra os meses retroativos afetados
```

**Cenário 12 — Categoria nula aplica globalmente**
```gherkin
Dado que o usuário mantém o filtro "Categoria de Despesa" vazio ao aplicar o reajuste
Quando a operação é confirmada
Então o reajuste é aplicado sobre todo o custeio do projeto (RN_PR_005)
E o log e o cabeçalho do relatório gerado exibem "Todas" no campo de categoria
```

**Cenário 13 — Performance em lote de até 2.000 contas**
```gherkin
Dado que a árvore orçamentária da Proposta tem até 2.000 contas analíticas
Quando o usuário confirma o reajuste em lote
Então o processamento e a atualização da grid ocorrem em até 5,0 segundos (RNF_PR_003)
E se ultrapassar 2,0 segundos, uma barra de progresso é exibida durante o processamento assíncrono
```

**Cenário 14 — Rollback total em falha de lote**
```gherkin
Dado que o sistema está processando um lote de reajuste
Quando ocorre um erro no meio do processamento (ex: violação de constraint, timeout)
Então toda a transação sofre rollback — nenhuma conta fica parcialmente atualizada (RNF_PR_002)
E o sistema exibe "Erro no processamento do reajuste. Nenhuma alteração foi salva. Tente novamente."
E o modal permanece aberto com os dados preservados [TRAVA O ERRO]
E nenhum log delta é gravado para a operação que falhou
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `AliquotaImpostoParametro` (leitura), `ContaContabil`/`ContaAgrupadora` (leitura), `RateioImpostoGrade` (escrita — criação em lote por competência futura; para retroatividade, só **insert** de 1 linha nova no mês atual, nunca update de linha passada), `HistoricoOperacao` (escrita) |
| Campos alterados | Novas linhas de `RateioImpostoGrade` (`valorDeclarado`/`aliquotaAplicadaSnapshot`); nenhuma linha histórica é alterada (ADR-040) |
| Transação? | Sim — `prisma.$transaction()` com `isolationLevel` explícito, todo o lote + log de auditoria na mesma transação |
| Requer lock? | Isolamento de transação (`REPEATABLE READ` ou superior) é suficiente — como retroatividade nunca faz `UPDATE` em linha existente (só `INSERT`), o risco de dirty read/race condition é o mesmo já mitigado pela constraint única `[tenantId, versaoId, aliquotaParametroId, competencia]` de `RateioImpostoGrade`; não é necessário `SELECT FOR UPDATE` adicional |
| Auditoria | RN_PR_004 — `TipoOperacao` novo: `REAJUSTE_APLICADO`, payload JSON com lista de contas afetadas + valor antes/depois + status da Proposta no momento (Cenário 8) |
| Regra de negócio | RN_PR_001, RN_PR_002, RN_PR_004, RN_PR_005, RN_PR_006, RNF_PR_001 a 004 (RN_PR_003 removida) |

### Dependências

- **US-128**: leitura compartilhada de `AliquotaImpostoParametro`/`RateioImpostoGrade`.
- **[ADR-040]** — migration única compartilhada: ampliar `aliquotaPct` para `Decimal(9,4)` + ajuste de formatação em `AliquotaImpostoListPanel.tsx:328`.
- Nova `Funcionalidade` CONTEXTUAL `orcamentario.premissas-reajustes.aplicar`.
- **ADR-039 (EM ABERTO)** — não bloqueia esta US, mas o motor de cascata (RN_PR_001) deve evitar acoplamento que dificulte convergir com o motor do ADR-039 depois que ele for respondido.

### Definition of Done

- [ ] Cenários 8 a 14 implementados e testados
- [ ] Protocolo Transacional completo: transação com isolamento explícito, rollback testado (Cenário 14)
- [ ] Efeito cascata validado em Agrupador com múltiplas contas filhas
- [ ] Retroatividade controlada: valor de `ValorRealizadoService` não muda após reajuste retroativo (Cenário 11)
- [ ] Cálculo confirmado funcionando em Proposta de qualquer status (Cenário 8, sem bloqueio)
- [ ] Arredondamento Half-Even validado com casos de centavo
- [ ] Performance testada com lote de até 2.000 contas (Cenário 13)
- [ ] Log delta completo (IDs, valor antes/depois, status da Proposta) em toda aplicação confirmada, nunca em simulação

**Status: pronta para desenvolvimento** — [[adr040_premissas_reajustes_rateio_impostos]] fechou os 2 pontos de desenho pendentes (retroatividade e precisão). Fluxo de trabalho desta US, quando codificada: **branch + PR obrigatório** (regra de negócio financeira), com `/code-review` antes do merge — sem exceção, conforme fluxo Git híbrido por risco já registrado no projeto.
