## [US-107a] — Tabela Mestre de Benefícios e Encargos do Cargo

**Módulo:** Cadastros — Cargos e Salários (Tabela Mestre)
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Gestor de RH (GRH),
**Quero** parametrizar Encargos Sociais e o checklist de Benefícios (VA, VR, Saúde, Odonto, Vida, Creche) de um Cargo, com o custo total calculado automaticamente,
**Para** que o custo real de um headcount (salário + encargos + benefícios) seja sempre auditável e nunca digitado como um número solto.

### Contexto e Regras de Negócio

Esta US cobre o bloco C ("Subtela: Gestão de Benefícios e Encargos") do UC03.19 da Minuta V5 — a parte que ficou fora de escopo quando US-107 foi refinada.

**Achado de qualidade documental (correção de um erro meu anterior):** eu havia associado esta US ao UC03.28 da Minuta. Está errado — **UC03.28 ("Benefícios") descreve a Elegibilidade Individual do Empregado** (o mesmo conteúdo do modal do UC03.24, Fluxo Alternativo A1), que é o escopo de **US-108a**, não desta US. A Tabela Mestre de Benefícios do Cargo (o que esta US de fato cobre) **não tem UC próprio numerado na Minuta V5** — está embutida como um bloco sem numeração dentro do próprio UC03.19. Registrado para não confundir de novo: UC03.28 = US-108a; bloco C do UC03.19 (sem número) = US-107a.

Decisões fechadas com o usuário para esta US:

1. **Novo campo `Cargo.custoTotalCargo`**, calculado = `salarioTotal` (já existente, US-107) + Encargos Sociais + soma dos Benefícios ativos. `Cargo.salarioTotal` **não muda de significado** — continua sendo só salário + gratificação, como definido no ADR-016. `custoTotalCargo` é o novo "custo pleno" do cargo.
2. **`EmpregadoHeadcount.custoTotalMensal` (US-108, ADR-018) passa a herdar `custoTotalCargo`, não mais `salarioTotal`**, a partir desta US — ajuste pontual no use case de Cargo→Empregado, sem mudar o desenho de snapshot congelado já decidido em ADR-018.
3. **Sem tabela de parâmetros globais de Benefícios/Encargos.** O percentual de Encargos Sociais e os valores de VA/VR/Saúde/Odonto/Vida/Creche são **digitados diretamente em cada Cargo** — não existe uma "Tabela Mestre de Parâmetros" central da qual os valores são herdados. Isso diverge da leitura literal da Minuta ("percentual padrão configurado nos Parâmetros"), mas evita construir um módulo de Parâmetros inteiro para esta US.
4. **Exceção: "Dias Úteis" é parametrizado por tenant**, não digitado por Cargo — reaproveita o model `ParametroSistema` já existente (`tenantId @id, limiteTentativasLogin, flagManutencao`), adicionando um campo `diasUteisPadrao` (Int, default 22). Usado na fórmula de VA/VR (`valorUnitario × diasUteisPadrao`).
5. **RN_CAR_06 (alerta de mudança retroativa quando um benefício é desativado) fica fora de escopo** — exige um mecanismo de notificação entre módulos que não existe ainda. Revisitar quando houver um caso de uso real de alteração de Cargo já vinculado a Empregados.

### Critérios de Aceite

**Cenário 1 — Parametrizar Encargos e Benefícios de um Cargo, com custo total calculado**
```gherkin
Dado que o Cargo "CARGO-2026-0001" tem salarioTotal = 6200.00 (já existente)
E o parâmetro diasUteisPadrao do tenant é 22
Quando o usuário configura no Cargo:
  | Encargos Sociais (%) | 68.00                  |
  | Vale Alimentação     | ativo, valorUnitario=30.00 |
  | Vale Refeição        | ativo, valorUnitario=25.00 |
  | Plano de Saúde       | ativo, faixa=INTERMEDIARIO, valor=450.00 |
  | Plano Odontológico   | inativo                |
  | Seguro de Vida       | ativo, valor=40.00     |
  | Auxílio Creche       | inativo                |
Então o sistema calcula:
  - Encargos = 6200.00 × 68% = 4216.00
  - VA = 30.00 × 22 = 660.00
  - VR = 25.00 × 22 = 550.00
  - Total de Benefícios = 660.00 + 550.00 + 450.00 + 40.00 = 1700.00
  - custoTotalCargo = 6200.00 + 4216.00 + 1700.00 = 12116.00
E custoTotalCargo é persistido como Read-only (calculado, nunca digitado) [ORIGEM BLINDADA]
E um registro de auditoria `CARGO_BENEFICIOS_CONFIGURADOS` é gravado em HistoricoOperacao
```

