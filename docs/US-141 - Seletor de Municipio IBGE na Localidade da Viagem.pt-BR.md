# US-141 — Seletor de Município (IBGE) na Localidade da Viagem

**Módulo:** Cadastros / Propostas — Guia Viagens
**Épico:** EP118-24 — Módulo de Cadastros
**Prioridade:** Média
**Estimativa:** M (~1,5 a 2 dias)
**Status:** 🔜 Próximo da Fila — depende do ADR-048 formalizado pelo `techlead-fsg` antes da implementação
**Origem:** pedido do usuário em 2026-09-02, decorrente da US-109 (UC03.29-33)

**Como** analista da Gerência Financeira (GFIN) da CTCEA cadastrando as viagens de uma Proposta,
**Quero** selecionar o município de destino de uma lista padronizada (todos os municípios do
Brasil), em vez de digitar o local em texto livre,
**Para** que os destinos das viagens fiquem consistentes e agrupáveis (relatórios por destino,
comparação de custo médio por cidade, e a base para uma futura visualização geográfica).

---

## Contexto e regras de negócio

### Situação atual

Hoje `Viagem.descricao` é um campo de **texto livre** (string, máx. 100, obrigatório), exibido
na UI com o rótulo **"LOCALIDADE (PAÍS)"**. Não há padronização: um usuário escreve "Brasília",
outro "Brasília/DF", outro "Missão Brasília — capacitação". Isso impede qualquer agregação
confiável por destino e é a raiz do bloqueio de qualidade de dado.

### O que muda

Introduz-se um campo **estruturado** de município, baseado no código do IBGE (7 dígitos), a
partir de um catálogo embutido de todos os 5.570 municípios brasileiros. O texto livre
**não desaparece** — muda de papel.

| Campo | Antes | Depois | Obrigatório? |
|---|---|---|---|
| Município (novo, estruturado) | não existe | `Viagem.municipioIbge` (código IBGE) + snapshot `municipioNome`, `uf` | **Sim, no cadastro de nova Viagem** |
| Texto livre (`Viagem.descricao`) | "LOCALIDADE (PAÍS)" — obrigatório | **"Motivo / complemento da viagem"** — passa a ser **opcional** | Não |

Rótulos novos na tela:
- Campo de município: **"MUNICÍPIO (BRASIL)"**
- Campo de texto: **"MOTIVO / COMPLEMENTO DA VIAGEM"** (opcional)
- O rótulo **"LOCALIDADE (PAÍS)"** deixa de existir.

### Regra da fonte de verdade

- O **cliente envia apenas o código IBGE** selecionado. O servidor resolve
  `municipioNome`, `uf`, `latitude` e `longitude` a partir do catálogo embutido — nunca confia
  em nome/UF/coordenadas vindos do cliente.
- `municipioNome` e `uf` são gravados como **snapshot congelado** na Viagem (mesmo padrão de
  Cargo/Empregado no projeto): a lista de viagens e os relatórios exibem o nome sem depender do
  arquivo de catálogo em runtime.
- `latitude` / `longitude` do município também são gravados. **Não há exibição de mapa nesta
  US** — as coordenadas ficam persistidas para destravar, sem geocoding, uma futura US de
  visualização geográfica (ver ADR-048 / "Fora de escopo").

### Catálogo de municípios

- Fonte: <https://github.com/kelvins/municipios-brasileiros> (licença **MIT**, 5.570 municípios;
  campos: código IBGE, nome, latitude, longitude, capital, código UF, SIAFI, DDD, fuso horário).
- Embutido no código como **módulo TS estático**, gerado a partir de um **commit fixo** daquele
  repositório (mesmo padrão do `cargo-mercado-raw.ts` já existente no projeto).
- **Sem botão de "Sincronizar", sem job.** Municípios brasileiros praticamente não mudam
  (moratória constitucional de criação desde 2013). Atualização futura do catálogo, se
  necessária, é uma troca manual do arquivo em nova versão do código.
- O aviso de licença MIT + atribuição fica no diretório do dado.
- O catálogo é **dado de referência global** (não por tenant), somente leitura.

