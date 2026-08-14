## ADR-046: Catálogo Salarial CTCEA Persistido (substitui fixture-hash do Rubi)

**Status**: Aceito
**Data**: 2026-08-14
**Módulo SGO**: Cadastros — Plano de Contas / Cargos e Salários (US-137)

**Contexto**: a US-132/ADR-045 (mesmo dia, horas antes) modelou a importação do Rubi como busca ao
vivo — `CargoRubiFixtureProvider.buscarCargosPorTermo(termo)` gera 1-3 candidatos por hash
determinístico do termo digitado, sem nenhuma tabela própria. O usuário pediu para trocar esse
desenho pelo mesmo padrão já usado no Plano de Contas Único (US-001): um catálogo real, carregado de
um arquivo fixo embutido via botão "Sincronizar", auditável como qualquer sincronismo de fonte
externa. A fonte agora é um relatório real (Tabela de Salários da CTCEA — Classe × Nível → Salário),
não mais um gerador sintético.

Diferença estrutural chave em relação ao Plano de Contas: `ContaContabil` é uma **árvore**
(hierarquia pai/filho, `idPai` auto-referenciado, PlanoContasBulkLoader resolve isso em 2 passes). A
Grade Salarial CTCEA é **plana** — cada linha é independente, chave é só `(faixa, nivel)`. Isso
simplifica o loader: não precisa resolver hierarquia, um único upsert em lote resolve tudo.

Segunda diferença real: o relatório fonte **não tem nomes de cargo**, só a grade numérica
(Faixa/Nível/Salário). O fluxo de busca da US-132 original assumia que buscar por termo textual (ex.
"Analista de Sistemas") sempre fazia sentido — isso deixa de ser verdade até uma 2ª fonte (mapeamento
Classe/Nível → nome de cargo) ser fornecida. A busca por termo continua útil no futuro, mas não pode
ser a única via de busca enquanto os nomes não existem.

### Opções Consideradas

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| **A — Migrar 100% agora, remover o fixture-hash** | Uma única fonte de verdade para dados de Rubi; elimina o risco de o time esquecer qual dos dois caminhos está ativo; combina com a intenção clara do usuário ("funcionar como o Plano de Contas") | Busca por termo livre (só nome de cargo) fica temporariamente sem sentido até a 2ª fonte chegar — precisa de busca por Faixa/Nível como via principal nesse meio-tempo | Alta — reverter é só reintroduzir o provider antigo, que continua existindo no histórico do git |
| **B — Manter os dois convivendo (flag ou fallback)** | Não perde a capacidade de busca por termo enquanto a 2ª fonte não chega | Duas fontes de dado "Rubi" ativas simultaneamente é confuso — qual candidato é "real" quando os dois provedores respondem diferente para o mesmo termo? Contradiz a intenção clara do usuário de ter *o* catálogo, não *um* catálogo entre outros | Média — código morto do fixture-hash vira dívida técnica se ninguém decidir removê-lo depois |
| **C — Não migrar agora, esperar a 2ª fonte** | Zero risco de regressão na busca por termo | Não atende ao pedido do usuário; adia sem necessidade real (a grade numérica já está pronta e correta) | Alta, mas não resolve o problema agora |

### Decisão

**Adotar Opção A** — migrar 100% agora. `CargoRubiFixtureProvider` é removido; a interface
`CargoRubiProvider` é reimplementada por um novo provider que consulta `GradeSalarialCtcea` via
Prisma (não é mais "fixture" no sentido de gerar dado sintético — é uma consulta real a dado real
sincronizado, mesmo status que `PlanoContasArquivoProvider` tem hoje em relação a `ContaContabil`).

**1. Migração 100% agora.** Resolvido acima.

**2. Loader simplificado, sem hierarquia.** Novo `GradeSalarialCtceaBulkLoader`, mesmo espírito do
`PlanoContasBulkLoader` (upsert em lote via `$executeRaw`, `INSERT ... ON CONFLICT (tenantId, faixa,
nivel) DO UPDATE SET salario = EXCLUDED.salario, syncedAt = now()` — sem tocar `cargoMercado`/
`cargoCtcea` no `DO UPDATE`, preservando parametrização já preenchida manualmente, mesmo padrão do
Cenário 2 da US-001/US-137). Sem 2 passes de resolução de pai — 1 único INSERT em lote resolve tudo,
mais simples que o loader do Plano de Contas.

**3. Schema** — ver Schema Mode abaixo.

