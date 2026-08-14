## [US-136] — Periculosidade e Insalubridade do Cargo

**Módulo:** Cadastros — Cargos e Salários (Tabela Mestre de Benefícios e Encargos)
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** M

**Como** Gestor de RH (GRH),
**Quero** registrar Periculosidade e Insalubridade de um Cargo, cada um como percentual sobre o salário ou como valor fixo em R$,
**Para** que o custo real do headcount reflita esses adicionais sem exigir uma planilha paralela fora do sistema.

### Contexto e Regras de Negócio

Pedido do usuário em 2026-08-14: dois novos campos no bloco de Encargos e Benefícios do Cargo
(`CargoPanel.tsx`), ao lado de VA/VR/Plano de Saúde/Plano Odontológico/Seguro de Vida/Auxílio
Creche/Vale Transporte (US-107a, ADR-019/020).

**Decisão já fechada com o usuário (via pergunta de esclarecimento):** cada campo — Periculosidade
e Insalubridade — tem **escolha única de tipo de entrada por preenchimento**: percentual (aplicado
sobre o salário) OU valor fixo em R$, nunca os dois ao mesmo tempo para o mesmo campo. Mesmo padrão
já usado em `Cargo.origemSalarioMinimo`/`origemSalarioMaximo` (enum `OrigemSalarioMercado`:
`MANUAL` vs. `TABELA_SALARIAL`) — aqui o enum seria algo como `TipoValorAdicional`: `PERCENTUAL` vs.
`VALOR_FIXO`.

**Nota deliberada de contexto legal (não travada no código):** na CLT, Periculosidade é tipicamente
30% sobre o salário-base e Insalubridade é 10/20/40% sobre o salário-mínimo (grau mínimo/médio/
máximo), a depender de laudo técnico (NR-15/16). O SGO 2.0 atende também OSCIPs com Termo de
Parceria, que podem ter política de pessoal própria não idêntica à CLT — por isso este documento
**não assume esses percentuais como regra do sistema**; o usuário digita o percentual ou valor que
julgar aplicável ao Cargo. Se no futuro for necessário travar os percentuais legais como sugestão
ou validação, isso é uma US separada.

**Decisões que ainda NÃO foram tomadas e precisam ir para o Tech Lead (`techlead-fsg`) antes da
implementação — este documento intencionalmente não resolve sozinho, por envolver o cálculo de
custo do Cargo, já auditado e testado (US-107a):**

1. **Base de cálculo do percentual.** Aplicado sobre `salarioTotal` (salário + gratificação, ADR-016)
   ou sobre um "salário-base" mais estrito? Hoje o Cargo não distingue os dois — `salarioTotal` é o
   único campo salarial calculado.
2. **Entram no `custoTotalCargo`?** US-107a definiu `custoTotalCargo = salarioTotal + Encargos +
   Benefícios`. Periculosidade/Insalubridade são um adicional salarial (deveria compor `salarioTotal`
   antes de aplicar Encargos Sociais sobre ele) ou um benefício adicional (somado depois, como VA/VR)?
   Isso muda o valor de Encargos Sociais calculado, porque hoje ele incide sobre `salarioTotal`.
3. **Conta contábil analítica própria**, como os 9 componentes de custo já existentes (ADR-029:
   `contaGratificacaoId`, `contaEncargosSociaisId`, etc.) — ou ficam sem conta própria?
4. **Cumulatividade.** Um mesmo Cargo pode ter Periculosidade E Insalubridade simultaneamente
   (juridicamente a CLT normalmente veda cumulação, exige escolha do mais vantajoso), ou o sistema
   permite os dois ativos ao mesmo tempo sem validação cruzada? Pedido do usuário não menciona
   exclusividade entre os dois campos, só o tipo de entrada dentro de cada campo.
5. **Nome exato dos campos no schema** — sugestão: `periculosidadeAtivo`/`periculosidadeTipo`
   (enum)/`periculosidadeValor` (Decimal, percentual OU R$ conforme o tipo) e o mesmo padrão para
   `insalubridade*`, seguindo a convenção `*Ativo`/`*Valor` já usada em VA/VR/etc.
6. **Retroatividade sobre Cargos existentes.** Cargos já cadastrados ficam com os dois campos
   inativos por padrão (sem impacto no `custoTotalCargo` já calculado), correto?

### Critérios de Aceite

Os cenários abaixo assumem as decisões acima **ainda não fechadas** — servem para validar o
desenho funcional com o usuário; os valores de `custoTotalCargo` nos exemplos ficam com `[A DEFINIR
PELO TECH LEAD]` onde depende da decisão #2.