**Cenário 2 — Benefício inativo não entra no cálculo**
```gherkin
Dado que o Plano Odontológico e o Auxílio Creche estão marcados como inativos no Cargo
Quando o sistema calcula o Total de Benefícios
Então os valores desses dois itens não são somados, mesmo que tenham valorUnitario preenchido
```

**Cenário 3 — Bloqueio: Encargos Sociais fora da faixa 0-100%**
```gherkin
Dado que o usuário está configurando os Encargos Sociais de um Cargo
Quando ele tenta salvar com um percentual de 150%
Então o sistema bloqueia o salvamento
E exibe a mensagem "Percentual de Encargos Sociais deve estar entre 0 e 100."
```

**Cenário 4 — Bloqueio: valor negativo em qualquer benefício**
```gherkin
Dado que o usuário está configurando o Vale Alimentação de um Cargo
Quando ele tenta salvar com valorUnitario = -10.00
Então o sistema bloqueia o salvamento
E exibe a mensagem "Valores de benefícios não podem ser negativos."
```

**Cenário 5 — Alteração recalcula custoTotalCargo automaticamente**
```gherkin
Dado que o Cargo já possui Encargos/Benefícios configurados, com custoTotalCargo = 12116.00
Quando o usuário altera o percentual de Encargos Sociais para 70%
Então o sistema recalcula custoTotalCargo com o novo percentual
E um registro de auditoria `CARGO_BENEFICIOS_EDITADOS` é gravado com o valor anterior e o novo
```

**Cenário 6 — Bloqueio: tentativa de editar custoTotalCargo manualmente [TRAVA O ERRO]**
```gherkin
Dado que um Cargo já tem custoTotalCargo = 12116.00 (calculado)
Quando o usuário tenta submeter um valor diferente diretamente para custoTotalCargo
Então o sistema ignora o valor recebido para esse campo
E recalcula custoTotalCargo a partir dos componentes (salarioTotal + encargos + benefícios)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas/campos afetados | `Cargo`: novos campos `encargosSociaisPct` (Decimal 5,2), `vaAtivo`/`vaValorUnitario`, `vrAtivo`/`vrValorUnitario`, `planoSaudeAtivo`/`planoSaudeFaixa`(enum)/`planoSaudeValor`, `planoOdontoAtivo`/`planoOdontoValor`, `seguroVidaAtivo`/`seguroVidaValor`, `auxilioCrecheAtivo`/`auxilioCrecheValor`, `custoTotalCargo` (Decimal 15,2, calculado). `ParametroSistema`: novo campo `diasUteisPadrao` (Int, default 22). |
| Transação? | Sim — cálculo de `custoTotalCargo` na mesma transação da escrita |
| Requer lock? | Não — mesma simplicidade transacional de Cargo/US-107, sem concorrência relevante |
| Auditoria | `CARGO_BENEFICIOS_CONFIGURADOS`, `CARGO_BENEFICIOS_EDITADOS` em HistoricoOperacao |
| Regra de negócio | Percentual de Encargos entre 0-100; valores de benefícios não-negativos; VA/VR = valorUnitario × diasUteisPadrao do tenant; custoTotalCargo sempre recalculado, nunca input direto |

### Dependências

- **US-107 (Cargo)**: satisfeita — esta US estende o model existente.
- **US-108 (Empregado)**: precisa de um ajuste pontual — `EditarEmpregadoUseCase`/`CadastrarEmpregadoUseCase` passam a herdar `custoTotalCargo` em vez de `salarioTotal`.
- **US-108a (Elegibilidade individual, UC03.28)**: consumirá os valores desta Tabela Mestre como Read-only na modal do Empregado — dependência natural, não retrabalho.

### Definition of Done

- [ ] Critérios de aceite 1 a 6 implementados e testados
- [ ] `custoTotalCargo` sempre calculado no backend, nunca aceito como input direto
- [ ] `CadastrarEmpregadoUseCase`/`EditarEmpregadoUseCase` (US-108) atualizados para herdar `custoTotalCargo`
- [ ] `diasUteisPadrao` adicionado a `ParametroSistema`, com valor default 22
- [ ] Testado com benefício inativo (não deve entrar na soma)
- [ ] Testado com percentual de encargos fora da faixa (deve bloquear)
- [ ] Testado com tentativa de edição manual de custoTotalCargo (deve ser ignorada)
