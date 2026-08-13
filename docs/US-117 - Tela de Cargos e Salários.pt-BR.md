## [US-117] — Tela de Cargos e Salários

**Módulo:** Cadastros — Cargos e Salários (UC03.19, UC03.24-27)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** G
**Nota de proveniência:** documento reconstruído retroativamente em 2026-08-13 — implementada em 2026-08-06 (commit `347b7ef`, mesma entrega de US-116) e evoluída em 3 rodadas de feedback de teste manual real na mesma sessão (commits `96fce36`, `ab22790`, `d2951d2`), mas nunca ganhou arquivo próprio em `docs/`. Reconstruído a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-06, 14h18–21h11 UTC).

**Como** Usuário Comum (GFIN),
**Quero** uma tela dedicada para cadastrar/editar Cargos (com rateio percentual entre Unidades Funcionais e benefícios) e lançar Qtde. Empregado em lote,
**Para** que US-107/US-107a/US-108/US-108a/US-112/US-113 (todas já implementadas em backend desde 2026-08-03/04, sem UI) finalmente sejam operáveis pelo usuário final.

### Contexto e Regras de Negócio

Fecha o maior gap de "backend à frente da UI" do projeto (5 US inteiras só com use case/Server Action, sem tela). Sub-aba "Cargos" (`CargoPanel.tsx`) na mesma rota `/propostas/{id}/estrutura` de US-116.

**ADR-028 (ponto 2 do feedback #1):** a tela tem 2 seções de salvamento (dados do Cargo + Benefícios) — decisão do Tech Lead foi **não fundir** `CadastrarCargoUseCase`/`ConfigurarBeneficiosCargoUseCase` num só use case; a orquestração acontece só na Server Action (`salvarCargoCompleto`), com contrato de erro parcial (Cargo salvo mesmo se Benefícios falhar).

**US-108b (formalizada durante o teste, ponto (a) do feedback #1):** lançamento de quantidade de vagas por Cargo em lote, não uma de cada vez — `CadastrarEmpregadosEmLoteUseCase`.

**US-113b (formalizada durante o teste, ponto (a) do feedback #2):** consolidação de Qtde. Empregado mostrando valor total (quantidade × custo × tempo de contrato), com fórmula de overlap de período por Empregado (`calcularValorTotalConsolidado.ts`) — não é multiplicação simples, cada Empregado do lote pode ter período diferente.

**Melhorias de UX adicionadas durante o teste (feedback #3, direto no chat):**
- Número do Documento da consolidação gerado automaticamente (`gerarNumeroDocumentoQtdeEmpregado.ts`, formato `C-XXX`, sequencial por Proposta).
- Lista de Empregados vira árvore agrupada por Cargo (`EmpregadosPorCargoArvore`), expandir/recolher, em vez de lista plana.

### Critérios de Aceite

**Cenário 1 — Cadastrar Cargo com rateio percentual entre Unidades Funcionais**
```gherkin
Dado que existem 2 Unidades Funcionais Analíticas na Proposta
Quando o usuário cadastra um Cargo com rateio 60%/40% entre elas (CargoAlocacaoPercentual, ADR-026)
Então o sistema exige que a soma dos percentuais seja exatamente 100%
E persiste o Cargo com as 2 alocações
```

**Cenário 2 — Salvar dados do Cargo mesmo se Benefícios falhar**
```gherkin
Dado que o usuário preenche dados válidos do Cargo e dados inválidos de Benefícios
Quando ele aciona "Salvar" na tela
Então o Cargo é salvo (CadastrarCargoUseCase)
E o erro de Benefícios é reportado separadamente, sem desfazer o Cargo já salvo
```

**Cenário 3 — Lançar Qtde. Empregado em lote (US-108b)**
```gherkin
Dado que o usuário quer cadastrar 11 vagas do mesmo Cargo
Quando ele lança a quantidade em lote em vez de 11 cadastros individuais
Então o sistema cria 11 EmpregadoHeadcount de uma vez, cada um com seu próprio período possivelmente distinto
E a consolidação de Qtde. Empregado (US-113b) soma o valor total considerando o overlap de cada período com a vigência da Proposta
```

**Cenário 4 — Número do Documento gerado automaticamente**
```gherkin
Dado que o usuário está criando um novo documento de consolidação de Qtde. Empregado
Quando ele salva sem digitar Número do Documento
Então o sistema gera automaticamente o próximo "C-XXX" sequencial dentro da Proposta
E garante unicidade via @@unique([tenantId, propostaId, numeroDocumento]), com retry em colisão
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Cargo`, `CargoAlocacaoPercentual`, `EmpregadoHeadcount`, `QtdeEmpregado` (sem mudança de schema nesta US, exceto os campos de US-108b/113b abaixo) |
| Migrations aplicadas | `add_empregados_lote_cadastrado_enum`, `add_qtde_empregado_valor_total_consolidado`, `add_qtde_empregado_numero_documento_unique` |
| Server Action nova | `salvarCargoCompleto` (orquestra 2 use cases, contrato de erro parcial) |
| Funções puras novas | `gerarNumeroDocumentoQtdeEmpregado.ts`, `calcularValorTotalConsolidado.ts` |
| Auditoria | `HistoricoOperacao` cobre criação de Cargo, Benefícios, lote de Empregados e consolidação |

### Dependências

- US-107, US-107a, US-108, US-108a, US-112, US-113 (todo o backend de RH já implementado sem UI)
- US-116 (mesma rota, sub-aba irmã)

### Definition of Done

- [x] Tela de Cargos com rateio percentual e benefícios no ar
- [x] US-108b (lote de Empregados) e US-113b (consolidação com overlap) implementadas na mesma sessão
- [x] Número do Documento gerado automaticamente com unicidade garantida
- [x] Árvore de Empregados agrupada por Cargo
- [x] Testado manualmente pelo usuário no navegador (3 rodadas de feedback real, todas corrigidas)
- [x] 239 testes passando ao final da sessão, `tsc --noEmit` limpo