**Cenário 1 — Configurar Periculosidade como percentual sobre o salário**
```gherkin
Dado que o Cargo "CARGO-2026-0001" tem salarioTotal = 6200.00
Quando o usuário ativa Periculosidade, escolhe tipo "Percentual" e informa 30.00
Então o sistema calcula o valor de Periculosidade = 6200.00 × 30% = 1860.00
E armazena o tipo escolhido (PERCENTUAL) e o percentual informado (30.00)
E [A DEFINIR PELO TECH LEAD] inclui ou não esse valor no recálculo de custoTotalCargo
```

**Cenário 2 — Configurar Insalubridade como valor fixo em R$**
```gherkin
Dado que o Cargo "CARGO-2026-0002" está sendo configurado
Quando o usuário ativa Insalubridade, escolhe tipo "Valor Fixo" e informa 250.00
Então o sistema armazena o valor de Insalubridade = 250.00, sem aplicar percentual sobre o salário
E armazena o tipo escolhido (VALOR_FIXO)
```

**Cenário 3 — Bloqueio: percentual fora da faixa 0-100%**
```gherkin
Dado que o usuário escolheu tipo "Percentual" para Periculosidade
Quando ele tenta salvar com 150.00
Então o sistema bloqueia o salvamento
E exibe a mensagem "Percentual de Periculosidade deve estar entre 0 e 100."
```
(Mesma regra para Insalubridade, mesma mensagem trocando o nome do campo.)

**Cenário 4 — Bloqueio: valor negativo em qualquer tipo**
```gherkin
Dado que o usuário está configurando Periculosidade ou Insalubridade, em qualquer tipo (% ou R$)
Quando ele tenta salvar com valor negativo
Então o sistema bloqueia o salvamento
E exibe a mensagem "Valores de Periculosidade/Insalubridade não podem ser negativos."
```

**Cenário 5 — Trocar o tipo de entrada limpa o valor anterior**
```gherkin
Dado que Periculosidade está configurada como Percentual = 30.00
Quando o usuário troca o tipo para "Valor Fixo"
Então o campo de valor é reiniciado (não reaproveita 30.00 como R$ 30,00 por engano)
E o usuário precisa informar o novo valor fixo antes de salvar
```

**Cenário 6 — Benefício inativo não entra em nenhum cálculo**
```gherkin
Dado que Periculosidade está desativada no Cargo
Quando o sistema calcula custoTotalCargo (ou o campo equivalente definido pelo Tech Lead)
Então o valor de Periculosidade não é somado, mesmo que tenha valor/percentual preenchido de uma configuração anterior
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas/campos afetados | `Cargo`: novos campos, nomenclatura e tipos **a confirmar com Tech Lead** (ver decisão #5) — provisoriamente `periculosidadeAtivo` (Boolean), `periculosidadeTipo` (enum `TipoValorAdicional`), `periculosidadeValor` (Decimal 15,2 — percentual 0-100 ou R$ conforme o tipo), e o mesmo trio para `insalubridade*` |
| Transação? | Sim — mesma transação de escrita do Cargo, mesmo padrão de US-107a |
| Requer lock? | Não — sem concorrência relevante, mesma linha de raciocínio de US-107a |
| Auditoria | Reaproveitar `CARGO_BENEFICIOS_CONFIGURADOS`/`CARGO_BENEFICIOS_EDITADOS` (HistoricoOperacao) ou criar evento próprio — **decisão do Tech Lead** |
| Regra de negócio | Percentual entre 0-100 quando tipo=PERCENTUAL; valor não-negativo em qualquer tipo; troca de tipo reinicia o valor; ver decisões #1, #2, #4 em aberto antes de codificar o cálculo |

### Dependências

- **US-107a (Benefícios do Cargo, ADR-019)**: esta US estende o mesmo bloco e reaproveita seu
  padrão de campos `*Ativo`/`*Valor`.
- **ADR do Tech Lead**: bloqueante — as 6 decisões acima precisam de ADR antes do `fullstack-dev`
  iniciar a implementação (mesmo fluxo já usado nas US anteriores deste módulo: refinamento → ADR →
  código).

### Definition of Done

- [ ] ADR do Tech Lead resolvendo as 6 decisões em aberto
- [ ] Critérios de aceite 1 a 6 implementados e testados
- [ ] Testado com percentual fora da faixa 0-100 (deve bloquear)
- [ ] Testado com valor negativo em ambos os tipos (deve bloquear)
- [ ] Testado com troca de tipo de entrada (deve reiniciar o valor, não reinterpretar)
- [ ] Testado com o campo inativo (não deve entrar em nenhum cálculo)
- [ ] Migration segura (campos novos, nullable ou com default, sem quebrar Cargos existentes)
