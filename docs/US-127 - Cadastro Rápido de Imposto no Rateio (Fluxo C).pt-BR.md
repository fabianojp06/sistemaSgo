## [US-127] — Cadastro Rápido de Imposto no Rateio (Fluxo C)

**Módulo:** Cadastros — Alíquotas de Impostos (consumido a partir de Propostas)
**Épico:** EP118/24
**Prioridade:** Baixa
**Estimativa:** P

**Como** Orçamentista preenchendo o Rateio de Impostos de uma Proposta,
**Quero** cadastrar um novo tributo sem sair da tela da Proposta,
**Para** não perder o contexto do rateio que estou montando quando o imposto que preciso ainda não existe em Alíquotas de Impostos.

### Contexto e Regras de Negócio

Cobre o "Fluxo C" (atalho inline) descrito na Especificação `UC03.39_a_UC03.42_Aliquotas_Impostos.md` para o UC03.01 — Aba Imposto: *"Fluxo C do UC03.01 (modal inline) continua como atalho para cadastro rápido — aponta ao mesmo banco"*. O mesmo atalho já era citado como fora de escopo em `US-101 - Parametrizar Impostos em Proposta do Tipo Contrato.pt-BR.md` (linha 41: *"Cadastrada previamente pelo Módulo de Administração ou via atalho inline [Novo Imposto] (UC03.01, Fluxo Alt. C — fora do escopo desta US)"*), na época em que a Central de Alíquotas (US-123 a US-126) ainda não existia. Com a Central implementada e `CadastrarAliquotaImpostoUseCase` já disponível, este atalho passa a ser viável: reaproveita o mesmo use case, sem duplicar regra de negócio.

**Gatilho concreto:** hoje, em `RateioImpostoPanel.tsx` (tela de Rateio de Impostos da Proposta, US-101/US-101a), o combo "Tributo" só lista alíquotas já cadastradas (`aliquotas: AliquotaOpcao[]`) — se estiver vazio, o painel inteiro é bloqueado com a mensagem *"Nenhum imposto parametrizado neste tenant ainda."* (linha 53-55 do componente), forçando o usuário a abandonar a Proposta, ir em Cadastros > Alíquotas de Impostos, cadastrar, e voltar. Esta US adiciona um atalho `[+ Novo Imposto]` ao lado do combo "Tributo" que abre um modal de cadastro rápido sem sair da tela.

### ⚠️ Decisão em aberto — resolver no refinamento antes de codificar

Não foi decidido se o modal de cadastro rápido usa:
- **(a) Todos os campos** do cadastro completo (US-124): Nome, Alíquota, Tipo de Incidência, Data Início/Fim Vigência, Limites Mín/Máx, Conta Sintética, Observação; ou
- **(b) Um subconjunto reduzido** — só os campos indispensáveis para uso imediato no rateio (Nome, Alíquota, Tipo de Incidência, Data Início Vigência), deixando os demais como `null`/default, editáveis depois via Central de Alíquotas (US-125).

A opção (b) é mais coerente com a natureza de "atalho rápido", mas precisa confirmação do PO/usuário — os cenários abaixo assumem (b) como hipótese de trabalho; ajustar antes de implementar caso a decisão seja (a).

### Critérios de Aceite

**Cenário 1 — Cadastro rápido com sucesso, sem sair da Proposta**
```gherkin
Dado que o usuário está na tela de Rateio de Impostos de uma Proposta (RateioImpostoPanel)
E não existe nenhuma alíquota chamada "IPTU"
Quando o usuário clica em [+ Novo Imposto]
E preenche Nome = "IPTU", Alíquota = 1.00, Tipo de Incidência = AMBOS, Data Início = hoje
E clica em [Salvar] no modal
Então o sistema persiste o registro em AliquotaImpostoParametro com ativo = TRUE, usando o mesmo CadastrarAliquotaImpostoUseCase de US-124
E grava log ALIQUOTA_IMPOSTO_CRIADA em HistoricoOperacao na mesma transação [RN0232]
E o modal fecha automaticamente
E o combo "Tributo" do Rateio é atualizado e já vem com "IPTU" pré-selecionado
E o usuário permanece na tela do Rateio de Impostos, sem perder o preenchimento de Conta Analítica/Competência/Valor já em andamento
```

**Cenário 2 — Bloqueio: nome duplicado (case-insensitive) [TRAVA O ERRO]**
```gherkin
Dado que já existe a alíquota "ISS" cadastrada
E o usuário abriu o modal [+ Novo Imposto] a partir do Rateio de Impostos
Quando ele tenta cadastrar "iss" (minúsculo)
Então o sistema bloqueia com "Operação Rejeitada [TRAVA O ERRO]: Já existe uma alíquota cadastrada com o nome iss. Utilize um nome único." (mesma mensagem de US-124, Cenário 2)
E nenhum registro é persistido
E o modal permanece aberto para correção
```

