## [US-132] — Importar Cargo do Rubi (Nome, Salário Real, Faixa e Nível)

**Módulo:** Cadastros — Cargos e Salários (UC03.19, Bloco A/B da Rev. Jun/2026)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** M

**Como** Usuário GRH,
**Quero** buscar um Cargo no Rubi e importar de uma vez Nome do Cargo, Salário Real, Faixa e Nível
(código + descrição), com esses campos ficando Read-only depois de importados,
**Para** cadastrar um Cargo com rastreabilidade completa da origem salarial (RN_CAR_09/REQ_CAR_007)
sem digitar manualmente dados que já existem no ERP, e sem risco de divergência entre o que foi
digitado e o que está no Rubi.

### Contexto e Regras de Negócio

**Histórico:** esta US estava bloqueada desde a criação (2 gaps de arquitetura). Ambos foram
decididos pelo usuário em 2026-08-14:

1. **Sem integração HTTP real com o Rubi ainda.** `CargoRubiFixtureProvider` continua sendo a fonte
   de dados — mesma decisão já usada para o Plano de Contas/Senior. Hoje ele só gera `salarioReal`
   (hash determinístico do nome digitado pelo usuário); passa a gerar também Nome do Cargo, Faixa e
   Nível de forma determinística. Os dados continuam simulados até uma integração real ser
   priorizada — não é escopo desta US.
2. **`Cargo.codigoCargo` continua gerado internamente pelo SGO** (`CARGO-{ano}-{seq}`), não passa a
   vir do Rubi. Sem mudança de fonte de verdade, sem risco de colisão com Cargos já cadastrados.

**Mudança de escopo pedida pelo usuário em 2026-08-14:** a US original só cobria Tabela
Salarial/Faixa/Nível/Salário Real, assumindo que o Nome do Cargo já estava digitado antes da
sincronização. Agora o Nome do Cargo também vem do Rubi — o que exige um fluxo de **busca
explícita**, porque não faz sentido usar o Nome do Cargo como critério de busca de si mesmo.

**Critério de busca da importação (decisão de UX desta US, não uma nova coluna no banco):** o
usuário digita um **termo de busca livre** (nome parcial do cargo ou um código externo do Rubi, ex.
"analista" ou "AN-SIS-003") em um campo de busca dentro do modal "Importar do Rubi". O sistema
consulta o provider (`buscarCargosPorTermo`, novo método do `CargoRubiProvider`) e retorna uma lista
de candidatos (Nome, Tabela Salarial, Faixa, Nível, Salário Real). O usuário escolhe um da lista e
os 4 campos são preenchidos de uma vez. **Não é criado nenhum campo novo persistido** para esse
critério de busca — o termo é só um parâmetro de consulta transiente, nunca gravado no `Cargo`. Essa
escolha evita inventar um "Código Rubi" que não existe no schema atual e que só teria uso nesse
fluxo. **Aponto como decisão do Tech Lead confirmar antes de codificar** — é uma escolha de UX/API,
não uma regra de negócio fechada, e ele pode preferir uma abordagem diferente (ex: dropdown com
lista pré-carregada em vez de busca livre).

Os 6 campos de Tabela Salarial/Faixa/Nível + `salarioReal` **e agora também `nomeCargoMercado`**
passam a ser [ORIGEM BLINDADA] — Read-only absoluto na UI depois de importados, nunca editáveis
diretamente por `CadastrarCargoUseCase`/`EditarCargoUseCase` (RN_CAR_03). Antes da 1ª importação,
`nomeCargoMercado` continua editável normalmente (Cargo "Rascunho", ADR-042, pode nascer só com nome
digitado manualmente e ser importado do Rubi depois — ou já nascer via importação).

### Critérios de Aceite

**Cenário 1 — Buscar e importar um Cargo do Rubi**
```gherkin
Dado que o usuário abre o modal "Importar do Rubi" ao cadastrar ou editar um Cargo
Quando ele digita o termo de busca "Analista de Sistemas"
E o sistema consulta o provider Rubi (fixture, determinístico) e retorna candidatos
Então o sistema exibe uma lista com pelo menos 1 candidato:
  | Nome do Cargo | Tabela Salarial | Faixa | Nível | Salário Real |
Quando o usuário seleciona um candidato da lista
Então o sistema preenche, Read-only:
  | Nome do Cargo   | "Analista de Sistemas Pleno"  |
  | Tabela Salarial | "01 — Tabela Administrativa"  |
  | Faixa           | "A — Faixa Inicial"           |
  | Nível           | "03 — Nível Sênior"           |
  | Salário Real    | R$ (valor determinístico)     |
E um registro de auditoria `CARGO_IMPORTADO_RUBI` é gravado em HistoricoOperacao
```