### O que NÃO muda

- `src/domain/plano-contas/calcularCustoEstimadoViagem.ts` (**[ORIGEM BLINDADA]**) — o Custo
  Estimado da Viagem continua = Passagem + Diária + Transporte. Nem `municipioIbge` nem
  `descricao` entram em cálculo de custo.
- Regras da US-109: Viagem exclusiva de Proposta `POR_META` (Meta exigida); vínculos
  Proposta/Versão/Meta congelados na edição; edição bloqueada se a Versão não está
  `RASCUNHO`/`EM_ELABORACAO`. **O município É editável** (é atributo descritivo, não vínculo).
- Nenhuma permissão nova — usa as permissões já existentes de cadastrar/editar Viagem.

---

## Critérios de Aceite

**Cenário 1 — Cadastrar Viagem com município selecionado**
```gherkin
Dado que a Proposta está POR_META, em RASCUNHO ou EM_ELABORACAO, com Meta cadastrada
E o usuário tem permissão para gerenciar Viagens
Quando o usuário abre "Nova Viagem", digita "brasil" no campo MUNICÍPIO (BRASIL)
E a lista mostra no máximo 20 resultados (ex.: "Brasília — DF", "Brasil Novo — PA", "Brasilândia — MS", ...)
E o usuário seleciona "Brasília — DF"
E preenche Quantidade de Pessoas, Médias de Dias e os custos/contas de passagem, diária e transporte
E o campo MOTIVO / COMPLEMENTO DA VIAGEM fica vazio
Quando o usuário clica em "Cadastrar"
Então a Viagem é criada com municipioIbge = "5300108", municipioNome = "Brasília", uf = "DF"
E latitude e longitude de Brasília são gravadas a partir do catálogo
E descricao é gravada vazia (campo opcional)
E o Custo Estimado é calculado normalmente (Passagem + Diária + Transporte), sem influência do município
E a Viagem aparece na lista como "Brasília — DF"
```

**Cenário 2 — Município é obrigatório no cadastro de nova Viagem**
```gherkin
Dado que o usuário está preenchendo "Nova Viagem"
E não selecionou nenhum município
Quando clica em "Cadastrar"
Então o sistema exibe "Selecione o município de destino da viagem."
E nenhuma Viagem é criada
```

**Cenário 3 — Editar Viagem trocando o município**
```gherkin
Dado que existe a Viagem "Brasília — DF" numa Versão em EM_ELABORACAO
Quando o usuário clica em "Editar", digita "curitiba" e seleciona "Curitiba — PR"
E clica em "Salvar alterações"
Então a Viagem passa a ter municipioIbge = "4106902", municipioNome = "Curitiba", uf = "PR"
E latitude/longitude são regravadas com as de Curitiba
E os vínculos com Proposta / Versão / Meta permanecem inalterados
E o Custo Estimado é recalculado apenas em função dos quantitativos/custos (não do município)
E o histórico de operação registra a troca de município (de "Brasília/DF" para "Curitiba/PR")
```

**Cenário 4 — Editar Viagem em Versão homologada é bloqueado (regra herdada da US-109)**
```gherkin
Dado que a Viagem pertence a uma Versão OFICIALIZADA / homologada
Quando o usuário tenta editar o município
Então o sistema exibe "Manutenção Rejeitada: este snapshot está homologado e tornou-se permanentemente imutável por ciclo de vida."
E o município não é alterado
```

**Cenário 5 — Viagem legada sem município**
```gherkin
Dado que existe uma Viagem cadastrada antes desta US, com municipioIbge nulo e descricao = "Missão Recife 2025"
Quando o usuário abre a guia Viagens
Então a Viagem aparece na lista como "— (sem município)" seguido do texto "Missão Recife 2025"
E ao clicar em "Editar", o campo MUNICÍPIO (BRASIL) aparece vazio
E o sistema exibe o aviso "Esta viagem foi cadastrada sem município. Selecione um para padronizar."
E o usuário PODE salvar a edição sem selecionar município (não bloqueia correção de dado legado)
E se o usuário selecionar um município, o snapshot nome/uf/coordenadas é gravado normalmente
```

