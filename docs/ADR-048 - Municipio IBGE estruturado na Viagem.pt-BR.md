## ADR-048: Município IBGE estruturado na Viagem (substitui o texto livre de localidade)

**Status**: Aceito
**Data**: 2026-09-02
**Módulo SGO**: Cadastros — Propostas / Guia Viagens (US-109, US-141)

**Contexto**: hoje `Viagem.descricao` é texto livre (`String`, máx. 100, obrigatório), exibido na
UI como "LOCALIDADE (PAÍS)". Não há padronização — "Brasília", "Brasília/DF", "Missão Brasília"
são a mesma viagem para efeitos de negócio mas três valores distintos para o banco. Isso impede
agregação confiável por destino e é a raiz do problema de qualidade de dado da tela de Viagens.

A US-141 (refinada pela AN/PO nesta sessão) decide introduzir um **município brasileiro
estruturado** (código IBGE de 7 dígitos), a partir de um catálogo embutido de 5.570 municípios
(fonte `github.com/kelvins/municipios-brasileiros`, licença MIT), mantendo o texto livre como
"motivo/complemento" opcional. Este ADR formaliza as decisões técnicas que a US deixou
explicitamente em aberto: tipo das colunas de coordenada, obrigatoriedade, onde vive o catálogo,
snapshot vs. lookup, estratégia de migration e forma do contrato.

Restrições do projeto que pesam aqui:
- Ambiente de trabalho **sem `.env` e sem `node_modules`** — migrations são escritas à mão e
  aplicadas pelo usuário via SQL Editor do Supabase. **Nunca** `prisma migrate dev`/`migrate diff`
  contra produção (regra permanente do `CLAUDE.md`, incidente de 2026-08-14).
- Deploy serverless (Vercel) — nada de `fs.readFileSync` em runtime; dados de catálogo entram
  como constante TS embutida (padrão já estabelecido: `plano-contas-raw.ts`,
  `grade-salarial-ctcea-raw.ts`, `cargo-mercado-raw.ts`).
- Cultura "nunca `Float`" — porém motivada por **valor monetário**, não por coordenada geográfica.
- `src/domain/plano-contas/calcularCustoEstimadoViagem.ts` é **[ORIGEM BLINDADA]** — não muda.

---

### Decisões

#### 1. Tipo das colunas de coordenada — `Decimal(9,6)`

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| `Float`/`DOUBLE PRECISION` | Tipo "natural" de coordenada; menor storage | Contraria a convenção do projeto (mesmo sendo aplicável aqui); Prisma mapeia para `Float` JS, `0.1+0.2` etc.; abre precedente de "às vezes Float pode" | Média |
| **`Decimal(9,6)`** ✅ | Coerente com "todo número persistido no SGO é `Decimal`"; sem surpresa de ponto flutuante; 6 casas ≈ 0,11 m de precisão, mais que suficiente para plotar município num mapa | ~alguns bytes a mais por linha; `Prisma.Decimal` no código (o projeto já usa em toda parte) | Média |
| `Decimal(10,7)` (sugestão da US) | 7 casas ≈ 1 cm | Precisão irreal para "centro do município"; não agrega valor | Média |

**Adotar `Decimal(9,6)`**, nullable. Latitude cabe em `[-90, 90]` e longitude em `[-180, 180]` —
`precision 9, scale 6` acomoda `-179.999999`. Coordenada aqui é o **centroide do município**
(o dataset dá um ponto por município, não o polígono), então precisão sub-métrica é ruído. A
escolha de `Decimal` sobre `Float` é menos por necessidade técnica e mais por **não abrir exceção
à regra** — o custo de manter a regra uniforme supera a economia de bytes.

`latitude` e `longitude` **não entram em nenhum cálculo** nesta US — ficam persistidas só para
destravar, sem geocoding, uma futura visualização geográfica (fora de escopo, ver US-141).

#### 2. Obrigatoriedade de `municipioIbge` — coluna nullable + validação na aplicação

- **Coluna `municipioIbge` é `NULL`-able no banco.** Postgres não tem `NOT NULL` condicional, e
  as viagens legadas ficam sem município (sem backfill). Uma constraint `NOT NULL` quebraria a
  migration.
