## ADR-045: Fluxo de Importação Explícita do Cargo via Rubi (Fixture)

**Status**: Aceito
**Data**: 2026-08-14
**Módulo SGO**: Cadastros — Cargos e Salários (US-132)

**Contexto**: hoje `CadastrarCargoUseCase` já chama `CargoRubiFixtureProvider.buscarSalarioReal(nome)`
automaticamente ao criar o Cargo, usando o `nomeCargoMercado` digitado pelo usuário como entrada do
hash determinístico. Isso preenche só `salarioReal`/`statusSyncSalario`/`syncedAt`. A US-132 pede
ampliar para 5 campos (Nome, Tabela Salarial, Faixa, Nível, Salário Real) vindos de uma **busca
explícita** — o que não é mais compatível com "sincronizar automaticamente no create", porque agora
o próprio Nome do Cargo pode vir do Rubi, e o usuário precisa escolher entre candidatos antes de
qualquer coisa existir. Isso muda a forma de uso: de "todo Cargo sincroniza sozinho" para "o usuário
aciona quando quiser importar".

Dois riscos reais a evitar: (1) inventar uma tabela/campo novo para "Código Rubi" quando o sistema já
tem os conceitos certos para modelar isso sem campo extra; (2) confundir a fonte simulada externa
(Rubi) com a `TabelaSalarial`/`Senioridade` (US-131) — que é uma tabela de **pesquisa de mercado
interna do SGO**, mantida pelo próprio GRH, sem relação com o ERP. São conceitos deliberadamente
distintos e não devem ser fundidos: `TabelaSalarial` alimenta `salarioMercadoMinimo/Maximo` (RN_TAB),
`Rubi` alimenta o bloco soberano `salarioReal` + os novos campos de Tabela/Faixa/Nível do ERP
(RN_CAR_03/09). Confirmar essa separação evita a tentação de "aproveitar" `TabelaSalarial` como
fonte de busca do modal — não é a mesma coisa, mesmo com nomes parecidos.

### Opções Consideradas

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| **A — Busca por termo livre, transiente, novo método no provider** (proposta da US) | Não cria campo novo no schema; simples de simular na fixture (gera 1-3 candidatos por hash do termo); fácil de trocar por integração HTTP real depois (só troca a implementação do provider, mesma interface) | Busca "livre" não é super precisa numa fixture (mas isso é esperado — dados fictícios); usuário pode não saber que termo digitar até ver algum candidato | Alta |
| **B — Dropdown pré-carregado com todos os Cargos do Rubi** | Sem digitação, navegação direta | Fixture teria que gerar uma lista fixa e "carregar tudo" antecipadamente — não escala para uma integração real futura (Rubi real pode ter milhares de cargos); não é como buscas reais de ERP costumam funcionar (sempre por termo) | Média — desenho não sobrevive à integração real |
| **C — Campo "Código Rubi" novo, persistido em Cargo, como critério de busca exato** | Busca precisa por identificador único | Exige inventar um identificador que não existe em nenhum lugar do sistema hoje — o usuário teria que digitar um código que não sabe de cor; sem ganho real sobre a Opção A para uma fixture | Baixa — campo de schema fica órfão se a integração real usar outro identificador |

### Decisão

**Adotar Opção A**, confirmando a proposta da US-132: `buscarCargosPorTermo(termo: string):
Promise<CandidatoCargoRubi[]>`, novo método em `CargoRubiProvider` (`types.ts`), implementado por
`CargoRubiFixtureProvider` com geração determinística (mesmo hash já usado, aplicado ao termo em vez
do nome do Cargo, gerando 1 a 3 candidatos com nome/tabela/faixa/nível/salário todos derivados do
hash). `buscarSalarioReal` (método antigo) é **removido**, não mantido em paralelo — ele fica
redundante com o novo método e mantê-lo cria dois caminhos para o mesmo dado.

