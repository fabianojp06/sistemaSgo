## [US-137] — Catálogo Salarial CTCEA (Grade Rubi Persistida)

**Módulo:** Cadastros — Plano de Contas / Cargos e Salários (integração externa)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M

**Como** Usuário GRH,
**Quero** que a Grade Salarial usada na importação do Rubi venha de um catálogo real carregado por
sincronização (mesmo padrão do Plano de Contas Único, US-001), em vez de valores gerados por hash
na hora da busca,
**Para** que os dados de Faixa/Nível/Salário mostrados ao importar um Cargo reflitam a tabela salarial
real da CTCEA (Organização Brasileira para o Desenvolvimento Científico e Técnico do Controle do
Espaço Aéreo), auditável e rastreável como qualquer outra fonte externa do sistema.

### Contexto e Regras de Negócio

**Substitui o desenho anterior:** US-132/ADR-045 (2026-08-14, implementada e em produção)
modelaram a importação do Rubi como uma busca ao vivo, com candidatos gerados por hash
determinístico a partir do termo digitado (`CargoRubiFixtureProvider.buscarCargosPorTermo`). O
usuário pediu, no mesmo dia, que esse fluxo passasse a funcionar **exatamente como o Plano de
Contas** (US-001): um catálogo carregado de um arquivo fixo via botão "Sincronizar", não mais
gerado na hora.

**Fonte de dados:** relatório real "Tabela de Salários" da CTCEA, estrutura Classe (F1-F7) × Nível
(N1-N20/N22, variável por classe) → Salário. Transcrito de 2 fotos fornecidas pelo usuário
(2026-08-14); 2 valores anômalos da Classe F1 (N21=R$9,10, N22=R$8,91 — destoavam da progressão de
N19/N20) foram descartados por decisão do usuário — Classe F1 vai até N20, mesmo teto das demais
classes já confirmadas (F2/F3/F4/F5 também vão até N20; F6/F7 confirmados até N20 nas fotos
recebidas).

**Mapeamento de campos:**
- Classe do relatório (F1-F7) → campo `faixa` do catálogo.
- Nível do relatório (N1-N20) → campo `nivel`.
- Salário do relatório → campo `salario`.
- **`cargoMercado` e `cargoCtcea` (nomes de cargo) NÃO estão neste relatório** — o documento só tem
  Classe/Nível/Salário, sem nenhum nome de cargo associado. Ficam **nullable**, populados só quando
  o usuário fornecer uma 2ª fonte relacionando Classe/Nível a nomes de cargo (fora de escopo desta
  US). Até lá, o catálogo é uma grade "muda" — só números, sem identificação de cargo.

**Nome do campo "Cargo CTCEA":** não é um cargo específico — é o identificador da fonte/classificação
de origem do dado (a sigla da organização cujo relatório alimenta o catálogo), paralelo conceitual a
"Cargo de Mercado" (que viria de outra fonte/pesquisa). Os dois nomes de cargo compartilham a mesma
grade Faixa/Nível/Salário, mas são rotulados de forma diferente conforme a fonte.

### Critérios de Aceite

**Cenário 1 — Sincronização inicial carrega a grade completa**
```gherkin
Dado que o catálogo de Grade Salarial CTCEA está vazio
Quando o usuário administrador clica em "Sincronizar" na tela correspondente
Então o sistema carrega todas as combinações Faixa (F1-F7) × Nível × Salário do arquivo fixo embutido
E cargoMercado e cargoCtcea ficam null em todas as linhas (2ª fonte ainda não fornecida)
E um registro de auditoria é gravado (mesmo padrão de SYNC_PLANO_CONTAS)
```

**Cenário 2 — Nova sincronização atualiza sem duplicar**
```gherkin
Dado que a Grade Salarial já foi sincronizada uma vez
Quando o usuário sincroniza novamente (ex: arquivo fonte foi atualizado com novos valores de salário)
Então as linhas existentes (mesma Faixa+Nível) são atualizadas via upsert, não duplicadas
E cargoMercado/cargoCtcea preenchidos manualmente (se já houver 2ª fonte carregada) são preservados,
  mesmo padrão do Cenário 2 da US-001 (preservar parametrização local ao reimportar dado externo)
```