- **A obrigatoriedade é regra de aplicação:**
  - `CadastrarViagemUseCase` — `municipioIbge` **obrigatório**. Ausente ou não encontrado no
    catálogo → erro de domínio (`MunicipioViagemObrigatorioError` / `MunicipioNaoEncontradoError`),
    nada é gravado.
  - `EditarViagemUseCase` — `municipioIbge` **opcional** (para não travar a correção de uma
    viagem legada). Se informado, valida contra o catálogo; se ausente, mantém o valor atual
    (que pode ser `null`).
- Mesma filosofia já usada no projeto para `Cargo.contaId` (ADR-027): a coluna nasceu com a
  regra "obrigatório dali para frente", aplicada no use case, não no schema onde há histórico.

#### 3. Catálogo embutido — `src/infrastructure/integrations/municipios-br/`

| Item | Decisão |
|---|---|
| Caminho | `src/infrastructure/integrations/municipios-br/` — mesmo nível de `senior/`, `ctcea/`, `cargo-mercado/` |
| Arquivo raw | `municipios-brasileiros-raw.ts` exportando `MUNICIPIOS_BR_RAW: MunicipioBrRaw[]` |
| Forma do registro | **Objeto**, não tupla: `{ codigoIbge: string; nome: string; uf: string; latitude: string; longitude: string }`. `codigoIbge` como `string` (é identificador, não número — evita perda de zero à esquerda e comparação numérica acidental). `latitude`/`longitude` como `string` no raw (viram `Prisma.Decimal` na gravação), mesmo padrão de valores decimais transportados como texto no projeto. |
| UF | Resolver o `codigo_uf` do dataset para a **sigla** (`"SP"`, `"DF"`, ...) já no raw, usando a tabela `estados` do mesmo repositório. Não guardar código numérico de UF. |
| Geração | Script único **commitado** em `scripts/gerar-municipios-br-raw.mjs` (padrão dos outros geradores do projeto), que lê o `municipios.csv` + `estados.csv` de um **commit fixo** de `kelvins/municipios-brasileiros` e emite o `.ts`. O hash do commit-fonte fica registrado no cabeçalho do arquivo gerado e no ADR (ver "Fonte" abaixo). O CSV-fonte **não** é versionado (só o `.ts` gerado). |
| Licença | `src/infrastructure/integrations/municipios-br/LICENSE` com o texto MIT do repositório-fonte + linha de atribuição. Cabeçalho do `.ts` referencia o repo, o commit e a licença. |
| Provider | `MunicipioBrCatalogo` (classe de infraestrutura) com `buscar(codigoIbge): MunicipioBr | null` sobre um `Map<string, MunicipioBr>` construído uma vez do raw. É o que os use cases chamam para resolver código → nome/uf/lat/long. |
| Sync / job | **Nenhum.** Sem tabela, sem botão "Sincronizar", sem `HistoricoOperacao`. Municípios brasileiros estão sob moratória constitucional de criação desde 2013 — o catálogo é efetivamente imutável. Atualização futura = rodar o script com um commit-fonte novo e commitar o `.ts`, em nova versão do código. Isto é **diferente** de `cargo-mercado`/`grade-salarial-ctcea` (que têm sync por serem dados de RH que mudam). |
| Tamanho / carregamento | ~5.570 registros ≈ 200 KB. No **cliente** (combobox da US-141), carregar via `import()` dinâmico dentro do `ViagemPanel`, só quando a guia Viagens monta — fora do bundle crítico. No **servidor**, `import` estático normal. |

#### 4. Snapshot congelado de `municipioNome` + `uf` (+ `latitude`/`longitude`) na Viagem

Gravar na `Viagem`, no momento do cadastro/edição, além do `municipioIbge`:
`municipioNome`, `uf`, `latitude`, `longitude` — todos resolvidos do catálogo pelo servidor.

Justificativa:
- **Consistência com o projeto** — Cargo e Empregado já congelam snapshot de custo/vínculo
  (ADR-018, ADR-027); a Viagem passa a seguir o mesmo princípio para o destino.
