## ADR-044: Periculosidade e Insalubridade como Adicionais do Cargo

**Status**: Aceito
**Data**: 2026-08-14
**Módulo SGO**: Cadastros — Cargos e Salários (Tabela Mestre de Benefícios e Encargos)

**Contexto**: US-136 pede 2 novos campos no Cargo — Periculosidade e Insalubridade —, cada um
podendo ser preenchido como percentual (aplicado sobre o salário) ou valor fixo em R$, nunca os
dois ao mesmo tempo. O bloco de Benefícios e Encargos já existente (US-107a/ADR-019, ADR-029) tem
um pipeline de cálculo fechado e testado: `salarioTotal` (salário + gratificação, ADR-016) →
`Encargos Sociais = salarioTotal × encargosSociaisPct` → `custoTotalCargo = salarioTotal + Encargos
+ ΣBenefícios`. Qualquer decisão aqui que mexa na base de `salarioTotal` ou na base de Encargos
teria efeito cascata sobre `EmpregadoHeadcount.custoTotalMensal` (herda `custoTotalCargo`, ADR-018)
e sobre o snapshot por componente (ADR-029), ambos já em produção.

Duas tensões reais: (1) tecnicamente, Periculosidade/Insalubridade são adicionais **salariais** na
CLT — em tese deveriam compor a base de outros cálculos (13º, FGTS, e aqui, potencialmente a base
de Encargos Sociais). (2) O SGO 2.0 atende também OSCIPs com Termo de Parceria e política de pessoal
própria, não necessariamente idêntica à CLT — e o sistema já modela Encargos Sociais como um
percentual único digitado livremente pelo usuário, não como uma fórmula legal fechada. Tratar
Periculosidade/Insalubridade como parte da base de Encargos seria assumir uma regra legal que o
sistema explicitamente não codifica em nenhum outro ponto do Cargo.

### Opções Consideradas

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| **A — Adicional que compõe a base de `salarioTotal`/Encargos** (mais próximo da CLT) | Fiel à lógica trabalhista real, base de Encargos fica "correta" para quem segue CLT à risca | Muda o significado de `salarioTotal` (ADR-016 fixou como "salário + gratificação", já usado por Empregado/US-108); exige migrar/recalcular Cargos e Empregados existentes; força o sistema a arbitrar uma regra legal (CLT) que hoje não está codificada em nenhum outro ponto do Cargo, incorreta para o contexto OSCIP não-CLT | Baixa — mudar a base de um campo já consumido por outro módulo (Empregado) é caro de desfazer |
| **B — Adicional somado ao `custoTotalCargo`, fora da base de Encargos, com conta contábil própria** (mesmo padrão de VA/VR/Seguro Vida) | Zero mudança em `salarioTotal`/Encargos, nenhum efeito cascata em Empregado; reaproveita 100% do pipeline testado de US-107a/ADR-029; neutro quanto a CLT vs. política própria de OSCIP — o sistema só soma o que o usuário configurou, sem arbitrar | Diverge da CLT estrita para quem opera nesse regime (Encargos não vão embutir Periculosidade/Insalubridade na base) — mitigável com nota de UX, não com trava de código | Alta — campo aditivo, fácil de reclassificar depois se necessário |
| **C — Não entra em `custoTotalCargo`, fica só informativo** | Implementação trivial | Não resolve o pedido de negócio (usuário quer que o custo real do headcount reflita o adicional) | Alta, mas não atende ao requisito |

### Decisão

**Adotar Opção B** — Periculosidade e Insalubridade são **adicionais somados ao `custoTotalCargo`
depois de Encargos Sociais**, no mesmo nível de VA/VR/Plano de Saúde/Seguro de Vida/Auxílio
Creche/Vale Transporte, cada um com conta contábil analítica própria (ADR-029). O percentual, quando
esse for o tipo escolhido, é calculado sobre `salarioTotal` (a mesma base já usada por Encargos
Sociais — é a única base salarial que o Cargo possui hoje; não criar um "salário-base" separado só
para este cálculo). `salarioTotal` continua com o significado fixado no ADR-016, sem mudança.

Respostas às 6 decisões da US-136:

1. **Base do percentual = `salarioTotal`** (mesma base de Encargos Sociais). Não existe — e esta
   ADR não cria — um campo de "salário-base" distinto.
2. **Entram no `custoTotalCargo` como adicional, não como parte da base de Encargos** (Opção B).
   `custoTotalCargo = salarioTotal + Encargos Sociais + Periculosidade + Insalubridade +
   ΣBenefícios`. Encargos Sociais continua sendo `salarioTotal × encargosSociaisPct`, sem incluir
   os dois novos adicionais na sua base.
3. **Ganham conta contábil analítica própria**, seguindo o padrão ADR-029: `contaPericulosidadeId`
   e `contaInsalubridadeId` (FKs opcionais para `ContaContabil`, validadas na camada de aplicação,
   sem `@relation` formal nomeada — mesmo motivo das outras 9: evitar relações nomeadas
   desproporcionais ao ganho).
4. **Cumulação permitida, sem validação cruzada no sistema.** O SGO 2.0 não arbitra a regra legal de
   vedação de cumulação da CLT — isso é uma decisão de RH/jurídico de cada tenant, e o sistema já
   trata Encargos Sociais da mesma forma (percentual livre, sem fórmula legal fechada). Registrar
   como nota de UX (tooltip ou texto de ajuda) que a cumulação pode não ser válida sob CLT, sem
   bloquear.