**Cenário 6 — Busca no combobox é acento- e caixa-insensível**
```gherkin
Dado que o usuário está no campo MUNICÍPIO (BRASIL)
Quando digita "sao paulo"
Então a lista inclui "São Paulo — SP" e também homônimos de outras UFs (ex.: "São Paulo do Potengi — RN")
E cada item mostra o nome do município seguido da UF, para desambiguar homônimos
Quando digita menos de 2 caracteres
Então nenhuma busca é feita e a lista fica vazia
```

**Cenário 7 — Código IBGE inexistente (defesa server-side)**
```gherkin
Dado que uma requisição de cadastro/edição de Viagem chega com municipioIbge = "9999999" (não existe no catálogo)
Quando o servidor processa a requisição
Então a operação é rejeitada com "Município não encontrado no catálogo."
E nenhuma Viagem é criada ou alterada
```

**Cenário 8 — Nova Versão da Proposta copia o município da Viagem**
```gherkin
Dado que a Versão 1 tem a Viagem "Curitiba — PR" (com coordenadas)
Quando o usuário cria a Versão 2 (CriarVersaoPropostaUseCase / duplicação)
Então a Viagem copiada na Versão 2 mantém municipioIbge = "4106902", municipioNome = "Curitiba", uf = "PR", latitude e longitude
```

---

## Regras de borda confirmadas

| Situação | Comportamento |
|---|---|
| Código IBGE não existe no catálogo | Server Action rejeita: "Município não encontrado no catálogo." Nada é gravado. |
| Cliente envia nome/UF/coordenadas divergentes do catálogo | Servidor **ignora** o que veio do cliente e grava a partir do catálogo (o cliente só deveria mandar o código). |
| Snapshot `municipioNome`/`uf` na Viagem diverge do catálogo depois | Não ocorre na prática — o catálogo é estático/pinado. Se um dia o catálogo for atualizado e um nome mudar, a Viagem **mantém o snapshot do momento do cadastro** (comportamento correto e auditável). |
| Viagem legada (`municipioIbge` nulo) | Exibida como "— (sem município)" + texto livre. Editável sem exigir município. |
| `descricao` vazia | Permitido (campo passou a ser opcional). |

---

## Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| **Migração de schema** | `Viagem`: `+ municipioIbge String?`, `+ municipioNome String?`, `+ uf String?`, `+ latitude Decimal? @db.Decimal(10,7)`, `+ longitude Decimal? @db.Decimal(10,7)` (tipo exato — `Decimal` vs `Float` — a decidir no ADR-048; o projeto tem cultura de evitar `Float`). Migration **aditiva**, todas nullable, **sem backfill**. Escrita à mão e aplicada via SQL Editor do Supabase (ambiente sem `.env`). |
| Catálogo | Novo módulo estático `src/infrastructure/integrations/municipios-br/municipios-brasileiros-raw.ts` (ou similar), gerado do CSV/JSON do repo `kelvins/municipios-brasileiros` num commit fixo. + `LICENSE`/atribuição MIT. Provedor de leitura (`MunicipioBrasileiroCatalogo`) para o servidor resolver código → nome/uf/lat/long. |
| `CadastrarViagemUseCase` | Recebe `municipioIbge` (obrigatório). Valida contra o catálogo. Resolve e grava `municipioNome`/`uf`/`latitude`/`longitude`. `descricao` passa a ser opcional (ajustar validação). |
| `EditarViagemUseCase` | Recebe `municipioIbge` (opcional na edição, para não travar viagem legada). Mesma validação/resolução. Inclui a troca de município no `HistoricoOperacao` (`dadosSerializados`). Mantém todas as regras herdadas (status da Versão, congelamento de vínculos, optimistic locking). |
| `CriarVersaoPropostaUseCase` | **Obrigatório** propagar os 5 campos novos no `tx.viagem.createMany` que copia Viagens para a nova Versão (`src/application/use-cases/plano-contas/CriarVersaoPropostaUseCase.ts`, bloco `viagensOrigem`). Sem isso, o município se perde ao criar nova Versão / duplicar. |
| Server Actions | `cadastrarViagem` / `editarViagem` (`plano-contas/actions.ts`): novo campo `municipioIbge` no input e no schema Zod; `descricao` deixa de ser `.min(1)`. |
| `ViagemResultado` (tipo) | `+ municipioIbge: string \| null`, `+ municipioNome: string \| null`, `+ uf: string \| null`, `+ latitude: string \| null`, `+ longitude: string \| null`. |
| `page.tsx` (guia viagens) | `select` da query `prisma.viagem.findMany` inclui as colunas novas; mapeamento para `ViagemResultado`. |
| `ViagemPanel.tsx` | Campo combobox de município no `ViagemForm` (busca client-side, acento-insensível, teto 20, exibe "Nome — UF"). Lista exibe "Nome — UF" ou "— (sem município)". Aviso para viagem legada. Os 5.570 registros vão para o cliente via `import` dinâmico (lazy-load na guia). Rótulos: "MUNICÍPIO (BRASIL)" e "MOTIVO / COMPLEMENTO DA VIAGEM". |
| Transação? | Não é operação de saldo. As gravações já ocorrem dentro do `$transaction` existente dos use cases de Viagem. |
| Requer lock? | Não além do optimistic locking já existente na edição. |
| Auditoria | `HistoricoOperacao` já é gravado por Cadastrar/Editar Viagem; incluir código+nome do município no payload. |
| Multi-tenant | Catálogo é global (sem `tenantId`), read-only, embutido. `Viagem` continua com `tenantId` em todo `where`. Nenhuma query nova cruza tenant. |
| Como é desfeito | Editar a Viagem e trocar/limpar o município (dentro das regras de status da Versão). Sem estorno formal — não é lançamento financeiro. |