- **Independência de runtime** — a lista de viagens, os relatórios e (futuro) o Cronograma de
  Desembolso exibem "Curitiba — PR" sem precisar carregar o catálogo de 200 KB só para resolver
  um nome.
- **Auditabilidade** — se algum dia o catálogo for atualizado e um nome mudar (renomeação de
  município é raríssima mas possível), a Viagem preserva o que foi escolhido no ato. O
  `municipioIbge` continua sendo a chave canônica; o snapshot é a fotografia.
- O catálogo ser imutável **reduz** o risco de divergência, mas não o elimina de direito — o
  snapshot fecha a questão.

#### 5. Migration — aditiva, 5 colunas nullable, sem backfill

DDL (escrito à mão, aplicado pelo usuário via **SQL Editor do Supabase**):

```sql
-- Migration: add_municipio_ibge_viagem  (US-141 / ADR-048)
-- Risco: BAIXO — só adiciona colunas nullable a uma tabela existente.
--        Não altera dado, não altera coluna, não trava a tabela de forma relevante
--        (ADD COLUMN sem DEFAULT volátil é metadata-only no Postgres >= 11).
ALTER TABLE "Viagem" ADD COLUMN "municipioIbge"  TEXT;
ALTER TABLE "Viagem" ADD COLUMN "municipioNome"  TEXT;
ALTER TABLE "Viagem" ADD COLUMN "uf"             TEXT;
ALTER TABLE "Viagem" ADD COLUMN "latitude"       DECIMAL(9,6);
ALTER TABLE "Viagem" ADD COLUMN "longitude"      DECIMAL(9,6);

-- Índice para agregação futura por município (relatórios por destino). Barato agora.
CREATE INDEX "Viagem_tenantId_municipioIbge_idx" ON "Viagem" ("tenantId", "municipioIbge");
```

- **Sem backfill.** Viagens anteriores ficam com os 5 campos `NULL`. A US-141 define a UX de
  viagem legada ("— (sem município)", atribuível na edição).
- **Rollback:** `ALTER TABLE "Viagem" DROP COLUMN ...` nas 5 colunas + `DROP INDEX`. Como nada
  passa a depender dessas colunas para operações existentes (custo estimado, semáforo, cronograma
  não olham para elas), o rollback é seguro enquanto o código que as lê não estiver em produção.
- Registrar no histórico do Prisma com `migrate resolve --applied` **depois** de aplicada, usando
  o **Session Pooler** do Supabase (`pooler.supabase.com:5432`, usuário `postgres.<ref>`) — nunca
  a conexão direta nem o Transaction pooler (lição de 2026-08-26).
- Pasta da migration: `prisma/migrations/<timestamp>_add_municipio_ibge_viagem/migration.sql`.

#### 6. Contrato — o cliente envia só o `codigoIbge`

- Server Actions `cadastrarViagem` / `editarViagem` recebem **apenas `municipioIbge`** (string).
- O servidor (use case) resolve `municipioNome`, `uf`, `latitude`, `longitude` do
  `MunicipioBrCatalogo` e grava. **Nunca** confia em nome/UF/coordenadas vindos do cliente —
  mesmo que o payload os contenha, são ignorados.
- `municipioIbge` fora do catálogo → rejeição server-side (`MunicipioNaoEncontradoError`),
  mensagem "Município não encontrado no catálogo.", nada gravado.
- É o mesmo princípio anti-spoofing já aplicado em `contaId` (valida que a conta pertence ao
  tenant e é analítica antes de aceitar) e em `RateioImpostoGrade`.

#### 7. `CriarVersaoPropostaUseCase` — propagação obrigatória

`CriarVersaoPropostaUseCase` copia as Viagens da versão de origem via
`tx.viagem.createMany({ data: viagensOrigem.map(v => ({ ... })) })`, campo a campo
(`src/application/use-cases/plano-contas/CriarVersaoPropostaUseCase.ts`, bloco `viagensOrigem`).

