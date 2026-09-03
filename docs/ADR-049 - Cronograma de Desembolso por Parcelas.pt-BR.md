## ADR-049: Cronograma de Desembolso por Parcelas (motor de agregação + config na Proposta)

**Status**: Aceito
**Data**: 2026-09-02
**Módulo SGO**: Orçamentário — Cronograma de Desembolso (US-142, UC04.01)

**Contexto**: a US-142 troca a apresentação do Cronograma de Desembolso — de uma **grade mês a
mês** (US-138) para uma **tabela de parcelas T1..Tn** no layout do **ANEXO 9** exigido pelo
concedente (`ANEXO 9 - CRONOGRAMA DESEMBOLSO 15.08.25.pdf`, TP PAME-RJ/CTCEA/2025): parcelas com
data e descrição próprias, sub-linha "Evento Tn Meta 01" por parcela, subtotais por ano civil,
linha de total geral, e a coluna "Valor Acumulado por Ano do TP". Todas as decisões de negócio
estão fechadas (ver `docs/US-142 ...md`). Este ADR fecha a modelagem: config do calendário de
repasse, estrutura do motor, algoritmo de datas + Etapas, período coberto (antecipado), filtro
da tela, e a limitação "Viagem sem data".

Restrições que pesam: (1) o motor mensal atual (`montarCronogramaDesembolso.ts`, [ORIGEM
BLINDADA]) é a **verdade do custo por competência** e não deve ser jogado fora; (2) ambiente de
dev sem `.env` — migration escrita à mão e aplicada pelo usuário via SQL Editor do Supabase;
(3) lição de 2026-09-02 (US-141): **PR com migration → aplicar o SQL junto do merge**, senão dá
500 em produção; (4) a tela é **somente leitura** [RN_CD_001 / ORIGEM BLINDADA].

---

### A — Config do calendário de repasse: onde e como

#### Opções

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| **A1 — 2 campos em `Proposta`, nullable, com default de aplicação** ✅ | Aditivo; não quebra proposta existente; a maioria dos casos é "3/janeiro" e nem precisa preencher; validação no use case | O default fica implícito — quem não sabe pode gerar cronograma "errado" sem perceber | Alta |
| A2 — 2 campos em `Proposta`, obrigatórios, bloqueia a geração se ausentes | Força o usuário a decidir; zero ambiguidade | Backfill de todas as propostas legadas; fricção; um Fluxo E a mais | Média |
| A3 — entidade `CalendarioRepasse` separada (1:1 com Proposta) | "Purista" | Over-engineering — são 2 inteiros, não uma agregação | Média |
| A4 — em `VersaoProposta` | Segue o ciclo de vida da versão | O calendário de repasse é **contratual** (do Termo de Parceria), não muda entre versões orçamentárias — colocar na versão convida a divergência | Média |

#### Decisão

**Adotar A1.** Dois campos em `Proposta`:

```prisma
model Proposta {
  // ... campos existentes ...
  /// US-142/ADR-049 — calendário de repasse do Termo de Parceria. Nº de parcelas regulares por
  /// ano (divisores de 12: 1,2,3,4,6,12). null = usar default 3 na geração do cronograma.
  parcelasPorAno     Int?
  /// Mês (1–12) da 1ª parcela regular do ano. null = usar default 1 (janeiro).
  mesInicialRepasse  Int?
}
```

- **Nullable no banco**, sem backfill. Na geração do cronograma, `parcelasPorAno ?? 3` e
  `mesInicialRepasse ?? 1`.
- **Validação** (domínio, em `CadastrarPropostaUseCase` + `EditarPropostaUseCase`, e Zod na
  Server Action):
  - `parcelasPorAno`, quando informado, ∈ `{1, 2, 3, 4, 6, 12}` — divisores de 12, garante
    espaçamento inteiro. Erro novo `CalendarioRepasseInvalidoError`.
  - `mesInicialRepasse`, quando informado, ∈ `[1, 12]`.
  - Regra: os dois juntos ou nenhum (não aceitar um só preenchido) — evita config pela metade.
- **CHECK constraints** no banco como segunda linha de defesa (ver DDL em §DDL).
- **UI**: 2 selects no form de cadastro/edição de Proposta — "Parcelas por ano" (1/2/3/4/6/12) e
  "Mês da 1ª parcela regular" (Janeiro…Dezembro). Fora do escopo da tela de Cronograma
  (que é read-only).