---

## Dependências

- **ADR-048** (`techlead-fsg`) — decisão formal de: tipo das colunas de coordenada
  (`Decimal(10,7)` vs `Float`), obrigatoriedade de `municipioIbge` no cadastro, nome/local do
  módulo de catálogo, estratégia da migration. **Bloqueia o início da implementação.**
- US-109 — Viagens (base; já entregue).
- Catálogo `municipios-brasileiros-raw.ts` a ser gerado e commitado.
- Fluxo Git: migration + mudança de contrato de use case → **branch + PR + `/code-review`**.

---

## Fora de escopo (não implementar nesta US)

- Exibição de mapa (SVG ou tiles). As coordenadas ficam persistidas para uma US futura.
- Viagem internacional / seleção de país (`paisIso`). O modelo não trava isso: quando surgir,
  adiciona-se `paisIso` e `municipioIbge` fica como detalhe do caso Brasil.
- Backfill do `municipioIbge` das viagens legadas (heurística texto → código). Legado fica nulo;
  o usuário atribui manualmente ao editar.
- Tornar `municipioIbge` obrigatório também na **edição** de viagem legada (avaliar em US futura
  quando a base estiver madura).

---

## Definition of Done

- [ ] Migration aditiva aplicada (5 colunas nullable em `Viagem`), sem impacto em dados existentes
- [ ] Catálogo de 5.570 municípios embutido, com licença MIT/atribuição no repositório
- [ ] Cadastro de nova Viagem exige município; `descricao` passa a ser opcional
- [ ] Edição permite trocar o município; viagem legada pode ser salva sem município (com aviso)
- [ ] Servidor resolve nome/UF/coordenadas do catálogo — ignora esses valores vindos do cliente
- [ ] Código IBGE inexistente é rejeitado server-side com a mensagem especificada
- [ ] `CriarVersaoPropostaUseCase` propaga os 5 campos novos ao copiar Viagens (teste de regressão)
- [ ] Busca do combobox é acento- e caixa-insensível, com teto de 20 resultados, exibindo a UF
- [ ] `HistoricoOperacao` registra a troca de município na edição
- [ ] `calcularCustoEstimadoViagem` e o Custo Estimado persistido permanecem inalterados (teste de regressão)
- [ ] Isolamento multi-tenant preservado (catálogo global; `Viagem` sempre por `tenantId`)
- [ ] Critérios de aceite validados em homologação