**4. Busca por Faixa/Nível como via principal; termo como complemento futuro.** O novo provider
expõe `buscarCandidatos({ faixa?, nivel?, termo? }): Promise<CandidatoCargoRubi[]>` — filtra por
`faixa`/`nivel` quando informados (busca exata, já que são poucos valores discretos, melhor como
`<select>` que como campo livre) e por `termo` via `ILIKE` em `cargoMercado`/`cargoCtcea` quando
informado (não quebra quando esses campos são null — só não retorna nada até a 2ª fonte chegar). A
UI do modal "Importar do Rubi" (já existente, US-132) ganha 2 `<select>` (Faixa F1-F7, Nível N1-N20)
como busca principal, mantendo o campo de termo livre disponível mas secundário — sem alterar
`ImportarCargoRubiUseCase` (a escrita em si, que já recebe um candidato pronto, é agnóstica à origem
do candidato).

**5. Novo evento de auditoria** `SYNC_GRADE_SALARIAL_CTCEA` no enum `TipoOperacao`, mesmo padrão de
`SYNC_PLANO_CONTAS`.

### Consequências

- ✅ Uma única fonte de verdade para dados do Rubi — elimina ambiguidade entre fixture-hash e
  catálogo real.
- ✅ Loader mais simples que o do Plano de Contas (sem hierarquia), baixo risco de implementação.
- ✅ Reimportar preserva `cargoMercado`/`cargoCtcea` já preenchidos manualmente, mesmo se a 2ª fonte
  ainda não tiver chegado quando a sincronização rodar de novo.
- ⚠️ Busca por termo livre fica sem uso prático até a 2ª fonte (nomes de cargo) chegar — mitigado
  com busca por Faixa/Nível como via principal nesse meio-tempo, não é uma lacuna funcional real
  (o usuário sempre sabe pelo menos a Faixa/Nível que procura, vindo do relatório fonte).
- ⚠️ Remoção do `CargoRubiFixtureProvider` é uma mudança de infraestrutura que precisa atualizar
  todos os testes que dependiam do gerador por hash (`CargoRubiFixtureProvider.test.ts` inteiro fica
  obsoleto, substituído por testes do novo provider).

### Revisão Recomendada

Quando a 2ª fonte (nomes de cargo por Faixa/Nível) chegar, revisitar a UX de busca — nesse ponto,
busca por termo (nome do cargo) provavelmente vira a via principal, com Faixa/Nível como filtro
secundário, invertendo a prioridade atual.

---

## Schema Mode

```prisma
model GradeSalarialCtcea {
  id       String @id @default(uuid())
  tenantId String

  // Classe do relatório fonte (F1-F7) — mapeado 1:1 para "Faixa".
  faixa String
  // Nível do relatório fonte (N1-N20, variável por faixa — F1 vai até N20 mesmo tendo
  // N21/N22 no relatório original, valores descartados por inconsistência, US-137).
  nivel String

  salario Decimal @db.Decimal(15, 2)

  // Nullable até a 2ª fonte (mapeamento Classe/Nível → nome de cargo) ser fornecida —
  // grade nasce "muda", só com valores numéricos [US-137].
  cargoMercado String?
  cargoCtcea   String?

  syncedAt DateTime @default(now())

  @@unique([tenantId, faixa, nivel])
  @@index([tenantId])
}
```

**Justificativa dos tipos:** `faixa`/`nivel` como `String` (não enum) — o relatório fonte já usa
strings curtas (`F1`..`F7`, `N1`..`N20`) e um enum exigiria migration toda vez que uma nova
faixa/nível aparecesse numa atualização futura do relatório; `String` com o `@@unique` já garante
integridade suficiente para este catálogo (mesma filosofia de `ContaContabil.codigoErp`, que também
não é enum). `salario` em `Decimal(15,2)`, mesmo padrão de todo valor monetário do projeto.

**Migration:** puramente aditiva (nova tabela), sem impacto em `Cargo` ou em qualquer dado existente.

**Enum `TipoOperacao`:** adicionar `SYNC_GRADE_SALARIAL_CTCEA`.

**Arquivo fixo de dados:** `src/infrastructure/integrations/senior/grade-salarial-ctcea-raw.ts` (ou
pasta própria fora de `senior/`, já que não é dado do ERP Senior — sugestão:
`src/infrastructure/integrations/ctcea/grade-salarial-ctcea-raw.ts`), mesmo padrão de constante
embutida de `plano-contas-raw.ts` — nunca `fs.readFileSync` em runtime, pelo mesmo motivo já
documentado lá (ENOENT em serverless/Vercel).