**O mapeamento precisa incluir os 5 campos novos** (`municipioIbge`, `municipioNome`, `uf`,
`latitude`, `longitude`) — copiados **como estão** na origem (é snapshot; não re-resolver do
catálogo). Sem isso, criar nova versão / duplicar proposta **apaga silenciosamente** o município
de todas as viagens copiadas. Este é o maior risco de regressão da implementação — DoD da US-141
exige teste cobrindo exatamente esse caminho.

#### 8. Multi-tenant — catálogo global, `Viagem` continua por tenant

- O `MUNICIPIOS_BR_RAW` é **dado de referência global**, sem `tenantId`, somente leitura,
  embutido no código — exatamente como o catálogo de origem do Plano de Contas (`plano-contas-raw.ts`)
  e o de Cargo de Mercado (`cargo-mercado-raw.ts`). Não fere o padrão multi-tenant: não é dado de
  negócio de nenhuma organização, é uma tabela pública do IBGE.
- Nenhuma query nova toca o banco para resolver município (é `Map` em memória). A `Viagem`
  continua com `tenantId` em todo `where`, inclusive no novo índice
  `(tenantId, municipioIbge)`.

---

### Consequências

- ✅ Destino da Viagem vira dado agregável — habilita relatório por município, custo médio por
  destino e (futuro) mapa sem geocoding.
- ✅ Zero dependência externa em runtime; zero serviço de terceiros; zero API key.
- ✅ Padrões do projeto preservados: catálogo embutido, snapshot congelado, `Decimal`,
  anti-spoofing no contrato, validação no use case.
- ⚠️ Mudança de contrato de use case + migration → **branch + PR + `/code-review`** (fluxo Git
  híbrido). Não vai direto na master.
- ⚠️ Risco de regressão em `CriarVersaoPropostaUseCase` (decisão 7) — mitigado por teste no DoD.
- ⚠️ `descricao` e `municipioIbge` convivendo pode confundir o usuário sobre "o que vai em cada
  campo" — mitigado pelos rótulos definidos na US-141 ("MUNICÍPIO (BRASIL)" vs "MOTIVO /
  COMPLEMENTO DA VIAGEM") e pelo texto livre virar opcional.
- ⚠️ +200 KB no cliente **quando a guia Viagens abre** (lazy). Aceitável: é uma tela de uso
  pontual, não o dashboard principal.
- ⚠️ Catálogo comunitário (não é export oficial do IBGE). Aceito para um seletor de conveniência;
  se algum dia exatidão auditável for requisito, rederivar do serviço oficial
  `servicodados.ibge.gov.br/api/.../localidades` (troca só do gerador, não do modelo).

### Reversibilidade

**Média.** O modelo (5 colunas) é aditivo e as colunas são dropáveis enquanto o código que as lê
não estiver em produção. Depois que a UI de município estiver em produção e viagens forem
cadastradas com município, reverter significa perder o dado estruturado dessas viagens (o texto
livre `descricao` continua lá, mas não o código). A decisão de **tipo** (`Decimal` vs `Float`) é
cara de trocar depois (migration de tipo em coluna populada) — por isso está cravada aqui.

### Fonte de dados

- Repositório: `https://github.com/kelvins/municipios-brasileiros`
- Licença: MIT
- Commit-fonte: **a fixar pelo `fullstack-dev` no momento da implementação** — registrar o hash
  no cabeçalho de `municipios-brasileiros-raw.ts` e substituir esta linha.
- Arquivos usados: `csv/municipios.csv`, `csv/estados.csv`
- 5.570 municípios; campos aproveitados: `codigo_ibge`, `nome`, `latitude`, `longitude`,
  `codigo_uf` (→ sigla via `estados.csv`).

### Revisão recomendada

Reavaliar quando: (a) surgir requisito de viagem **internacional** — aí entra `paisIso` e
`municipioIbge` vira o detalhe do caso Brasil (o modelo não trava isso); (b) surgir requisito de
**exatidão auditável** do catálogo — trocar o gerador para o serviço oficial do IBGE; (c) o
catálogo passar a ser consultado de forma que 200 KB no cliente pese — mover a busca para uma
Server Action paginada (hoje não se justifica).
