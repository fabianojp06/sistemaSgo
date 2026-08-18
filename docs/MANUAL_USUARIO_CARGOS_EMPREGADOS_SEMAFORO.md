# Manual do Usuário — Estrutura Funcional, Cargos, Empregados e Semáforo Orçamentário

Este manual explica como usar as quatro telas de Recursos Humanos e acompanhamento orçamentário
de uma Proposta: **Estrutura Funcional (Organograma)**, **Cargos**, **Empregados** e **Semáforo
Orçamentário**.

Todas ficam dentro de uma Proposta (Termo de Parceria/Contrato), nas abas:

`Proposta > Estrutura` (Organograma, Cargos e Tabela Salarial) · `Proposta > Empregados` ·
`Proposta > Semáforo`

> As telas estão ligadas entre si: o Cargo precisa de uma Unidade Funcional para existir
> completamente, o custo de um Empregado vem do Cargo em que ele está alocado, e o Semáforo
> mostra o quanto desse custo já está "realizado" (lançado) em cada conta orçamentária, comparado
> ao valor orçado para ela.

---

## Ordem Correta de Cadastro

Antes de detalhar cada tela, siga esta ordem — ela evita retrabalho e mensagens de bloqueio nas
etapas seguintes:

1. **Estrutura Funcional (Organograma)** — cadastre ao menos uma Unidade Funcional do tipo
   Analítico (Assessoria, Coordenadoria ou Setor). Um Cargo só pode ser completado depois de
   vinculado a uma dessas unidades.
2. **Tabela Salarial** — cadastre o Cargo por aqui informando só o nome. Ele entra no sistema
   como **Rascunho**.
3. **Cargos** — encontre o Cargo criado (marcado com a etiqueta "Rascunho") e complete o
   cadastro: Vínculo Funcional, Conta Contábil, Salário e, se for o caso, Benefícios e Encargos.
4. **Empregados** — só depois do Cargo estar completo (sem a etiqueta "Rascunho") é possível
   alocar Empregados nele, porque cada Empregado herda o custo já calculado do Cargo.

**Isso é uma recomendação de uso, não um bloqueio rígido do sistema em todas as etapas** — hoje
existem alertas que ajudam a não pular passos, mas nem toda etapa fora de ordem é impedida
tecnicamente:

- Se você tentar **completar/editar** um Cargo na aba Cargos sem nenhuma Unidade Funcional
  Analítica cadastrada, o sistema mostra um aviso pedindo para cadastrar a Unidade primeiro (na
  sub-aba Organograma) antes de salvar.
- Um Cargo criado só pela Tabela Salarial fica visível na lista de Cargos com a etiqueta
  **"Rascunho"**, sinalizando que o cadastro ainda precisa ser completado na aba Cargos.

---

## 0. Estrutura Funcional (Organograma)

### O que é

O organograma da Proposta: a árvore de Unidades Funcionais (Diretorias, Gerências,
Assessorias, Coordenadorias e Setores) onde os Cargos são alocados.

### Onde encontrar

`Proposta > Estrutura`, sub-aba **"Estrutura Funcional (Organograma)"** (aberta por padrão).

### Tipos de unidade

| Tipo | Categoria | Pode ter Cargo vinculado? |
|---|---|---|
| Diretoria | Sintético | Não — serve só para organizar a árvore |
| Gerência | Sintético | Não — serve só para organizar a árvore |
| Assessoria | Analítico | Sim |
| Coordenadoria | Analítico | Sim |
| Setor | Analítico | Sim |

Só unidades do tipo **Analítico** (Assessoria, Coordenadoria, Setor) podem receber um Cargo. As
unidades Sintéticas (Diretoria, Gerência) existem apenas para organizar a hierarquia.

### Cadastrar uma Unidade Funcional

1. Preencha **Nome** e escolha o **Tipo**.
2. Se o tipo escolhido exigir uma unidade "pai" (toda unidade Analítica precisa estar dentro de
   uma Sintética), escolha-a na lista — só aparecem as unidades compatíveis com o tipo
   selecionado. Diretorias e Gerências não têm pai (são raiz da árvore).
