## [US-107] — Cadastrar Cargo e Parametrizar Fonte Salarial

**Módulo:** Cadastros — Empregados / Cargos e Salários
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** G

**Como** Gestor de RH (GRH) ou Orçamentista,
**Quero** cadastrar um Cargo vinculado a um nó Analítico da Estrutura Funcional e definir qual fonte salarial (Mercado ou Rubi) será a base de cálculo do headcount,
**Para** que o custo de pessoal do headcount tenha uma origem única, auditável e nunca digitada arbitrariamente.

### Contexto e Regras de Negócio

Esta US cobre o UC03.19 (Cargos e Salários) da Minuta V5, **restrita aos blocos A (Identificação e Vínculo Funcional) e B (Painel de Fontes Salariais)**. O bloco C (Subtela de Gestão de Benefícios e Encargos) fica **explicitamente fora do escopo** — decisão confirmada com o usuário: Benefícios/Encargos é responsabilidade de uma US futura (US-107a, alinhada com UC03.28 "Benefícios" que já existe separado no índice da Minuta), não desta. Isso evita uma US que mistura duas responsabilidades (parametrização salarial vs. custeio de benefícios) e mantém `Cargo` estável enquanto `Beneficio` ainda nem está desenhado.

Achados de qualidade documental do UC03.19 (mesmo cuidado já registrado para UC03.07/03.09/03.10):
- Numeração de Regras de Negócio pula de RN_CAR_01 para RN_CAR_03 — RN_CAR_02 não existe no texto da Minuta. Tratado como lacuna de redação, não como regra perdida.
- REQ_CAR_004/RN_CAR_05 (snapshot no momento da Oficialização do TP) e RN_CAR_06 (alerta de herança quando um benefício é desativado na Tabela Mestre) pertencem ao domínio de Benefícios/Oficialização — não são cenários desta US; revisitar quando US-107a e o fluxo de Oficialização (Módulo de Aprovações) existirem.

Decisões confirmadas com o usuário para esta US:
1. **Salário Real (Rubi) via fixture fictícia** — não há integração real com o ERP Rubi no projeto (mesma situação do Plano de Contas/Senior, que usa `PlanoContasFixtureProvider`). O campo existe, é Read-only na tela, e seu valor vem de um `CargoRubiFixtureProvider` (nome de exemplo — Tech Lead decide) até uma integração real ser especificada. RN_CAR_03 (Imutabilidade Rubi) vale desde já, mesmo com dado fictício.
2. **Vínculo Cargo↔UnidadeFuncional é 1:1 fixo** — um Cargo aponta para exatamente um nó Analítico (`ASSESSOR`, `COORDENADORIA` ou `SETOR`) da Estrutura Funcional (US-106). Rateio percentual entre múltiplas unidades (`CargoAlocacaoPercentual`, mencionado como pendência RN_EST_03 em US-106) **não** é implementado nesta US — fica para quando houver um caso de uso real que exija dividir um cargo entre unidades.
3. **RN_EST_01** (US-106): "todo cargo deve estar vinculado a um nó analítico, bloqueando oficialização se houver cargo órfão" passa a ser parcialmente aplicável agora que `Cargo` existe — mas a checagem de bloqueio de Oficialização em si só é implementável quando o fluxo de Oficialização (Módulo de Aprovações) existir. Nesta US, a obrigatoriedade do vínculo é garantida no cadastro (RN_CAR_01), não na Oficialização.

### Critérios de Aceite

**Cenário 1 — Cadastrar Cargo com sucesso (Fonte Ativa = Mercado)**
```gherkin
Dado que a Proposta "PROP-2026-001" possui uma Estrutura Funcional com o nó Analítico "Setor de Compras" (SETOR)
E não existe nenhum Cargo cadastrado para essa Proposta ainda
Quando o usuário cadastra um Cargo com:
  | Cargo Mercado         | Analista de Compras Pleno |
  | Vínculo Funcional     | Setor de Compras          |
  | Salário Mercado Mínimo| 4500.00                   |
  | Salário Mercado Máximo| 6200.00                   |
  | Fonte Ativa           | MERCADO_MAXIMO            |
Então o Cargo é persistido com "Código do Cargo" gerado automaticamente e Read-only
E o campo "Salário Real (Rubi)" é preenchido pelo fixture provider e exibido como Read-only
E o Cargo aparece na listagem vinculado ao nó "Setor de Compras"
E um registro de auditoria `CARGO_CRIADO` é gravado em `HistoricoOperacao`
```

**Cenário 2 — Bloqueio: Cargo sem Vínculo Funcional [TRAVA O ERRO / RN_CAR_01]**
```gherkin
Dado que o usuário está cadastrando um novo Cargo
Quando ele tenta salvar sem selecionar nenhum nó da Estrutura Funcional
Então o sistema bloqueia o salvamento
E exibe a mensagem "Selecione um vínculo funcional (nó Analítico) antes de salvar o cargo"
E nenhum registro é persistido no banco
```

**Cenário 3 — Bloqueio: vínculo com nó Sintético em vez de Analítico [TRAVA O ERRO]**
```gherkin
Dado que a Proposta possui o nó Sintético "Diretoria Financeira" (DIRETORIA) na Estrutura Funcional
Quando o usuário tenta vincular um Cargo diretamente a "Diretoria Financeira"
Então o sistema bloqueia o salvamento
E exibe a mensagem "Cargo só pode ser vinculado a um nó Analítico (Assessor, Coordenadoria ou Setor)"
E nenhum registro é persistido no banco
```