---

### B — Arquitetura do motor de cálculo

#### Decisão

**Camada de agregação nova por cima do motor mensal — o motor mensal não muda.**

```
montarCronogramaDesembolso(proposta, empregados, viagens, itens, rateios)
        │  (INALTERADO — verdade do custo por competência, [ORIGEM BLINDADA])
        ▼
  LinhaCronograma[]  (1 por mês)
        │
        ▼
agregarEmParcelas(linhasMensais, { dataInicio, dataFim, parcelasPorAno, mesInicialRepasse, valorGlobal })
        │  (NOVA função pura de domínio, [ORIGEM BLINDADA])
        ▼
  CronogramaParcelado
```

Arquivo novo: `src/domain/plano-contas/agregarEmParcelas.ts`.

```ts
export type SubLinhaParcela = { rotulo: string; valor: Prisma.Decimal }; // hoje sempre "Evento Tn Meta 01"

export type ParcelaCronograma = {
  numero: number;                     // 1..n
  data: Date;                         // primeiro dia do mês da parcela
  descricao: string;                  // "Nª parcela relativa à Etapa M do Cronograma Físico" (T1 pode ser "às Etapas 1 e 2")
  desembolso: Prisma.Decimal;         // soma dos meses do período ANTECIPADO da parcela
  desembolsoAcumulado: Prisma.Decimal;
  percentualFinanceiroAcumulado: Prisma.Decimal; // RN0252 — 2 casas HALF_EVEN
  subLinhas: SubLinhaParcela[];
};

export type SubtotalAnual = {
  ano: number;
  totalDoAno: Prisma.Decimal;
  desembolsoAcumulado: Prisma.Decimal;
  percentualFinanceiroAcumulado: Prisma.Decimal;
  valorAcumuladoPorAnoDoTP: Prisma.Decimal; // ANEXO 9 col. 7 — == desembolsoAcumulado ao fim do ano
};

export type CronogramaParcelado = {
  parcelas: ParcelaCronograma[];
  subtotaisAnuais: SubtotalAnual[];
  totalGeral: Prisma.Decimal;   // == valorGlobal exatamente (RN_CD_002)
  valorGlobal: Prisma.Decimal;
};
```

- Função **pura**, sem I/O, testável isoladamente — mesmo padrão de `montarCronogramaDesembolso`
  e `calcularCustoEstimadoViagem`.
- Chamada no Server Component (`page.tsx`, bloco `cronograma-desembolso`), logo após
  `montarCronogramaDesembolso`.
- **RN_CD_002 (soma exata):** `totalGeral` deve ser idêntico ao `desembolsoAcumulado` da última
  `LinhaCronograma` mensal. O resíduo de arredondamento (se a soma das parcelas divergir por
  centavos do acumulado mensal) é **absorvido pela última parcela**: a última parcela recebe
  `valorGlobal − (soma das parcelas anteriores)`.

---

### C — CD-06: Viagem sem data de ocorrência

#### Opções

| Opção | Prós | Contras |
|---|---|---|
| **C1 — aceitar como limitação conhecida, documentar** ✅ | Não bloqueia a entrega do formato APÊNDICE J (pedido ativo do concedente); a limitação já existe desde US-122; total geral e subtotais anuais continuam corretos | A 1ª parcela (entrada) fica "pesada" quando há muita viagem — distribuição intra-ano distorcida |
| C2 — exigir campo de data na Viagem antes (migration + UI + regra) | Cronograma preciso | Vira uma US inteira na frente da US-142; atrasa o que o concedente pediu; escopo não solicitado |
| C3 — distribuir a viagem uniformemente pela vigência | "Suaviza" a distorção | **Inventa dado** — a viagem não acontece "um pouco por mês"; ninguém pediu; piora a auditabilidade |

#### Decisão

**Adotar C1.** Aceitar que todo o custo de Viagem cai em **T1 (parcela de entrada)**, como
consequência da limitação herdada (Viagem sem campo de data). Documentar na tela (nota ao pé) e
na US-142. Registrar **US-143 (futura, não priorizada): "Data/período de ocorrência da Viagem"**
— quando existir, `montarCronogramaDesembolso` passa a alocar a viagem no mês certo e
`agregarEmParcelas` herda a correção sem mudança.