**Cenário 2 — Busca sem resultados**
```gherkin
Dado que o usuário digita um termo de busca no modal "Importar do Rubi"
Quando o provider Rubi não retorna nenhum candidato para esse termo
Então o sistema exibe "Nenhum cargo encontrado no Rubi para esse termo."
E nenhum campo do Cargo é alterado
```

**Cenário 3 — Bloqueio: tentativa de editar campo soberano após importação**
```gherkin
Dado que o Cargo já tem Nome/Tabela Salarial/Faixa/Nível/Salário Real preenchidos via importação do Rubi
Quando o usuário (ou uma requisição direta à Server Action) tenta enviar um valor diferente para qualquer um desses 5 campos
Então o sistema ignora o valor recebido para esses campos [ORIGEM BLINDADA]
E persiste apenas o valor vindo da última importação do Rubi
```

**Cenário 4 — Reimportar substitui os 5 campos de uma vez**
```gherkin
Dado que o Cargo já foi importado do Rubi anteriormente
Quando o usuário abre "Importar do Rubi" de novo e seleciona um candidato diferente
Então os 5 campos (Nome, Tabela Salarial, Faixa, Nível, Salário Real) são substituídos juntos pelo novo candidato — nunca parcialmente
E um novo registro `CARGO_IMPORTADO_RUBI` é gravado com o valor anterior e o novo
```

**Cenário 5 — Alerta de Desvio de Mercado (REQ_CAR_005 — já coberto pelo domínio existente)**
```gherkin
Dado que o Salário Real do Cargo está fora do intervalo [Salário Mínimo de Mercado, Salário Máximo de Mercado]
Quando a tela de Cargos exibe o Cargo
Então o sistema sinaliza visualmente o desvio (reaproveitar `alertaDesvioMercado`, já implementada em `src/domain/plano-contas/calcularSalarioTotalCargo.ts` desde US-107)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Cargo` — 6 novos campos: `tabSalCodigo`/`tabSalDescricao`/`faixaCodigo`/`faixaDescricao`/`nivelCodigo`/`nivelDescricao` (todos `VARCHAR`, nullable até a 1ª importação). `nomeCargoMercado` já existe, sem mudança de tipo — só passa a ser Read-only depois da 1ª importação. |
| Campos calculados | Nenhum novo — `alertaDesvioMercado` já existe e cobre REQ_CAR_005 |
| Provider | `CargoRubiFixtureProvider` ganha novo método `buscarCargosPorTermo(termo: string): Promise<CandidatoCargoRubi[]>`, determinístico (hash do termo), retornando 1-3 candidatos fictícios com Nome/Tabela/Faixa/Nível/Salário. `buscarSalarioReal` existente pode ser descontinuado em favor do novo método, ou mantido para compatibilidade — decisão do Tech Lead. |
| Migration | Nova, 6 colunas nullable em `Cargo` — sem backfill de dados reais possível sem integração real |
| Regra de negócio | Os 5 campos (Nome, Tabela Salarial, Faixa, Nível, Salário Real) nunca aceitos como input direto em `CadastrarCargoUseCase`/`EditarCargoUseCase` depois da 1ª importação; termo de busca nunca persistido |
| Auditoria | Novo evento `CARGO_IMPORTADO_RUBI` em HistoricoOperacao (valor anterior + novo, mesmo padrão de outros eventos do Cargo) |

### Dependências

- Nenhuma dependência bloqueante restante — os 2 gaps de arquitetura foram decididos.
- **Decisão de UX/Tech Lead pendente antes de codificar:** confirmar o desenho do critério de busca
  (busca livre por termo vs. outra abordagem) — ver seção acima.

### Definition of Done

- [ ] ADR do Tech Lead confirmando o desenho do fluxo de busca/importação
- [ ] Critérios de aceite 1 a 5 implementados
- [ ] Campos soberanos (Nome, Tabela Salarial, Faixa, Nível, Salário Real) comprovadamente Read-only após a 1ª importação (teste tentando enviar valor via Server Action)
- [ ] Busca sem resultados tratada com mensagem clara, sem alterar o Cargo
- [ ] Reimportação testada — substitui os 5 campos juntos, nunca parcialmente
- [ ] Evento `CARGO_IMPORTADO_RUBI` gravado em HistoricoOperacao
- [ ] Alerta de desvio de mercado reaproveitado sem duplicar lógica

---

### Gaps — histórico (resolvidos em 2026-08-14)

1. ~~`Código do Cargo` como ORIGEM BLINDADA do Rubi vs. gerado internamente pelo SGO~~ —
   **resolvido:** continua gerado internamente pelo SGO, sem mudança de fonte de verdade.
2. ~~Integração real com o Rubi ainda não existe~~ — **resolvido:** mantém fixture estendida por
   enquanto; integração HTTP real fica para quando for priorizada, não é escopo desta US.