3. Clique em **Cadastrar** (ou equivalente).

### Importar de outra Proposta

Se outra Proposta já tem a estrutura pronta, clique em **"Importar de outra Proposta"**, escolha
a Proposta de origem e confirme. A importação **substitui** a estrutura toda da Proposta atual
pela da origem — não é uma mesclagem.

### Inativar uma Unidade

Cada unidade da árvore pode ser inativada individualmente quando não for mais usada.

---

## 1. Tabela Salarial

### O que é

Tela para consultar as faixas salariais de mercado por Senioridade, e também o atalho mais rápido
para **criar um novo Cargo** (como Rascunho) sem sair do modal.

### Onde encontrar

`Proposta > Estrutura`, sub-aba **"Tabela Salarial"**.

### Cadastrar um Cargo por aqui

1. No campo **"Cadastrar Cargo"**, digite o **Nome do Cargo (Mercado)**.
2. Clique em **Cadastrar Cargo**.

O Cargo é criado com esse nome apenas — ele aparece na aba **Cargos** com a etiqueta
**"Rascunho"** até que o cadastro seja completado lá (Vínculo Funcional, Conta, Salário).

### Atribuir Senioridade e Faixa Salarial

Depois de cadastrado (ou selecionando um Cargo já existente), você pode:

- Cadastrar uma nova **Senioridade** (ex: "Especialista"), se a que você precisa ainda não
  existir.
- Cadastrar a **Faixa Salarial** (Salário Mínimo e Salário Máximo) daquele Cargo para a
  Senioridade escolhida.

Essas faixas ficam disponíveis para consulta e podem ser usadas para preencher o Salário Mercado
Mínimo/Máximo do Cargo na aba Cargos.

---

## 2. Cargos

### O que é

Um Cargo representa uma função de mercado (ex: "Analista de Requisitos") com seu salário, os
benefícios que a Proposta paga para quem ocupa esse Cargo (vale-alimentação, plano de saúde
etc.) e a Unidade Funcional (setor/coordenadoria) onde o custo dele é lançado.

### Onde encontrar

`Proposta > Estrutura`, sub-aba **"Cargos"**.

No topo da tela aparece um resumo com o **Total de Cargos**, o **Custo Total Mensal** e o
**Salário Total Mensal** de todos os Cargos cadastrados.

Na lista, um Cargo criado só pela Tabela Salarial (sem Vínculo Funcional/Conta/Salário ainda
completados) aparece com a etiqueta **"Rascunho"** ao lado do nome.

### Completar ou cadastrar um Cargo

1. Se o Cargo já existe como Rascunho, clique em **Editar** na linha dele. Caso contrário,
   preencha o formulário **"Novo Cargo"** na parte de baixo da tela.
2. Em **Identificação e Mercado**, preencha:
   - **Nome do Cargo (Mercado)** — obrigatório.
   - **Conta Contábil (natureza da despesa)** — a conta orçamentária onde o custo desse Cargo
     será lançado. Obrigatória.
   - **Período Início** — obrigatório.
   - **Salário Mercado Mínimo** e **Salário Mercado Máximo** — obrigatórios. Podem ser digitados
     manualmente ou preenchidos a partir da Tabela Salarial (botão "Tabela Salarial" ao lado do
     campo Salário Máximo).
   - **Função Gratificada** (opcional) e a conta correspondente, se houver gratificação.
3. Em **Vínculo Funcional**, escolha a Unidade Funcional Analítica onde o custo desse Cargo é
   lançado integralmente. Se nenhuma Unidade Analítica estiver cadastrada ainda, um aviso pede
   para cadastrá-la primeiro na sub-aba Organograma.