**Cenário 4 — Bloqueio: tentativa de editar Salário Real (Rubi) manualmente [TRAVA O ERRO / RN_CAR_03]**
```gherkin
Dado que um Cargo já foi cadastrado com "Salário Real (Rubi)" = 5300.00 (vindo do fixture provider)
Quando o usuário tenta submeter uma alteração enviando um valor diferente para "Salário Real (Rubi)"
Então o sistema ignora o valor recebido para esse campo e mantém o valor de origem do fixture provider
E nenhuma alteração é persistida para esse campo
E o restante dos campos editáveis da requisição é processado normalmente
```

**Cenário 5 — Cálculo automático de Salário Total quando há Função Gratificada**
```gherkin
Dado que o usuário está cadastrando um Cargo com "Função Gratificada" preenchida com valor 800.00
E "Salário Mercado Mínimo" = 4500.00 e "Salário Mercado Máximo" = 6200.00
E "Fonte Ativa" = MERCADO_MINIMO
Quando o usuário salva o Cargo
Então o sistema calcula "Salário Total" = 4500.00 + 800.00 = 5300.00
E o campo "Salário Total" é Read-only (calculado, nunca digitado) [ORIGEM BLINDADA]
```

**Cenário 6 — Bloqueio: Oficialização de Proposta sem Fonte Ativa definida em algum Cargo [RN_CAR_04]**
```gherkin
Dado que a Proposta possui ao menos um Cargo cadastrado sem "Fonte Ativa" selecionada
Quando o sistema tenta transicionar a Proposta para o status OFICIALIZADO
Então a Oficialização é bloqueada
E o sistema indica quais Cargos estão sem Fonte Ativa definida
```
*(Nota: este cenário depende do fluxo de Oficialização, ainda não implementado — ver Dependências. Mantido aqui como especificação já validada, não como escopo de código desta US.)*

**Cenário 7 — Alerta de desvio de mercado (RN0005/REQ_CAR_005)**
```gherkin
Dado que um Cargo tem "Salário Real (Rubi)" = 7000.00
E "Salário Mercado Mínimo" = 4500.00 e "Salário Mercado Máximo" = 6200.00
Quando o usuário visualiza o Cargo na listagem ou no formulário
Então o sistema exibe um indicador visual de alerta (fora da faixa de mercado)
E o cadastro não é bloqueado — é apenas um alerta informativo
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nova tabela `Cargo` (nome definitivo a critério do Tech Lead); nenhuma alteração em `UnidadeFuncional` |
| Campos alterados | `Cargo`: nomeCargo, nomeCargoMercado, codigoCargo (gerado), funcaoGratificada (nullable), periodoInicio, unidadeFuncionalId (FK, obrigatório, 1:1 fixo — sem tabela de rateio nesta US), salarioMercadoMinimo, salarioMercadoMaximo, salarioReal (fixture, read-only), salarioTotal (calculado), fonteAtiva (enum), ativo (soft delete) |
| Transação? | Sim — criação/edição do Cargo é atômica; cálculo de `salarioTotal` deve ocorrer na mesma transação de persistência, nunca no client |
| Requer lock? | Não neste momento — Cargo não é editado concorrentemente por múltiplos atores no mesmo fluxo (diferente de ValorOrcadoConta/RateioImpostoGrade, que motivaram US-105). Reavaliar se aparecer esse cenário. |
| Auditoria | Registrar em `HistoricoOperacao`: `CARGO_CRIADO`, `CARGO_EDITADO`, `CARGO_INATIVADO` |
| Regra de negócio | RN_CAR_01 (vínculo obrigatório a nó Analítico), RN_CAR_03 (imutabilidade do Salário Real), cálculo de Salário Total (REQ do bloco B), alerta de desvio de mercado (REQ_CAR_005) |

### Dependências

- **US-106 (Estrutura Funcional)**: Cargo só pode ser vinculado a uma `UnidadeFuncional` já existente e do tipo Analítico — dependência direta, já satisfeita.
- **US-107a (a criar) — Benefícios e Encargos (UC03.28)**: fora de escopo aqui; ficará responsável pelo bloco C do UC03.19.
- **Fluxo de Oficialização (Módulo de Aprovações, ainda não iniciado)**: Cenário 6 (bloqueio de Oficialização sem Fonte Ativa) e RN_CAR_05 (congelamento de snapshot) dependem dele — mantidos como especificação, não como código desta US.
- **US-108 (Empregados)** e **Qtde. Empregado**: dependem de `Cargo` existir — esta US os desbloqueia.

### Definition of Done

- [ ] Critérios de aceite 1 a 5 e 7 implementados e testados (Cenário 6 documentado, não implementado — depende de Oficialização)
- [ ] Vínculo Cargo→UnidadeFuncional aceita apenas nós Analíticos (`ASSESSOR`, `COORDENADORIA`, `SETOR`)
- [ ] Campo Salário Real é sempre Read-only e vem do fixture provider, nunca aceita valor do client
- [ ] Salário Total é sempre calculado no backend, nunca aceito como input direto
- [ ] Log de auditoria gerado para criação/edição/inativação de Cargo
- [ ] Testado com tentativa de vínculo a nó Sintético (deve bloquear)
- [ ] Testado com tentativa de edição manual de Salário Real (deve ser ignorada, não deve quebrar o restante do update)