---

### D — Algoritmo de datas, período coberto e Etapas

Entrada: `dataInicio`, `dataFim`, `parcelasPorAno` (default 3), `mesInicialRepasse` (default 1).

```
espacamento = 12 / parcelasPorAno            // inteiro (garantido pela validação de §A)
inicioMes = primeiroDiaDoMes(dataInicio)
fimMes    = primeiroDiaDoMes(dataFim)

// 1. datas regulares (Etapa 2, 3, 4, ...): a partir de mesInicialRepasse, de `espacamento` em
//    `espacamento` meses, mantendo só as que caem em [inicioMes, fimMes].
regulares = []
cursor = primeiroDiaDoMes(ano(dataInicio) - 1, mesInicialRepasse - 1)   // recua 1 ano p/ garantir
while cursor <= fimMes:
    if cursor >= inicioMes: regulares.push(cursor)
    cursor = addMeses(cursor, espacamento)

// 2. entrada (Etapa 1) = inicioMes. Lista teórica de Etapas:
etapas = ordenarUnico([inicioMes, ...regulares])   // se inicioMes ∈ regulares, NÃO deduplica aqui —
                                                   // a dedup vira "fusão de linha", ver passo 3
fusaoT1 = regulares.inclui(inicioMes)              // entrada coincide com regular₁?

// 3. linhas de parcela = etapas SEM a duplicata da entrada:
datasParcela = fusaoT1 ? [inicioMes, ...regulares.exceto(inicioMes)] : [inicioMes, ...regulares]
              // (já ordenado e sem repetição)
parcelas = datasParcela.map((data, i) => T{i+1} @ data)
```

- **Fusão de T1 (caso ANEXO 9):** quando `inicioMes` coincide com a 1ª data regular, existe **1
  linha** T1 nesse mês, mas ela representa **Etapa 1 + Etapa 2**. Descrição: `"1ª parcela relativa
  às Etapas 1 e 2 do Cronograma Físico"`. As demais linhas Tn (n≥2) recebem `Etapa = n + 1`
  (deslocamento) → `"nª parcela relativa à Etapa (n+1) do Cronograma Físico"`.
- **Sem fusão:** T1 = só a entrada = Etapa 1. Tn = Etapa n. `"nª parcela relativa à Etapa n do
  Cronograma Físico"`.
- **Proposta curta:** sem nenhuma data regular em `[inicioMes, fimMes]` → só **T1** (Etapa 1),
  cobrindo toda a vigência.
- **`parcelasPorAno` ∉ {1,2,3,4,6,12}:** impossível (validação §A). 5/ano ou espaçamento
  irregular → **novo ADR**.

#### Período coberto — **ANTECIPADO**

- Parcela `Tk` (data `Dk`) paga o bloco **`[Dk, addMeses(D(k+1), −1)]`** — do seu mês até o mês
  anterior à próxima parcela.
- **T1** cobre `[inicioMes, addMeses(D2, −1)]`.
- **Última parcela** `Tn` cobre `[Dn, fimMes]`.
- `desembolso(Tk)` = soma dos `desembolsoMensal` das `LinhaCronograma` cujos meses caem nesse
  intervalo. Como o motor mensal joga toda a Viagem (e itens datados no 1º mês) na competência
  inicial, **T1 concentra a mobilização** — é o comportamento do ANEXO 9 (T1 ≈ 2× T2) e a
  limitação CD-06.

#### Subtotais anuais e coluna 7

- Agrupar `parcelas` por `data.getUTCFullYear()`. Para cada ano com ≥1 parcela: `SubtotalAnual`
  com `totalDoAno` = soma das parcelas do ano, `desembolsoAcumulado` = acumulado até a última
  parcela do ano, `%` idem, e **`valorAcumuladoPorAnoDoTP` = o mesmo `desembolsoAcumulado`**
  (ANEXO 9 col. 7). Essa coluna é **vazia** em toda linha de parcela e de sub-linha.
- A antiga RN0253 / "Valor Repassado a cada 12 meses" **sai** — não existe no ANEXO 9.