`TabelaSalarial`/`Senioridade` (US-131) **não têm nenhuma relação** com este fluxo — confirmado como
conceitos distintos: uma é pesquisa de mercado mantida pelo GRH dentro do SGO, a outra é (simulação
de) dado vindo do ERP de folha. Nenhuma mudança nelas.

**Schema — reaproveitar `statusSyncSalario`/`syncedAt` já existentes**, generalizando seu significado
de "só salarioReal" para "todo o bloco importado do Rubi" (Nome + Tabela + Faixa + Nível + Salário
Real) — não criar um novo campo `importadoDoRubiEm` redundante. Os 6 campos novos:

```prisma
model Cargo {
  // ... campos existentes ...

  // ADR-045 (US-132) — Tabela Salarial/Faixa/Nível do Rubi (fixture). Nullable até a
  // 1ª importação. [ORIGEM BLINDADA] junto de nomeCargoMercado e salarioReal — nunca
  // input direto em CadastrarCargoUseCase/EditarCargoUseCase depois de importados.
  tabSalCodigo      String?
  tabSalDescricao   String?
  faixaCodigo       String?
  faixaDescricao    String?
  nivelCodigo       String?
  nivelDescricao    String?

  // statusSyncSalario/syncedAt (já existentes) passam a cobrir todo o bloco importado
  // do Rubi, não só salarioReal — reaproveitados, sem novo campo de timestamp.
}
```

**Novo use case dedicado `ImportarCargoRubiUseCase`** (não reaproveitar
`CadastrarCargoUseCase`/`EditarCargoUseCase` para a escrita) — a operação é fundamentalmente
diferente de "editar um campo": é busca + escolha de candidato + escrita em lote atômica dos 5
campos + auditoria, disparada por uma ação própria do usuário (botão "Importar do Rubi"), não por um
submit de formulário genérico. `CadastrarCargoUseCase` **deixa de chamar o provider
automaticamente** — um Cargo novo nasce sem os 5 campos (mesmo estado hoje já possível para Cargo
Rascunho, ADR-042) e é importado depois, quando o usuário quiser. `EditarCargoUseCase` continua
descartando esses 5 campos se vierem no input (mesma defesa RN_CAR_03 já implementada), mas agora
por decisão consciente de que a única via de escrita legítima é `ImportarCargoRubiUseCase`.

Migration: **puramente aditiva**, 6 colunas `VARCHAR` nullable, sem backfill (não há dado real do
Rubi para retroagir) — confirmado, sem impacto em Cargos existentes.

### Consequências

- ✅ Não cria campo/tabela novo desnecessário — reaproveita `statusSyncSalario`/`syncedAt` e a
  mesma interface de provider já testada em US-107.
- ✅ Separação clara e documentada entre `TabelaSalarial` (interna) e Rubi (externa/simulada) evita
  confusão futura entre os dois conceitos.
- ✅ Trocar a fixture por integração HTTP real no futuro é uma troca de implementação do
  `CargoRubiProvider`, sem mudar `ImportarCargoRubiUseCase` nem o schema.
- ⚠️ Muda o comportamento atual: hoje todo Cargo novo sincroniza `salarioReal` sozinho ao ser criado;
  depois desta ADR, a sincronização passa a ser 100% opt-in via o modal. Cargos já cadastrados antes
  desta mudança mantêm o `salarioReal` que já tinham — não é uma regressão, é a troca de "automático"
  para "sob demanda" daqui pra frente.
- ⚠️ Remover `buscarSalarioReal` do provider é uma mudança de interface — checar se algum teste
  existente depende diretamente desse método (não só do use case) antes de apagar.

### Revisão Recomendada

Revisitar quando a integração HTTP real com o Rubi for priorizada — nesse ponto,
`buscarCargosPorTermo` provavelmente precisa de paginação/debounce (não faz sentido para uma fixture
com 1-3 candidatos, mas faz para um catálogo real de ERP).