**Cenário 3 — Importar Cargo busca no catálogo, não gera mais por hash**
```gherkin
Dado que a Grade Salarial CTCEA está sincronizada
Quando o usuário abre "Importar do Rubi" no Cargo e busca por Faixa/Nível (ou termo, se cargoMercado/
  cargoCtcea já estiverem preenchidos)
Então o sistema retorna candidatos vindos do catálogo persistido (não mais gerados por hash)
E ao escolher um candidato, os campos são preenchidos como já definido em US-132/ADR-045
  (nomeCargoMercado, tabSalCodigo/Descricao, faixaCodigo/Descricao, nivelCodigo/Descricao, salarioReal)
```

**Cenário 4 — Busca sem cargoMercado/cargoCtcea preenchidos**
```gherkin
Dado que o catálogo tem linhas com cargoMercado/cargoCtcea ainda null (2ª fonte não chegou)
Quando o usuário busca por Faixa/Nível diretamente (não por nome de cargo, que ainda não existe)
Então o sistema retorna os candidatos daquela Faixa/Nível, com nomeCargoMercado vazio/placeholder
  até a 2ª fonte ser carregada
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabela nova | `GradeSalarialCtcea` (ou nome equivalente definido pelo Tech Lead): `tenantId`, `faixa` (F1-F7), `nivel` (N1-N20), `salario` (Decimal 15,2), `cargoMercado` (String?), `cargoCtcea` (String?), `syncedAt`. Unique em `(tenantId, faixa, nivel)`. |
| Provider/Loader | Mesmo padrão de `PlanoContasArquivoProvider`/`PlanoContasBulkLoader` (US-001) — arquivo fixo embutido (`.ts` com os dados transcritos), upsert em lote. **Decisão do Tech Lead:** reaproveitar exatamente esse padrão ou desenhar um loader próprio (aqui não há hierarquia pai/filho como no Plano de Contas). |
| `ImportarCargoRubiUseCase`/`CargoRubiFixtureProvider` | Busca passa a consultar `GradeSalarialCtcea` em vez de gerar por hash. **Decisão do Tech Lead:** migrar 100% agora (remover o fixture-hash) ou manter os dois convivendo até a 2ª fonte (nomes de cargo) chegar. |
| Migration | Nova tabela, aditiva, sem impacto em dado existente de Cargo. |
| Auditoria | Reaproveitar `SYNC_PLANO_CONTAS` como modelo — novo tipo de evento (ex: `SYNC_GRADE_SALARIAL_CTCEA`) para o `HistoricoOperacao`. |

### Dependências

- **ADR do Tech Lead** — bloqueante: nome exato da tabela, decisão de migração 100% vs. convivência
  temporária com o fixture-hash, e se reaproveita o loader do Plano de Contas ou não.
- **2ª fonte de dados (nomes de cargo por Faixa/Nível)** — não bloqueia esta US (catálogo nasce com
  `cargoMercado`/`cargoCtcea` null), mas é pré-requisito para o catálogo ficar "completo" no sentido
  de já ter nomes de cargo pesquisáveis.

### Definition of Done

- [ ] ADR do Tech Lead resolvendo as 2 decisões em aberto
- [ ] Critérios de aceite 1 a 4 implementados
- [ ] Grade Salarial CTCEA sincronizada em produção com os dados reais transcritos (Classe F1-F7 ×
      Nível N1-N20 → Salário, F1 sem N21/N22)
- [ ] Reimportação testada — atualiza sem duplicar, preserva customização já feita
- [ ] Fluxo "Importar do Rubi" no Cargo buscando no catálogo, não mais gerando por hash (ou
      convivendo com o fixture, conforme decisão do Tech Lead)