5. **Nomenclatura do schema** — ver Schema Mode abaixo.
6. **Confirmado.** Cargos existentes recebem os campos `*Ativo = false` por padrão (via `DEFAULT
   false` na migration) — `custoTotalCargo` de Cargos já calculados não muda, porque
   `calcularTotalBeneficios`/o novo somatório de adicionais só soma quando `*Ativo = true`.

### Consequências

- ✅ Nenhuma mudança em `salarioTotal`, `EmpregadoHeadcount.custoTotalMensal` ou no snapshot
  congelado do Empregado (ADR-018) — o adicional só se propaga para Empregados cadastrados/editados
  **depois** desta mudança, mesmo comportamento já aceito para qualquer edição de Cargo.
- ✅ Reaproveita 100% do pipeline de cálculo, teste e auditoria de US-107a — implementação é
  estritamente aditiva (2 booleanos + 2 enums + 2 decimais + 2 FKs opcionais + 2 linhas na soma).
- ✅ Neutro entre contexto CLT e contexto OSCIP não-CLT — o sistema não trava uma regra legal que não
  domina o suficiente para arbitrar com segurança.
- ⚠️ Para tenants que operam estritamente sob CLT, a base de Encargos Sociais não vai embutir
  Periculosidade/Insalubridade como a legislação trabalhista faria "corretamente" — aceito
  conscientemente, mitigado com nota de UX, não é bug, é escopo.
- ⚠️ O sistema permite Periculosidade + Insalubridade simultâneas sem aviso de bloqueio — mesma
  filosofia de "usuário responsável pela configuração" já aplicada a Encargos Sociais.

### Revisão Recomendada

Se um cliente real operando sob CLT estrita reportar que a base de Encargos Sociais precisa incluir
Periculosidade/Insalubridade por exigência de auditoria trabalhista, revisitar como uma US nova de
"modo de cálculo CLT" configurável por tenant — não retrofitar esta ADR.

---

## Schema Mode — desenho resultante

```prisma
enum TipoValorAdicional {
  PERCENTUAL
  VALOR_FIXO
}

model Cargo {
  // ... campos existentes (US-107a/ADR-029) ...

  // ADR-044 — Periculosidade e Insalubridade: adicional salarial configurável como
  // percentual sobre salarioTotal OU valor fixo em R$, nunca os dois ao mesmo tempo
  // (mesmo padrão de origemSalarioMinimo/Maximo). Somado a custoTotalCargo DEPOIS de
  // Encargos Sociais — não entra na base de cálculo de Encargos.
  periculosidadeAtivo Boolean             @default(false)
  periculosidadeTipo  TipoValorAdicional?
  periculosidadeValor Decimal             @default(0) @db.Decimal(15, 2) // % (0-100) ou R$, conforme periculosidadeTipo
  contaPericulosidadeId String?

  insalubridadeAtivo Boolean             @default(false)
  insalubridadeTipo  TipoValorAdicional?
  insalubridadeValor Decimal             @default(0) @db.Decimal(15, 2) // % (0-100) ou R$, conforme insalubridadeTipo
  contaInsalubridadeId String?
}
```

**Justificativa dos tipos:** `Decimal(15,2)` reaproveita a mesma precisão de todos os outros campos
monetários do Cargo — quando `*Tipo = PERCENTUAL`, o valor armazenado é 0-100 (não 0-1), mesma
convenção de `encargosSociaisPct`. `*Tipo` fica nullable porque só é obrigatório quando `*Ativo =
true` (mesma lógica de `planoSaudeFaixa`, nullable e só relevante quando `planoSaudeAtivo = true`) —
validação de obrigatoriedade condicional fica na camada de aplicação, não no schema.

**Migration:** puramente aditiva (`ALTER TABLE "Cargo" ADD COLUMN ...` com `DEFAULT false`/`DEFAULT
0`, mais o novo enum `TipoValorAdicional`) — sem impacto em dado existente, sem backfill necessário,
reversível por `DROP COLUMN` se preciso.

**Fórmula de cálculo** (`src/domain/plano-contas/calcularCustoTotalCargo.ts`):

```ts
function calcularValorAdicional(
  ativo: boolean,
  tipo: TipoValorAdicional | null,
  valor: Prisma.Decimal.Value,
  salarioTotal: Prisma.Decimal.Value,
): Prisma.Decimal {
  if (!ativo) return new Prisma.Decimal(0);
  return tipo === 'PERCENTUAL' ? new Prisma.Decimal(salarioTotal).times(valor).dividedBy(100) : new Prisma.Decimal(valor);
}
```

`custoTotalCargo` passa a somar `calcularValorAdicional(periculosidade...) +
calcularValorAdicional(insalubridade...)` junto de Encargos e Benefícios. `contaPericulosidadeId`/
`contaInsalubridadeId` entram no breakdown por componente (`calcularBreakdownComponenteCusto`),
mesmo padrão dos outros 9 componentes com conta própria.

**Validações na camada de aplicação** (Zod + use case, mesmo padrão de `ConfigurarBeneficiosCargoUseCase`):
- `*Ativo = true` exige `*Tipo` preenchido.
- `*Tipo = PERCENTUAL` → `*Valor` entre 0 e 100.
- `*Tipo = VALOR_FIXO` → `*Valor` ≥ 0 (sem teto).
- Trocar `*Tipo` reinicia `*Valor` para 0 no formulário (regra de UX da US-136, Cenário 5) — não é
  regra de banco, é comportamento do client antes de submeter.