**Cenário 3 — Bloqueio: alíquota de ISS fora da faixa legal [TRAVA O ERRO / RN_IMP_006]**
```gherkin
Dado que o usuário está cadastrando, via modal inline, uma alíquota com Nome = "ISS"
Quando ele informa Alíquota = 6.50
E clica em [Salvar]
Então o sistema bloqueia com "Alíquota de ISS Inválida [TRAVA O ERRO]: A alíquota de ISS deve estar entre 2,00% e 5,00% conforme a LC 116/2003." (mesma validação de US-124, reaproveitada do use case)
E nenhum registro é persistido
```

**Cenário 4 — Bloqueio: usuário sem permissão de cadastro**
```gherkin
Dado que o usuário tem permissão de acesso ao Rateio de Impostos da Proposta (plano-contas.configurar-rateio-imposto)
Mas não tem a permissão aliquotas-impostos.criar
Quando ele acessa a tela de Rateio de Impostos
Então o botão [+ Novo Imposto] não é exibido
E, se o combo "Tributo" estiver vazio, a mensagem de bloqueio atual ("Nenhum imposto parametrizado neste tenant ainda.") permanece sem atalho de cadastro
```

**Cenário 5 — Cancelar o modal preserva o estado do Rateio**
```gherkin
Dado que o usuário já preencheu Conta Analítica, Competência e Valor Declarado no Rateio
E abriu o modal [+ Novo Imposto]
Quando ele clica em [Cancelar] no modal, sem salvar
Então o modal fecha
E nenhum registro é persistido
E os campos já preenchidos no Rateio de Impostos (Conta Analítica, Competência, Valor Declarado) continuam intactos
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | Nenhuma nova — reaproveita `AliquotaImpostoParametro` (US-124/ADR-038), sem migration própria |
| Componentes | Novo modal (ex: `NovoImpostoInlineModal.tsx`) invocado a partir de `RateioImpostoPanel.tsx`; reaproveita a Server Action `cadastrarAliquotaImposto` já existente em `src/app/aliquotas-impostos/actions.ts` — **não duplicar** lógica de validação |
| Transação? | Mesma transação já implementada em `CadastrarAliquotaImpostoUseCase` (INSERT + `HistoricoOperacao`) — nenhuma mudança de protocolo transacional |
| Requer lock? | Não (mesma natureza de criação da US-124) |
| Auditoria | `ALIQUOTA_IMPOSTO_CRIADA` (idêntico à US-124 — não há tipo de operação novo, é o mesmo cadastro por uma via de acesso diferente) |
| Permissão | Reaproveita `aliquotas-impostos.criar` (US-124/US-123) — **não criar permissão nova**; usuário precisa das duas permissões (rateio + criar alíquota) para ver o atalho |
| Refresh de dados | Após salvar, `RateioImpostoPanel` precisa recarregar a lista `aliquotas` (revalidação ou refetch) e pré-selecionar o item recém-criado — hoje a lista é recebida via prop, então avaliar se passa a ser buscada client-side ou se o componente pai precisa de `revalidatePath` |

### Dependências

- **US-124 (Cadastrar Alíquota de Imposto)**: fornece o use case e a Server Action reaproveitados aqui — pré-requisito direto.
- **US-101/US-101a (Rateio de Impostos)**: fornece a tela (`RateioImpostoPanel.tsx`) onde o atalho é inserido.
- **Decisão em aberto** (ver seção acima): campos completos vs. reduzidos no modal — bloqueia o início da codificação até ser resolvida em refinamento.

### Definition of Done

- [ ] Decisão de escopo dos campos do modal (completo vs. reduzido) tomada e registrada antes da codificação
- [ ] Critérios de aceite 1 a 5 implementados e testados
- [ ] Nenhuma regra de validação duplicada — modal chama a mesma Server Action/use case de US-124
- [ ] Botão `[+ Novo Imposto]` só aparece para quem tem `aliquotas-impostos.criar`
- [ ] Após cadastro, a alíquota nova aparece pré-selecionada no combo "Tributo" sem recarregar a página
- [ ] Cancelar o modal não altera nenhum campo já preenchido no Rateio de Impostos
- [ ] Testado com nome duplicado (case-insensitive) e com ISS fora da faixa 2–5%, reaproveitando as mesmas mensagens de erro de US-124