---

### E — Filtro de período da tela

#### Decisão

**Filtro 100% client-side, puramente visual. O cálculo é sempre sobre o cronograma inteiro.**

- `page.tsx` monta e serializa o `CronogramaParcelado` **completo** (todas as parcelas,
  acumulados, %, subtotais, total geral).
- `CronogramaDesembolsoPanel` recebe tudo + 2 inputs de data (`De` / `Até`, opcionais). O filtro
  **esconde** as parcelas cuja `data` está fora do intervalo — **não recalcula** `desembolsoAcumulado`
  nem `%` (continuam sendo os do cronograma completo).
- Subtotais anuais: mostrar os dos anos que têm ≥1 parcela visível. Total geral: **sempre**
  visível (é o valor do TP, não do recorte).
- **Nota obrigatória na tela** quando há filtro ativo: *"Exibindo o período filtrado. Os valores
  de Acumulado e % Financeiro Acumulado referem-se ao cronograma completo."* — evita o usuário
  achar que o % "pulou".
- Alternativa (filtro via query param + re-render no servidor) **rejeitada**: o cálculo não muda
  com o filtro, então re-buscar do banco é desperdício; client-side é instantâneo e mais simples.

---

### F — Reuso vs reescrita

| Artefato | Decisão |
|---|---|
| `CronogramaDesembolsoPanel.tsx` — **tabela** | **Reescrever.** A estrutura de linhas muda por completo (parcela / sub-linha / subtotal-anual / total-geral). |
| `CronogramaDesembolsoPanel.tsx` — **resto** | **Reusar:** faixa de KPIs (adaptar rótulos: "Nº de Parcelas", "Custo Total do Cronograma", "Duração da Vigência"), painel de "Filtros Aplicados" (RN0200/RN0250), botões de export, estado de bloqueio "sem dados financeiros" (Cenário 8). |
| `exportarRelatorio.ts` (ADR-037) | **Estender, não reescrever.** Adicionar campo opcional `estiloLinha?: 'normal' \| 'subitem' \| 'subtotal' \| 'total'` em `LinhaRelatorio`. PDF: `didParseCell` aplica negrito/indent/fill por estilo. XLSX: `row.font`/`row.fill`. Ausência do campo = `'normal'` — os outros usos (US-123 alíquotas) não mudam. `titulo` passa a ser `"ANEXO 9 — CRONOGRAMA DE DESEMBOLSO"` (subtítulo com o nome do TP / "Programa de Trabalho - Rev.NN"). |
| `montarCronogramaDesembolso.ts` | **Não tocar.** |
| `calcularCustoEstimadoViagem.ts` | **Não tocar.** |

---

### G — Impacto (checklist para o `fullstack-dev`)

| Camada | Mudança |
|---|---|
| `prisma/schema.prisma` | `Proposta` +`parcelasPorAno Int?` +`mesInicialRepasse Int?` + 2 CHECK. |
| Migration | SQL à mão (§DDL). Aplicar via SQL Editor do Supabase **junto do merge do PR**. `migrate resolve --applied` pelo Session Pooler. |
| `src/domain/plano-contas/errors.ts` | `CalendarioRepasseInvalidoError`. |
| `src/domain/plano-contas/agregarEmParcelas.ts` | **Novo** — função pura + tipos (§B). |
| `src/domain/plano-contas/gerarDatasParcela.ts` | **Novo** (ou interno a `agregarEmParcelas`) — algoritmo de §D, testável isolado. |
| `CadastrarPropostaUseCase` / `EditarPropostaUseCase` | Aceitam os 2 campos opcionais; validam (`{1,2,3,4,6,12}`, `[1,12]`, os dois-ou-nenhum). |
| Server Action de cadastrar/editar Proposta + Zod | +2 campos. |
| Form de Proposta (UI) | 2 selects. |
| `cronogramaTipos.ts` | Nova estrutura serializada `CronogramaParceladoSerializado` (Decimais → string). |
| `page.tsx` (bloco cronograma) | Chama `agregarEmParcelas` após `montarCronogramaDesembolso`; serializa; passa `parcelasPorAno`/`mesInicialRepasse` da Proposta. |
| `CronogramaDesembolsoPanel.tsx` | Reescrita da tabela + filtro de período + nota. |
| `exportarRelatorio.ts` | `estiloLinha`. |
| Testes | `gerarDatasParcela` (configs 1/2/3/4/6/12 × mesInicial × com/sem fusão de T1 × proposta curta), `agregarEmParcelas` (período **antecipado**, soma == valorGlobal + resíduo na última, sub-linha "Evento Tn Meta 01", subtotais anuais + coluna 7, texto da Etapa com/sem deslocamento), reprodução dos números do ANEXO 9 como fixture de regressão, validação dos 2 campos na Proposta. |

