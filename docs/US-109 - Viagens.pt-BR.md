## [US-109] — Manter Viagens

**Módulo:** Cadastros — Viagens (UC03.29-33 da Minuta V5)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M
**Nota de proveniência:** documento reconstruído retroativamente em 2026-08-13 — a US foi implementada em 2026-08-04 (commit `5ee2def`) e corrigida em 2026-08-07 (commit `16a7c2b`), mas nunca ganhou arquivo próprio em `docs/`. Reconstruído a partir de `prisma/schema.prisma` (`model Viagem`), dos use cases e de `CONTEXTO_SESSOES.md`.

**Como** Usuário Comum (GFIN),
**Quero** cadastrar, alterar e excluir Viagens vinculadas a uma Proposta (e, quando a Proposta for Por Meta, a uma Meta), com o Custo Estimado sempre calculado a partir de 3 componentes,
**Para** que o custo de viagens (passagem, diária, transporte) componha o Valor Orçado da conta analítica com auditabilidade completa.

### Contexto e Regras de Negócio

Mesmo padrão de lançamento por conta analítica já validado em US-007/US-101/US-110 (ADR-022). Cada Viagem tem 3 componentes de custo, cada um com sua própria conta analítica — sem única "conta da Viagem":

| Componente | Fórmula | Conta |
|---|---|---|
| Passagem | Qtd. Pessoas × Custo Unitário Passagem | `contaPassagemId` |
| Diária | Qtd. Pessoas × Média de Dias × Custo Unitário Diária | `contaDiariaId` |
| Transporte | Qtd. Pessoas × Custo Unitário Transporte | `contaTransporteId` |

`Custo Estimado` = soma dos 3 componentes — **sempre calculado no servidor** (`calcularCustoEstimadoViagem`), nunca aceito como input direto [ORIGEM BLINDADA]. As 3 contas devem ser analíticas (`isAnalitica=true`, RN_PLA_003).

**Correção de escopo (2026-08-07, commit `16a7c2b`):** na primeira versão, Viagem era exclusiva de Proposta `POR_META` (exigia Meta sempre). Usuário testou lançar uma Viagem numa Proposta `CONSOLIDADA` e recebeu bloqueio indevido — a regra de negócio foi corrigida: Viagem existe em **ambas** as categorias, com `metaId` opcional (obrigatório só quando `Proposta.categoria=POR_META`), mesmo padrão de `ItemPatrimonial` (US-110/ADR-023). Confirmado 0 registros de `Viagem` em produção no momento da correção — migration segura, sem backfill.

Exclusão sempre soft delete (`ativo` boolean), sem lock pessimista — mesma simplicidade transacional de `Cargo`/`Meta`, sem concorrência crítica identificada.

### Critérios de Aceite

**Cenário 1 — Cadastrar Viagem em Proposta CONSOLIDADA (sem Meta)**
```gherkin
Dado que a Proposta "PROP-2026-0001" está com Versão em RASCUNHO ou EM_ELABORACAO e categoria = CONSOLIDADA
E as 3 Contas Analíticas de Passagem/Diária/Transporte existem (isAnalitica=true)
Quando o usuário cadastra uma Viagem com:
  | Descrição              | Missão técnica em Brasília |
  | Quantidade de Pessoas  | 2                            |
  | Média de Dias          | 3                            |
  | Custo Unit. Passagem   | 1200.00                      |
  | Custo Unit. Diária     | 350.00                       |
  | Custo Unit. Transporte | 150.00                       |
Então o sistema calcula:
  | Passagem   | 2 × 1200.00 = 2400.00              |
  | Diária     | 2 × 3 × 350.00 = 2100.00           |
  | Transporte | 2 × 150.00 = 300.00                |
  | Custo Estimado | 2400.00 + 2100.00 + 300.00 = 4800.00 |
E persiste a Viagem com metaId = null
E um registro de auditoria `VIAGEM_CRIADA` é gravado em HistoricoOperacao
```

**Cenário 2 — Cadastrar Viagem em Proposta POR_META (Meta obrigatória)**
```gherkin
Dado que a Proposta "PROP-2026-0002" está em POR_META e não tem Meta ativa cadastrada na Versão
Quando o usuário tenta cadastrar uma Viagem
Então o sistema bloqueia o salvamento
E exibe a mensagem "Meta não encontrada."
```

**Cenário 3 — Custo Estimado é sempre calculado, nunca aceito como input**
```gherkin
Dado que o usuário está cadastrando uma Viagem com os campos de custo válidos
Quando ele tenta submeter um custoEstimado diferente do calculado pela fórmula
Então o sistema ignora o valor recebido para esse campo
E persiste o custoEstimado calculado no servidor [ORIGEM BLINDADA]
```

**Cenário 4 — Bloqueio: campos obrigatórios em branco ou contas não analíticas**
```gherkin
Dado que o usuário está cadastrando uma Viagem sem Descrição, ou com Qtd. Pessoas <= 0, ou com uma das 3 contas apontando para uma Conta Sintética
Quando ele tenta salvar
Então o sistema bloqueia e exibe a mensagem correspondente (CamposObrigatoriosViagemError ou ContaViagemNaoAnaliticaError)
```

**Cenário 5 — Versão homologada é imutável**
```gherkin
Dado que a VersaoProposta associada não está mais em RASCUNHO nem EM_ELABORACAO
Quando o usuário tenta cadastrar, editar ou excluir uma Viagem
Então o sistema bloqueia com "Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida."
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Viagem` |
| Campos calculados | `custoEstimado` (soma dos 3 componentes) — nunca input direto |
| Transação? | Sim — create/update + `HistoricoOperacao` na mesma `$transaction` |
| Requer lock? | Não — sem concorrência crítica identificada, mesmo padrão de Cargo/Meta |
| Auditoria | `HistoricoOperacao`: `VIAGEM_CRIADA`, com `viagemId`/`versaoId`/`custoEstimado` serializados |
| Regra de negócio | `calcularComponentesCustoViagem`/`calcularCustoEstimadoViagem` (`src/domain/plano-contas/calcularCustoEstimadoViagem.ts`) são a única fonte de verdade da matemática — reaproveitadas pelo dashboard de insights (ADR-036) |

### Dependências

- US-007/US-101 (padrão de conta analítica), ADR-023 (padrão de `metaId` opcional)

### Definition of Done

- [x] Critérios de aceite implementados (`CadastrarViagemUseCase`, `EditarViagemUseCase`, `ExcluirViagemUseCase`)
- [x] Custo Estimado sempre calculado no servidor, nunca aceito como input
- [x] Log de auditoria gravado em `HistoricoOperacao`
- [x] Testado com Proposta CONSOLIDADA e POR_META (correção de escopo 2026-08-07)
- [x] Testado com contas não analíticas (deve bloquear)
- [ ] Teste de UI em navegador real (ambiente de desenvolvimento sem `.env` de Clerk/Supabase neste Codespace — validação de UI ficou por conta do usuário)
