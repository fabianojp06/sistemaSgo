## [US-132] — Exibição Consolidada de Tabela Salarial, Faixa, Nível e Salário Real (Rubi)

**Módulo:** Cadastros — Cargos e Salários (UC03.19, Bloco A/B da Rev. Jun/2026)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M
**Bloqueio conhecido:** depende de decisão do usuário sobre a integração real com o Rubi — ver "Gaps e Perguntas de Validação" ao final. Sem essa decisão, esta US só pode ser implementada sobre a fixture já existente (`CargoRubiFixtureProvider`), não sobre dados reais.

**Como** Usuário GRH,
**Quero** ver, ao cadastrar um Cargo, os campos Tabela Salarial, Faixa e Nível (código + descrição) e o Salário Real consolidado com esses 3 componentes, todos vindos do Rubi,
**Para** ter rastreabilidade completa da origem salarial (RN_CAR_09/REQ_CAR_007) sem depender de memória ou de outra tela para saber a que faixa/nível um Salário Real pertence.

### Contexto e Regras de Negócio

Documento de origem: seção 4.1/4.2, RN_CAR_03/09, REQ_CAR_007 (GAP-CAR-001, ✅ resolvido no documento). Hoje o schema (`Cargo.salarioReal`) só tem o valor numérico — não existem os campos `tabSalCodigo`/`tabSalDescricao`/`faixaCodigo`/`faixaDescricao`/`nivelCodigo`/`nivelDescricao` que o documento pede, nem o `codigoCargo` é soberano do Rubi (hoje é **gerado internamente** pelo SGO, `CARGO-{ano}-{seq}` — o documento descreve `codigoCargo` como ORIGEM BLINDADA do Rubi, o que diverge do código atual).

Todos os 6 campos novos + `salarioReal` são [ORIGEM BLINDADA] — Read-only absoluto na UI, nunca editáveis por `CadastrarCargoUseCase`/`EditarCargoUseCase` (RN_CAR_03).

### Critérios de Aceite

**Cenário 1 — Sincronização de Tabela Salarial/Faixa/Nível ao cadastrar Cargo**
```gherkin
Dado que o usuário está cadastrando um novo Cargo com Cargo Mercado = "Analista de Sistemas"
Quando o sistema consulta o provider Rubi (fixture ou integração real, conforme decisão de arquitetura)
Então o sistema exibe, Read-only:
  | Tabela Salarial | "01 — Tabela Administrativa" |
  | Faixa            | "A — Faixa Inicial"          |
  | Nível            | "03 — Nível Sênior"          |
  | Salário Real     | Faixa + Nível + Valor (R$)   |
```

**Cenário 2 — Bloqueio: tentativa de editar campo soberano [TRAVA O ERRO / ORIGEM BLINDADA]**
```gherkin
Dado que o Cargo já tem Tabela Salarial/Faixa/Nível/Salário Real preenchidos pelo Rubi
Quando o usuário (ou uma requisição direta à Server Action) tenta enviar um valor diferente para qualquer um desses 4 campos
Então o sistema ignora o valor recebido para esses campos [ORIGEM BLINDADA]
E persiste apenas o valor vindo do provider Rubi
```

**Cenário 3 — Alerta de Desvio de Mercado (REQ_CAR_005 — já coberto pelo domínio existente)**
```gherkin
Dado que o Salário Real do Cargo está fora do intervalo [Salário Mínimo de Mercado, Salário Máximo de Mercado]
Quando a tela de Cargos exibe o Cargo
Então o sistema sinaliza visualmente o desvio (reaproveitar `alertaDesvioMercado`, já implementada em `src/domain/plano-contas/calcularSalarioTotalCargo.ts` desde US-107)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Cargo` — 6 novos campos: `tabSalCodigo`/`tabSalDescricao`/`faixaCodigo`/`faixaDescricao`/`nivelCodigo`/`nivelDescricao` (todos `VARCHAR`, nullable até a 1ª sincronização) |
| Campos calculados | Nenhum novo — `alertaDesvioMercado` já existe e cobre REQ_CAR_005 |
| Provider | Depende da decisão de arquitetura (ver gap abaixo) — se mantida a fixture, `CargoRubiFixtureProvider` precisa gerar também os 6 campos novos de forma determinística; se integração real, novo provider HTTP |
| Migration | Nova, 6 colunas nullable em `Cargo` — sem backfill de dados reais possível sem a integração |
| Regra de negócio | Os 6 campos + `salarioReal` nunca aceitos como input em `CadastrarCargoUseCase`/`EditarCargoUseCase` |

### Dependências

- Decisão de arquitetura sobre integração real com o Rubi (ver gaps abaixo) — bloqueante antes de codificar

### Definition of Done

- [ ] Critérios de aceite implementados
- [ ] Campos soberanos comprovadamente Read-only (teste tentando enviar valor via Server Action)
- [ ] Alerta de desvio de mercado reaproveitado sem duplicar lógica

---

### ⚠️ Gaps e Perguntas de Validação (bloqueantes antes de codificar)

1. **`Código do Cargo` como ORIGEM BLINDADA do Rubi (documento) vs. gerado internamente pelo SGO (código atual, `CARGO-{ano}-{seq}`).** O documento assume que o Código do Cargo vem do Senior; o sistema atual gera esse código internamente. Confirmar: o SGO passa a *receber* o código do Rubi (mudança de fonte de verdade, com risco de colisão com códigos já gerados internamente em Cargos existentes) ou o documento está descrevendo uma integração ainda não implementada e o código interno continua sendo a fonte enquanto isso?
2. **Integração real com o Rubi ainda não existe.** Hoje `CargoRubiFixtureProvider` é 100% fixture (hash determinístico do nome do cargo), sem chamada HTTP real — mesma decisão já tomada para o Plano de Contas/Senior. Esta US amplia a superfície simulada (6 campos novos). Confirmar se: (a) a US deve estender a fixture (mais rápido, mas todos os 6 campos novos continuam "de mentira"), ou (b) esta é a deixa para iniciar a integração real com o Rubi (esforço maior, mas fecha a dívida de vez).
