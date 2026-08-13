## [US-116] — Tela de Estrutura Funcional (Organograma)

**Módulo:** Cadastros — Estrutura Funcional (UC03.18)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M
**Nota de proveniência:** documento reconstruído retroativamente em 2026-08-13 — implementada em 2026-08-06 (commit `347b7ef`) como parte da sessão "US-116/US-117 (Organograma+Cargos), ADR-028", mas nunca ganhou arquivo próprio em `docs/`. Reconstruído a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-06, 14h18–21h11 UTC).

**Como** Usuário Comum (GFIN),
**Quero** uma tela dedicada para criar e inativar Unidades Funcionais (organograma) dentro de uma Proposta,
**Para** que a estrutura organizacional (US-106, já existente só como use case desde 2026-07-31) finalmente tenha interface de usuário.

### Contexto e Regras de Negócio

US-106 (`UnidadeFuncional`, ADR-015) existia desde 2026-07-31 só como use case + domínio, sem tela — gap conhecido e registrado (ver `us106_estrutura_funcional.md`). Esta US fecha esse gap.

Nova rota `/propostas/{id}/estrutura`, fora do catch-all de guias de US-115 (`/propostas/{id}/[[...guia]]`) — mesmo padrão de ciclo de vida por Proposta já decidido para Cargo/UnidadeFuncional (escopados por Proposta, não por Versão). Sub-aba "Organograma" (`OrganogramaPanel.tsx`): cria/inativa `UnidadeFuncional`, respeitando os 2 níveis fixos de US-106 (Sintético raiz → Analítico).

**Correção de bug encontrada de passagem:** `InativarUnidadeFuncionalUseCase.contarCargosVinculados()` sempre retornava `0` com um comentário "trocar quando Cargo existir" — `Cargo` já existia desde US-107, então a checagem RN_EST_04 (bloquear inativação com cargo vinculado) nunca funcionava de verdade. Corrigido para consultar `CargoAlocacaoPercentual` de fato, na mesma entrega.

Nova `Funcionalidade` CONTEXTUAL `propostas.gerenciar-estrutura` (ADR-021 — decisão explícita de não virar item de menu próprio, vive dentro da tela de Proposta).

### Critérios de Aceite

**Cenário 1 — Criar Unidade Funcional Sintética (raiz)**
```gherkin
Dado que o usuário está na tela "Estrutura" de uma Proposta com Versão em RASCUNHO ou EM_ELABORACAO
Quando ele cadastra uma Unidade Funcional do tipo SINTETICO_DIRETORIA
Então a unidade é criada como raiz da árvore
E aparece no Organograma sem pai
```

**Cenário 2 — Criar Unidade Funcional Analítica vinculada a uma Sintética**
```gherkin
Dado que existe uma Unidade SINTETICO_GERENCIA
Quando o usuário cadastra uma Unidade ANALITICO_COORDENADORIA vinculada a ela
Então a unidade é criada com o pai correto
E aparece como filha na árvore do Organograma
```

**Cenário 3 — Bloqueio: inativar Unidade com Cargo vinculado**
```gherkin
Dado que uma Unidade Funcional Analítica tem ao menos 1 Cargo com CargoAlocacaoPercentual ativa
Quando o usuário tenta inativar essa Unidade
Então o sistema bloqueia com InativacaoUnidadeFuncionalBloqueadaError
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `UnidadeFuncional` (sem mudança de schema — só UI sobre use cases já existentes de US-106) |
| Componentes novos | `src/app/propostas/[id]/estrutura/page.tsx`, `OrganogramaPanel.tsx` |
| Bug corrigido de passagem | `InativarUnidadeFuncionalUseCase.contarCargosVinculados()` — deixou de sempre retornar 0 |
| Funcionalidade nova | `propostas.gerenciar-estrutura` (CONTEXTUAL, ADR-021) |

### Dependências

- US-106 (Estrutura Funcional, backend)
- US-117 (Tela de Cargos, mesma rota `/propostas/{id}/estrutura`, sub-aba irmã)

### Definition of Done

- [x] Sub-aba Organograma implementada e no ar
- [x] Bug de `contarCargosVinculados` corrigido
- [x] `Funcionalidade` CONTEXTUAL seedada e aplicada em produção
- [ ] Teste de UI em navegador real dedicado (validado indiretamente pelas 3 rodadas de feedback de teste manual da sessão de RH, focadas em Empregados/Cargos, não no Organograma isoladamente)
