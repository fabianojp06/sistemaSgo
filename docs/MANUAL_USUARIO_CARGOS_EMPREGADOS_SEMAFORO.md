# Manual do Usuário — Cargos, Empregados e Semáforo Orçamentário

Este manual explica como usar as três telas de Recursos Humanos e acompanhamento orçamentário
de uma Proposta: **Cargos**, **Empregados** e **Semáforo Orçamentário**.

Todas ficam dentro de uma Proposta (Termo de Parceria/Contrato), nas abas:

`Proposta > Estrutura` (Cargos) · `Proposta > Empregados` · `Proposta > Semáforo`

> As três telas estão ligadas entre si: o custo de um Empregado vem do Cargo em que ele está
> alocado, e o Semáforo mostra o quanto desse custo já está "realizado" (lançado) em cada conta
> orçamentária, comparado ao valor orçado para ela.

---

## 1. Cargos

### O que é

Um Cargo representa uma função de mercado (ex: "Analista de Requisitos") com seu salário, os
benefícios que a Proposta paga para quem ocupa esse Cargo (vale-alimentação, plano de saúde
etc.) e em quais Unidades Funcionais (setores/coordenadorias) o custo dele é distribuído.

### Onde encontrar

`Proposta > Estrutura` (link "Estrutura Funcional e Cargos" no topo da tela da Proposta).

No topo da tela aparece um resumo com o **Total de Cargos**, o **Custo Total Mensal** e o
**Salário Total Mensal** de todos os Cargos cadastrados.

### Cadastrar um novo Cargo

1. Preencha o formulário na parte de baixo da tela ("Novo Cargo"):
   - **Nome do Cargo (Mercado)** — obrigatório.
   - **Conta Contábil** — a conta orçamentária onde o custo desse Cargo será lançado. Obrigatória.
   - **Período Início** — obrigatório.
   - **Salário Mercado Mínimo** e **Salário Mercado Máximo** — obrigatórios.
   - **Função Gratificada** (opcional) e a conta correspondente, se houver gratificação.
   - **Fonte Ativa** — de onde vem o salário usado no cálculo (Mercado Mínimo, Mercado Máximo
     ou Rubi/Salário Real).
2. Em **Rateio Funcional**, clique em "+ Adicionar unidade" e escolha para quais Unidades
   Funcionais o custo desse Cargo é distribuído, com o percentual de cada uma. **A soma dos
   percentuais precisa ser exatamente 100%** — o botão "Salvar Cargo" fica desabilitado até isso
   ser verdade (o percentual atual aparece ao lado do título "Rateio Funcional").
3. Em **Benefícios e Encargos**, marque cada benefício que esse Cargo tem direito (Vale
   Alimentação, Vale Refeição, Vale Transporte, Plano de Saúde, Plano Odontológico, Seguro de
   Vida, Auxílio Creche) e informe o valor de cada um. Para cada benefício marcado, escolha
   também a **conta orçamentária** onde aquele custo específico deve ser lançado — se não
   escolher uma conta própria, o valor cai na mesma conta do salário do Cargo.
4. Clique em **Salvar Cargo**.

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
| Nome do Cargo (Mercado) | Sim | — |
| Conta Contábil | Sim | Onde o salário do Cargo é lançado |
| Período Início | Sim | — |
| Salário Mercado Mínimo/Máximo | Sim | — |
| Função Gratificada | Não | Se preenchido, exige conta própria |
| Rateio Funcional | Sim (ao menos 1 unidade) | Soma dos percentuais deve ser 100% |
| Benefícios (VA, VR, VT, Saúde, Odonto, Seguro de Vida, Auxílio Creche) | Não | Cada um tem valor e conta próprios |

---

## 2. Empregados

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

## 3. Semáforo Orçamentário

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
   sozinho quem já estava lá. Vá em `Estrutura > Editar` o Cargo e clique em **Ressincronizar
   Empregados**.
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