4. Em **Benefícios e Encargos**, informe o percentual de **Encargos Sociais** e marque cada
   benefício que esse Cargo tem direito (Vale Alimentação, Vale Refeição, Vale Transporte, Plano
   de Saúde, Plano Odontológico, Seguro de Vida, Auxílio Creche) e os adicionais de
   **Periculosidade**/**Insalubridade** (cada um como percentual sobre o salário ou valor fixo,
   nunca os dois ao mesmo tempo), informando o valor de cada um. Para cada item marcado, escolha
   também a **conta orçamentária** onde aquele custo específico deve ser lançado.
5. No painel lateral, escolha a **Fonte Ativa** (de onde vem o salário usado no cálculo: Mercado
   Mínimo, Mercado Máximo ou Rubi/Salário Real) e acompanhe o **Custo do Cargo (ao vivo)** —
   Salário Total e Custo Total são recalculados a cada campo alterado, antes mesmo de salvar.
6. Clique em **Salvar Cargo**.

### Importar do Rubi

Se o Cargo corresponde a um cargo já cadastrado no sistema Rubi/CTCEA, use o botão **"Importar do
Rubi"** (ou "Reimportar do Rubi", se já importado) no painel lateral para trazer Faixa, Nível e
Salário Real automaticamente. O nome que você digitou em "Nome do Cargo (Mercado)" não é alterado
pela importação — o nome vindo do Rubi fica visível separadamente como "Nome Cargo CTCEA" no
painel.

### Editar um Cargo existente

Clique em **Editar** na linha do Cargo, na tabela. O formulário é preenchido com os dados atuais
— altere o que precisar e clique em **Salvar Cargo** novamente.

> **Importante:** alterar os benefícios de um Cargo **não atualiza automaticamente** os
> Empregados que já estavam cadastrados nele antes da mudança. Veja "Ressincronizar Empregados"
> abaixo.

### Ressincronizar Empregados

Quando você edita um Cargo (contas de benefício, valores) e ele **já tem Empregados
cadastrados**, aparece o botão **Ressincronizar Empregados** ao lado de "Salvar Cargo". Clique
nele para que os Empregados já existentes desse Cargo passem a usar os valores/contas
atualizados. Depois de clicar, a tela mostra quantos Empregados foram atualizados.

- Se a Proposta já estiver oficializada (fechada para edição), os Empregados dela **não são
  alterados** — o sistema avisa quantos foram ignorados por esse motivo.
- Empregados cadastrados **depois** da mudança já nascem com os valores certos — não precisam
  de ressincronização.

### Excluir um Cargo

**Individual:** clique em **Excluir** na linha do Cargo. Uma confirmação aparece antes da
exclusão.

**Em lote (vários de uma vez):** marque a caixa de seleção de cada Cargo que deseja excluir (ou
use a caixa no cabeçalho da tabela para marcar todos), depois clique em **Excluir Selecionados
(N)** — o número entre parênteses mostra quantos estão marcados.

**Regra importante:** um Cargo **não pode ser excluído se tiver Empregados vinculados a ele**.
Se você tentar, o sistema recusa e mostra o nome do Cargo bloqueado. Nesse caso, vá até a tela
Empregados, exclua (ou mude o Cargo) dos Empregados vinculados, e tente excluir o Cargo de novo.

Na exclusão em lote, se **qualquer um** dos Cargos selecionados tiver Empregados vinculados, a
exclusão inteira é recusada — nenhum dos Cargos selecionados é excluído, mesmo os que não têm
Empregados. A mensagem de erro lista quais Cargos bloquearam, para você desmarcá-los e tentar de
novo só com os demais.

Também não é possível excluir Cargos de uma Proposta que já foi oficializada/fechada.

### Campos e regras — resumo

| Campo | Obrigatório | Regra |
|---|---|---|
| Nome do Cargo (Mercado) | Sim | Nunca sobrescrito pela importação do Rubi |
| Conta Contábil | Sim | Onde o salário do Cargo é lançado |
| Período Início | Sim | — |
| Salário Mercado Mínimo/Máximo | Sim | — |
| Função Gratificada | Não | Se preenchido, exige conta própria |
| Vínculo Funcional | Sim (1 Unidade Analítica) | Exige ao menos uma Unidade Funcional Analítica cadastrada no Organograma |
| Encargos Sociais (%) | Não (padrão 0%) | Calculado sobre o Salário Total |
| Benefícios (VA, VR, VT, Saúde, Odonto, Seguro de Vida, Auxílio Creche) | Não | Cada um tem valor e conta próprios |
| Periculosidade / Insalubridade | Não | Percentual sobre o salário OU valor fixo, nunca os dois juntos |

---

## 3. Empregados

### O que é

Cadastro das pessoas (ou vagas em aberto) alocadas em cada Cargo. Cada Empregado herda o custo e
a conta do Cargo no momento em que é cadastrado.

### Onde encontrar

`Proposta > Empregados`.

No topo aparecem três indicadores: **Total de Empregados**, **Custo Mensal Total** e **Valor
Total do Período** (do último documento de consolidação — veja "Qtde. Empregado" abaixo).

### Cadastrar um Empregado

No formulário **Novo Empregado**:

1. Escolha o **Cargo**.
2. **Nome** — opcional. Se deixado em branco, o Empregado é cadastrado como **"A CONTRATAR"**.
3. **Quantidade** — só é usada quando o Nome está em branco: permite cadastrar várias vagas "A
   CONTRATAR" de uma vez (em lote) para o mesmo Cargo. Se você preencher um Nome, a quantidade é
   sempre 1 (um Empregado nomeado por vez).
4. **Categoria** — Empregado, Estagiário ou Jovem Aprendiz.
5. **Período Início**.
6. Clique em **Cadastrar**.

> O custo mensal do Empregado é sempre herdado do Cargo escolhido — não é digitado aqui.

### Ver e organizar os Empregados cadastrados

A lista aparece agrupada por Cargo, em formato de árvore: clique no nome do Cargo para
expandir/recolher e ver os Empregados daquele grupo. Cada linha mostra a categoria, o vínculo
funcional herdado, o custo mensal e a conta orçamentária de cada Empregado.

### Excluir um Empregado

Clique em **Excluir** na linha do Empregado, dentro do grupo do Cargo.

### Qtde. Empregado (documento de consolidação)

Esta seção, mais abaixo na mesma tela, **não é um cadastro separado de pessoas** — é um
documento de resumo, somente leitura quanto aos números, que consolida quantos Empregados,
Estagiários e Jovens Aprendizes existem em um período. Os totais são calculados automaticamente
a partir do que foi lançado na seção Empregados acima.

Para gerar um novo documento:

1. Preencha **Período Início** e **Período Fim**.
2. Clique em **Consolidar**.

O número do documento (formato "C-001", "C-002"...) é gerado automaticamente. Para remover um
documento, clique em **Excluir** na linha dele.

### Campos e regras — resumo

| Campo | Obrigatório | Regra |
|---|---|---|
| Cargo | Sim | — |
| Nome | Não | Vazio = "A CONTRATAR" |
| Quantidade | Só se Nome vazio | Cadastro em lote de vagas |
| Categoria | Sim | Empregado / Estagiário / Jovem Aprendiz |
| Período Início | Sim | Não pode ser anterior ao início da Proposta |

---

## 4. Semáforo Orçamentário

### O que é

Mostra, para cada conta orçamentária, o **Valor Realizado** (soma de tudo que já foi lançado
nela: salários e benefícios de Empregados, viagens, bens/equipamentos e impostos) comparado ao
**Valor Orçado** para essa conta, com uma cor indicando o nível de execução.

### Onde encontrar

`Proposta > Semáforo`.

### Como ler

Para cada conta, a tela mostra:

- **Valor Realizado** — sempre calculado e exibido, mesmo sem Valor Orçado cadastrado.
- Uma etiqueta colorida com o **percentual de execução** (Valor Realizado ÷ Valor Orçado), só
  aparece quando há Valor Orçado cadastrado para a conta:
  - 🟢 **Verde** — até 70% do orçado.
  - 🟡 **Amarelo** — de 70% até 85%.
  - 🟠 **Laranja** — de 85% até 95%.
  - 🔴 **Vermelho** — acima de 95%.

  (Esses percentuais são o padrão do sistema; uma conta específica pode ter limites diferentes,
  configurados separadamente.)
- Se a conta **não tem Valor Orçado cadastrado**, aparece a etiqueta cinza **"Valor Orçado: não
  cadastrado"** no lugar da cor — o Valor Realizado continua correto, só não há base de
  comparação para calcular o percentual.
- Se aparecer a etiqueta **"aproximado"**, significa que nem todas as origens de custo conhecidas
  do sistema foram somadas para aquela conta — trate o valor como uma estimativa, não como
  definitivo. Em condições normais essa etiqueta não deve aparecer.

Acima da lista, um gráfico de ranking mostra as contas com valor lançado, na mesma cor do
semáforo de cada uma.

---

## Perguntas Frequentes

**Configurei os benefícios de um Cargo em contas específicas, mas o Semáforo não mudou. Por
quê?**

Duas causas possíveis:

1. **O Cargo já tinha Empregados cadastrados antes da mudança.** O custo de um Empregado é
   fixado no momento em que ele é cadastrado — mudar os benefícios do Cargo depois não atualiza
   sozinho quem já estava lá. Vá em `Estrutura > Cargos`, edite o Cargo e clique em
   **Ressincronizar Empregados**.
2. **Ainda não existe nenhum Empregado cadastrado nesse Cargo.** Só o cadastro de Cargo com
   benefícios, sem nenhum Empregado alocado nele, não gera valor nenhum no Semáforo — é o
   Empregado que "puxa" o custo do Cargo para as contas. Cadastre um Empregado nesse Cargo (aba
   Empregados) e o valor aparece.

Se você só usou a seção **Qtde. Empregado**, sem cadastrar nenhum Empregado individual na seção
de cima, isso também não gera valor no Semáforo — Qtde. Empregado é só um resumo/consolidação
dos Empregados já lançados, não um cadastro de custo por si só.

**Por que não consigo excluir um Cargo?**

Porque ele tem pelo menos um Empregado vinculado a ele. O sistema bloqueia essa exclusão de
propósito, para não deixar um Empregado "órfão" sem Cargo. Vá até a aba Empregados, exclua (ou
realoque) os Empregados desse Cargo, e tente excluir o Cargo novamente. Se você selecionou vários
Cargos para excluir em lote, o mesmo vale: qualquer um deles com Empregado vinculado bloqueia a
exclusão de todos os selecionados — não só dele.

**Por que não consigo editar/excluir nada nessas telas?**

Provavelmente a Proposta já foi oficializada (fechada). Depois de oficializada, os dados de
Cargos, Empregados e Qtde. Empregado ficam somente para leitura — nenhuma alteração é permitida
por essas telas.

**A etiqueta "Valor Orçado: não cadastrado" é um erro?**

Não. Significa apenas que ninguém ainda informou quanto deveria ser gasto naquela conta (o Valor
Orçado). O Valor Realizado mostrado ao lado está correto e não depende disso.

**O que significa a etiqueta "Rascunho" na lista de Cargos?**

Que esse Cargo foi criado só com o nome (normalmente pela tela Tabela Salarial) e ainda não teve
Vínculo Funcional, Conta Contábil e Salário preenchidos. Clique em **Editar** nesse Cargo para
completar o cadastro — enquanto ele estiver como Rascunho, não é possível alocar Empregados nele.

**Ao tentar editar um Cargo, aparece um aviso pedindo para cadastrar Unidade Funcional. O que
fazer?**

Vá até a sub-aba **Estrutura Funcional (Organograma)**, na mesma tela, e cadastre ao menos uma
Unidade do tipo Analítico (Assessoria, Coordenadoria ou Setor). Depois volte para a aba Cargos —
o Vínculo Funcional já vai listar a unidade cadastrada.