---

### DDL da migration

```sql
-- Migration: add_calendario_repasse_proposta  (US-142 / ADR-049)
-- Risco: BAIXO — 2 colunas nullable + CHECK. Não altera dado, não reescreve tabela.
ALTER TABLE "Proposta" ADD COLUMN "parcelasPorAno" INTEGER;
ALTER TABLE "Proposta" ADD COLUMN "mesInicialRepasse" INTEGER;

ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_parcelasPorAno_check"
  CHECK ("parcelasPorAno" IS NULL OR "parcelasPorAno" IN (1, 2, 3, 4, 6, 12));
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_mesInicialRepasse_check"
  CHECK ("mesInicialRepasse" IS NULL OR ("mesInicialRepasse" BETWEEN 1 AND 12));
ALTER TABLE "Proposta" ADD CONSTRAINT "Proposta_calendario_repasse_par_check"
  CHECK (("parcelasPorAno" IS NULL) = ("mesInicialRepasse" IS NULL));

-- Rollback:
--   ALTER TABLE "Proposta" DROP CONSTRAINT "Proposta_calendario_repasse_par_check";
--   ALTER TABLE "Proposta" DROP CONSTRAINT "Proposta_mesInicialRepasse_check";
--   ALTER TABLE "Proposta" DROP CONSTRAINT "Proposta_parcelasPorAno_check";
--   ALTER TABLE "Proposta" DROP COLUMN "mesInicialRepasse";
--   ALTER TABLE "Proposta" DROP COLUMN "parcelasPorAno";
```

---

### Decisão (resumo)

**Adotar:** config em 2 campos nullable em `Proposta` com default de aplicação (A1); camada
`agregarEmParcelas` pura por cima do motor mensal preservado (B); Viagem sem data aceita como
limitação documentada + US-143 futura (C1); algoritmo de datas com dedup da parcela de entrada
(D); filtro de período client-side sem recálculo (E); reescrita só da tabela + extensão do
exportador (F).

### Consequências

- ✅ Documento idêntico ao APÊNDICE J que o concedente exige, sem inventar dado.
- ✅ Motor mensal (verdade do custo) intacto — dá pra voltar ao layout antigo rápido.
- ✅ Migration mínima e reversível; nenhuma tabela nova.
- ⚠️ 1ª parcela distorcida quando há muita Viagem (CD-06) — aceito, documentado, US-143 futura.
- ⚠️ Config pela metade impossível (CHECK `par`), mas config **ausente** usa default silencioso
  — mitigado pelo select no form vir pré-preenchido com 3/Janeiro.
- ⚠️ Mudança de motor financeiro + tela → **branch + PR + `/code-review`**; migration aplicada
  **junto do merge**.
- ⚠️ RN_CD_002 (soma exata) é o ponto sensível — teste de regressão obrigatório comparando
  `Σ parcelas` com o `desembolsoAcumulado` da última linha mensal.

### Reversibilidade

**Média.** Os 2 campos são aditivos e dropáveis enquanto a tela nova não estiver em produção. A
tela é read-only (sem risco de dado). Depois que propostas tiverem o calendário preenchido e o
concedente tiver recebido documentos no formato novo, reverter tem custo de comunicação, não
técnico.

### Revisão recomendada

Reavaliar quando: (a) surgir Termo de Parceria com calendário de repasse não-uniforme (ex.:
5/ano, ou datas irregulares) → novo ADR para o algoritmo de datas; (b) a US-143 (data da Viagem)
for priorizada → CD-06 deixa de ser limitação; (c) aparecer Proposta POR_META real com múltiplas
Metas precisando rateio por Meta no cronograma → rever a decisão "Meta Única" da US-142.
