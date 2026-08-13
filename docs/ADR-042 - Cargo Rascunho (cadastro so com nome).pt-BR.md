## ADR-042: Cargo "Rascunho" — cadastro só com nome a partir da Tabela Salarial

**Status**: Aceito
**Data**: 2026-08-13
**Módulo SGO**: Cadastros — Cargos e Salários / Tabela Salarial (US-131)
**Contexto**: usuário quer cadastrar um Cargo só com o nome (`nomeCargoMercado`) diretamente da aba Tabela Salarial, sem passar pelo formulário completo (Vínculo Funcional, Conta Contábil, salário, benefícios). Hoje `CadastrarCargoUseCase` exige, por regra de negócio já em produção: `alocacoes` não-vazio (RN_EST_01, `VinculoFuncionalObrigatorioError`) e `contaId` de uma conta analítica (ADR-027, `ContaCargoNaoAnaliticaError`). Um cadastro "só nome" precisa violar essas 2 travas de propósito — a questão é como fazer isso sem abrir brecha para um Cargo incompleto contaminar cálculos financeiros (Semáforo, Valor Realizado) ou virar um Empregado sem conta.

### Opções Consideradas

| Opção | Prós | Contras | Reversibilidade |
|---|---|---|---|
| A — Campo `status: RASCUNHO \| COMPLETO` explícito no Cargo, `contaId` e demais campos financeiros viram nullable | Fonte de verdade única e explícita sobre "este Cargo pode ser usado em cálculo" — nunca precisa inferir de nulls espalhados; qualquer use case downstream faz 1 checagem simples (`status === 'COMPLETO'`); auditável (fica no histórico quando o Cargo saiu de rascunho) | Mais um campo de estado para manter consistente; migration toca 5 colunas (amplia nullability + 1 coluna nova) | Alta — reverter é só voltar a exigir os campos no cadastro |
| B — Inferir "rascunho" implicitamente de `contaId IS NULL` | Sem campo novo | Frágil: qualquer código futuro que esqueça de checar `contaId === null` antes de somar/exibir o Cargo introduz um bug silencioso: não há trava única, é preciso lembrar disso em cada use case novo | Baixa — depois que vira convenção implícita espalhada pelo código, é caro migrar para um campo explícito |

### Decisão

**Adotar Opção A.** Novo enum `StatusCargo { RASCUNHO, COMPLETO }`, campo `Cargo.status` (default `COMPLETO` — preserva o comportamento de todo Cargo já existente e de todo cadastro feito pela aba Cargos, que continua exigindo o formulário inteiro).

1. **Novo use case `CadastrarCargoRascunhoUseCase`** (não reaproveita `CadastrarCargoUseCase`, que continua com suas travas intactas para o fluxo completo): aceita só `tenantId`, `usuarioId`, `propostaId`, `nomeCargoMercado`. Gera `codigoCargo` no mesmo padrão (`CARGO-{ano}-{seq}`, reaproveitando `gerarProximoCodigoCargo`). Grava `status: 'RASCUNHO'`, `contaId: null`, sem `CargoAlocacaoPercentual` (array vazio — **RN_EST_03 simplesmente não se aplica a um Cargo sem nenhuma alocação**: a regra dos 100% é sobre a soma das alocações existentes, e zero alocações não é uma soma inválida, é ausência de rateio ainda não definido), `salarioMercadoMinimo`/`Maximo`/`fonteAtiva`/`periodoInicio` nulos.
2. **`EditarCargoUseCase` (formulário completo, aba Cargos) ganha a responsabilidade de "formar" o rascunho**: ao salvar com sucesso (todas as travas de sempre — `alocacoes` não-vazio, `contaId` analítica, etc. — continuam obrigatórias nesse fluxo), o use case seta `status: 'COMPLETO'` sempre, incondicionalmente. Não existe caminho de volta de COMPLETO para RASCUNHO — é transição de mão única.
3. **`CalcularValorRealizadoUseCase` e qualquer soma financeira por Cargo/Empregado**: não precisa de mudança — porque a decisão 4 abaixo impede que um Cargo `RASCUNHO` tenha `EmpregadoHeadcount` vinculado, então não existe custo de Cargo rascunho para somar. Filtro defensivo (`cargo.status === 'COMPLETO'`) adicionado mesmo assim em `CadastrarEmpregadoUseCase`/`CadastrarEmpregadosEmLoteUseCase`, não no cálculo.
4. **`CadastrarEmpregadoUseCase`/`CadastrarEmpregadosEmLoteUseCase` bloqueiam explicitamente** vínculo de Empregado a Cargo `RASCUNHO` — novo erro `CargoRascunhoNaoPodeReceberEmpregadoError` [TRAVA O ERRO]: "Este Cargo está incompleto (Rascunho). Complete o cadastro na aba Cargos (Vínculo Funcional, Conta, Salário) antes de vincular Empregados."
5. **Migration**: `ALTER TABLE "Cargo" ADD COLUMN "status" "StatusCargo" NOT NULL DEFAULT 'COMPLETO'` (backfill automático via default, sem `UPDATE` manual necessário) + `ALTER COLUMN "contaId" DROP NOT NULL`, idem para `salarioMercadoMinimo`, `salarioMercadoMaximo`, `fonteAtiva`, `periodoInicio`. Segura: amplia nullability, não estreita — nenhum Cargo existente perde dado, e nenhuma constraint fica mais restritiva.

### Consequências

- ✅ Cadastro "só nome" fica isolado num use case próprio, sem enfraquecer nenhuma trava do fluxo completo (`CadastrarCargoUseCase`/`EditarCargoUseCase` continuam exigindo tudo).
- ✅ `status` é uma checagem única e explícita — qualquer novo use case que precise decidir "este Cargo conta pra cálculo financeiro?" faz 1 comparação, não precisa lembrar de checar múltiplos campos nulos.
- ⚠️ UI precisa sinalizar visualmente Cargos `RASCUNHO` (badge "Incompleto") na lista da aba Cargos e no seletor da Tabela Salarial, para o usuário saber que precisa completar — sem isso, o Cargo "some" silenciosamente de qualquer cálculo sem explicação visível.
- ⚠️ `codigoCargo` de um Cargo rascunho é definitivo (não muda ao completar) — mesma garantia de unicidade/imutabilidade já existente para Cargo completo.

### Revisão Recomendada

Se o volume de Cargos `RASCUNHO` esquecidos (nunca completados) virar um problema operacional real, considerar um relatório/alerta dedicado — não implementado nesta rodada, YAGNI até haver sinal de necessidade real.
