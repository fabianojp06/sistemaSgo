

| ESPECIFICAÇÃO DE CASO DE USO UC03.39 — Manter Alíquotas de Impostos Módulo de Cadastros  |  EP118/24  |  SGO 2.0 — CTCEA |
| :---: |

| Documento: | UC03.39 — Manter Alíquotas de Impostos | Data de Emissão: | 27/07/2025 |
| :---- | :---- | :---- | :---- |
| **Módulo:** | Módulo de Cadastros (EP118/24) | **Versão:** | Rev. 00 |
| **Épico:** | EP118/24 | **Elaboração:** | GIA / SGO 2.0 |
| **Destinatário:** | Fábrica de Software / QA / André (SCOR) | **Status:** | 🆕 NOVO — Gap Formalizado |

| *NOTA DE ORIGEM: Este UC foi criado para cobrir o GAP de especificação identificado na V5 do Módulo de Cadastros (REQ\_TAX\_001). Não havia UC formal para manutenção de alíquotas de impostos em nenhum módulo do SGO 2.0. Pendente de validação com André Luis Mattos (SCOR) antes da implementação.* |
| :---- |

| UC03.39 Manter Alíquotas de Impostos |
| :---- |

| Objetivo |
| :---- |

Responsável por centralizar as operações de consulta, filtragem e listagem das alíquotas de tributos (PIS, COFINS, ISS e outros) cadastradas na base de parâmetros fiscais do SGO 2.0. A tela provê o painel de gestão do ciclo de vida das alíquotas, disponibilizando os gatilhos de ação \[Novo\], \[Editar\] e \[Excluir\] condicionados ao estado de cada registro. Opera sob a diretriz "Trava o Erro" para impedir exclusão de alíquotas referenciadas em Propostas ativas.

| Atores Envolvidos | Administrador / Orçamentista / Gestor Financeiro (GFIN) / Sistema SGO |
| :---- | :---- |
| **Pré-Condições** | O usuário deve estar autenticado e possuir permissão de acesso ativa no menu Cadastros \> Alíquotas de Impostos. |
| **Pós-Condições** | Registros de alíquotas listados na grade de resultados com base nos filtros aplicados. Ações de \[Editar\] e \[Excluir\] habilitadas ou bloqueadas reativamente conforme o estado de cada alíquota. |

| Cenários |
| :---- |

**Fluxo Principal — Consulta e Listagem de Alíquotas**

| 1 | O usuário acessa o menu Cadastros \> Alíquotas de Impostos. |
| :---: | :---- |
| **2** | O sistema exibe a interface com os filtros: Nome do Imposto (texto livre), Tipo de Incidência (Combo: Contrato / Termo de Parceria / Ambos), Status (Ativo/Inativo), Data de Vigência (intervalo de datas). O botão \[Pesquisar\] é exibido ativo. O botão \[Novo\] é exibido para perfis com permissão de escrita. |
| **3** | O usuário preenche os filtros desejados (ou deixa em branco para listar todos) e clica em \[Pesquisar\]. |
| **4** | O sistema executa a busca e renderiza a grade de resultados com as colunas: Nome do Imposto | Alíquota Padrão (%) | Tipo de Incidência | Data de Início da Vigência | Data de Fim da Vigência | Status | Ações. |
| **5** | Para cada linha, os botões \[Editar\] e \[Excluir\] são exibidos reativamente: |
|   **5a** | \[Editar\] — habilitado sempre (qualquer status, pois edição com restrições é tratada em UC03.41). |
|   **5b** | \[Excluir\] — habilitado somente para alíquotas sem referência em Propostas ativas. \[RN\_IMP\_004\] |
| **6** | O usuário pode clicar em \[Novo\] para criar (→ UC03.40), \[Editar\] para alterar (→ UC03.41) ou \[Excluir\] para inativar (→ UC03.42). |

**Fluxo Alternativo A — Exportar Listagem**

| A1 | Após a grid ser renderizada, o usuário clica em \[Exportar\]. |
| :---: | :---- |
| **A2** | O sistema gera o arquivo nos formatos PDF e XLSX com os filtros aplicados estampados no cabeçalho do documento. \[RN0011\] |

| Fluxos de Exceção |
| :---- |

| Código | Descrição |
| ----- | ----- |
| **E1 — Pesquisa sem resultado** | O sistema exibe a mensagem: "Nenhuma alíquota encontrada para os filtros informados." A grid é renderizada vazia. O botão \[Novo\] permanece ativo. |

| Requisitos |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RF\_IMP\_REQ\_001** | Painel de Filtros: disponibilizar filtros combinados por Nome, Tipo de Incidência, Status e intervalo de vigência. |
| **RF\_IMP\_REQ\_002** | Grid de Resultados: exibir colunas Nome, Alíquota %, Tipo de Incidência, Data Início, Data Fim, Status e Ações. |
| **RF\_IMP\_REQ\_003** | Ações Condicionais Inline: botões \[Editar\] e \[Excluir\] renderizados reativamente por linha conforme estado da alíquota. |
| **REQ\_TAX\_001** | Gestão de Alíquotas de Parâmetros: o sistema deve fornecer interface para cadastrar e listar as alíquotas históricas de PIS, COFINS e ISS por período de vigência. |
| **RNF\_MAN\_REQ\_001** | Tempo de resposta da pesquisa ≤ 1,5 segundos para base de até 500 alíquotas cadastradas. |

| Regras de Negócio |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RN\_IMP\_001** | O campo Alíquota Padrão (%) deve ser exibido na grid com formatação de 2 casas decimais (ex: 9,25%). |
| **RN\_IMP\_002** | O campo Status deve exibir badge visual: Verde \= Ativo, Cinza \= Inativo. |
| **RN\_IMP\_003** | Alíquotas com Data de Fim de Vigência vencida (data \< hoje) devem ser exibidas automaticamente com Status "Expirada" na grid. |
| **RN\_IMP\_004** | O botão \[Excluir\] só é habilitado para alíquotas que não estejam referenciadas em nenhuma Proposta ativa (status\_sync \= DISPONIVEL em tb\_rateio\_imposto\_grade). \[TRAVA O ERRO\] |
| **RN0232** | Toda operação de listagem com filtros grava log assíncrono na HistoricodeOperacoes com snapshot dos filtros aplicados. |

| Classes Envolvidas |
| :---- |

AliquotaImpostoParametro (tb\_aliquota\_imposto\_parametro), HistoricodeOperacoes

| UC03.40 Cadastrar Alíquota de Imposto |
| :---- |

| Objetivo |
| :---- |

Responsável por realizar a inserção e parametrização de novos tributos (ex: PIS, COFINS, ISS, CIDE) e suas alíquotas correspondentes na tabela de parâmetros fiscais globais do SGO 2.0. Este UC formaliza o processo completo de cadastro com histórico de vigência, tipo de incidência e limites legais, substituindo o atalho inline limitado do UC03.01 (Fluxo C) para o fluxo administrativo completo. Opera sob a diretriz "Trava o Erro" com validações de unicidade, faixa legal de ISS e retroatividade.

| Atores Envolvidos | Administrador / Orçamentista com perfil de escrita em Cadastros \> Alíquotas de Impostos |
| :---- | :---- |
| **Pré-Condições** | Usuário autenticado com permissão de escrita no módulo. Tela UC03.39 (Manter) ativa como contexto de origem. |
| **Pós-Condições** | Nova alíquota persistida em tb\_aliquota\_imposto\_parametro com status Ativo. Log de criação gravado em HistoricodeOperacoes. Alíquota disponível para seleção na Aba Imposto (UC03.01) de Propostas com data de início dentro da vigência cadastrada. |

| Campos do Formulário |
| :---- |

| Campo | Tipo | Obrig. | Regra / Validação |
| ----- | ----- | :---: | ----- |
| Nome do Imposto | Texto | **SIM** | Máx. 20 chars. Único (case-insensitive) na base. \[RN\_IMP\_005\] |
| Alíquota Padrão (%) | Numérico | **SIM** | 0,00% ≤ valor ≤ 100,00%. Para ISS: obrigatório entre 2,00% e 5,00%. \[RN\_IMP\_006, RN\_TAX\_01\] |
| Tipo de Incidência | Combo | **SIM** | Valores: "Contrato" / "Termo de Parceria" / "Ambos". \[RN\_PRO\_010\] |
| Data de Início da Vigência | Data | **SIM** | Não pode ser retroativa à data atual do servidor. \[RN\_IMP\_007, RN\_TAX\_05\] |
| Data de Fim da Vigência | Data | NÃO | NULL \= vigência em aberto (alíquota atual). Se informada, deve ser posterior à Data de Início. |
| Limite Mínimo (%) | Numérico | NÃO | Relevante para ISS. Padrão legal: 2,00%. Opcional para outros tributos. |
| Limite Máximo (%) | Numérico | NÃO | Relevante para ISS. Padrão legal: 5,00%. Opcional para outros tributos. |
| Observação | Texto Longo | NÃO | Campo livre para notas administrativas. Máx. 500 chars. |

| Cenários |
| :---- |

**Fluxo Principal — Cadastro de Nova Alíquota**

| 1 | O usuário clica em \[Novo\] na tela UC03.39 — Manter Alíquotas de Impostos. |
| :---: | :---- |
| **2** | O sistema abre o formulário de cadastro com os campos acima. Botões \[Salvar\] e \[Cancelar\] ativos. |
| **3** | O usuário preenche os campos obrigatórios: Nome do Imposto, Alíquota Padrão (%), Tipo de Incidência e Data de Início da Vigência. |
| **4** | O usuário clica em \[Salvar\]. \[E1\]\[E2\]\[E3\]\[E4\]\[E5\] |
| **5** | O sistema executa as validações síncronas: unicidade do nome (case-insensitive), faixa de alíquota, faixa legal do ISS (se aplicável), e não-retroatividade da data. \[RN\_IMP\_005, RN\_IMP\_006, RN\_IMP\_007\] |
| **6** | O sistema persiste o novo registro em tb\_aliquota\_imposto\_parametro com ativo \= TRUE. |
| **7** | O sistema grava log de criação em tb\_historico\_operacoes com tipo\_operacao \= INSERT. \[RN0232\] |
| **8** | O sistema fecha o formulário, retorna à tela UC03.39 e exibe a nova alíquota na grid com mensagem de sucesso. |

**Fluxo Alternativo A1 — Cancelar Cadastro**

| A1.1 | No passo 2, o usuário clica em \[Cancelar\]. |
| :---: | :---- |
| **A1.2** | O sistema descarta os dados preenchidos sem nenhuma gravação e retorna à tela UC03.39. |

| Fluxos de Exceção \[TRAVA O ERRO\] |
| :---- |

| Código | Descrição e Mensagem ao Usuário |
| ----- | ----- |
| **E1 — Campo obrigatório em branco** | O sistema bloqueia o salvamento e exibe: "Campos obrigatórios não preenchidos. Verifique os campos destacados em vermelho." Formulário permanece aberto com dados intactos. \[RN\_IMP\_005\] |
| **E2 — Nome duplicado (case-insensitive)** | O sistema bloqueia com: "Operação Rejeitada \[TRAVA O ERRO\]: Já existe uma alíquota cadastrada com o nome \[Nome\_Digitado\]. Utilize um nome único." |
| **E3 — Alíquota fora da faixa (\< 0 ou \> 100\)** | O sistema bloqueia com: "Alíquota Inválida \[TRAVA O ERRO\]: O valor deve estar entre 0,00% e 100,00%." |
| **E4 — Alíquota de ISS fora da faixa legal (\< 2% ou \> 5%)** | O sistema bloqueia com: "Alíquota de ISS Inválida \[TRAVA O ERRO\]: A alíquota de ISS deve estar entre 2,00% e 5,00% conforme a LC 116/2003." |
| **E5 — Data de Início retroativa** | O sistema bloqueia com: "Data Inválida \[TRAVA O ERRO\]: A data de início da vigência não pode ser retroativa à data atual." |

| Requisitos |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RF\_IMP\_REQ\_004** | Formulário de Cadastro: disponibilizar todos os campos da tabela de campos acima com validações síncronas inline. |
| **REQ\_TAX\_001** | Gestão de Alíquotas: interface completa para cadastrar alíquotas históricas de PIS, COFINS e ISS por período de vigência. |
| **RNF\_TAX\_003** | Blindagem de Barramento: toda mutação trafega por APIs protegidas. Nenhum INSERT direto da interface gráfica. |

| Regras de Negócio |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RN\_IMP\_005** | Unicidade de Nome (case-insensitive): o sistema impede o cadastro de dois tributos com o mesmo nome independentemente de maiúsculas/minúsculas. \[RN\_TAX\_05\] |
| **RN\_IMP\_006** | Faixa Legal de ISS: quando o nome do imposto for "ISS" (case-insensitive), a alíquota deve obrigatoriamente ser maior ou igual a 2,00% e menor ou igual a 5,00%. \[RN\_TAX\_01, LC 116/2003\] |
| **RN\_IMP\_007** | Não-Retroatividade: a Data de Início da Vigência não pode ser anterior à data atual do servidor. Validado no backend. \[RN\_TAX\_05\] |
| **RN\_TAX\_06** | Isolamento Retroativo: a criação de nova alíquota não recalcula automaticamente Propostas já Oficializadas. |
| **RN0232** | Log de Criação Obrigatório: INSERT \+ log em transação única. Rollback se o log falhar. |

| Classes Envolvidas |
| :---- |

AliquotaImpostoParametro (tb\_aliquota\_imposto\_parametro), HistoricodeOperacoes

| UC03.41 Alterar Alíquota de Imposto |
| :---- |

| Objetivo |
| :---- |

Responsável por permitir a edição dos dados cadastrais de uma alíquota de imposto existente, respeitando as restrições de imutabilidade para alíquotas já referenciadas em Propostas Oficializadas. A alteração de alíquota nunca recalcula retroativamente Propostas já oficializadas — o snapshot gravado na grade fiscal (aliquota\_aplicada\_pct) permanece inalterado. \[RN\_TAX\_03, RN\_TAX\_06\] Campos como Nome e Tipo de Incidência podem ser editados livremente. Alteração de alíquota vigente em Propostas ativas gera aviso (não bloqueio) para o operador.

| Atores Envolvidos | Administrador / Orçamentista com perfil de escrita em Cadastros \> Alíquotas de Impostos |
| :---- | :---- |
| **Pré-Condições** | Alíquota existente na base. Usuário autenticado com permissão de escrita. Tela UC03.39 ativa como contexto de origem. |
| **Pós-Condições** | Dados da alíquota atualizados em tb\_aliquota\_imposto\_parametro. Log delta (estado antes × depois) gravado em HistoricodeOperacoes. Propostas já Oficializadas com snapshot congelado NÃO são impactadas. |

| Campos do Formulário (Edição) |
| :---- |

| Campo | Editável? | Restrição | Observação |
| ----- | :---: | ----- | ----- |
| Nome do Imposto | **SIM** | Unicidade (case-insensitive) \[RN\_IMP\_005\] | Não pode duplicar outro nome existente. |
| Alíquota Padrão (%) | **SIM** | Gera AVISO se usada em Propostas Em Elaboração. \[RN\_IMP\_008\] | Não afeta snapshots congelados (Propostas Oficializadas). \[RN\_TAX\_06\] |
| Tipo de Incidência | **SIM** | Nenhuma restrição adicional. |  |
| Data de Início da Vigência | **SIM** | Não retroativa. \[RN\_IMP\_007\] |  |
| Data de Fim da Vigência | **SIM** | Deve ser posterior à Data de Início. | NULL \= vigência em aberto. |
| Limite Mínimo / Máximo (%) | **SIM** | Para ISS: faixa 2%–5%. \[RN\_IMP\_006\] |  |
| Observação | **SIM** | — | Campo livre. Máx. 500 chars. |

| Cenários |
| :---- |

**Fluxo Principal — Alteração de Alíquota**

| 1 | O usuário clica em \[Editar\] na linha desejada da grid da tela UC03.39. |
| :---: | :---- |
| **2** | O sistema abre o formulário de edição pré-populado com os dados atuais da alíquota. |
| **3** | O sistema verifica se a alíquota está referenciada em Propostas com status "Em Elaboração" ou "Em Aprovação". Se sim, exibe aviso informativo: "Atenção: Esta alíquota está sendo utilizada em Propostas em elaboração. Alterações afetarão novos saves nessas Propostas, mas NÃO recalcularão Propostas já Oficializadas." \[RN\_IMP\_008\] |
| **4** | O usuário realiza as alterações desejadas e clica em \[Salvar\]. \[E1\]\[E2\]\[E3\]\[E4\]\[E5\] |
| **5** | O sistema executa as validações síncronas (mesmas do UC03.40). |
| **6** | O sistema persiste as alterações em tb\_aliquota\_imposto\_parametro com UPDATE e incrementa o campo version (Optimistic Locking). \[RNF\_TAX\_006\] |
| **7** | O sistema grava log delta em tb\_historico\_operacoes com tipo\_operacao \= UPDATE, estado anterior e posterior. \[RN0232\] |
| **8** | Retorna à tela UC03.39 com mensagem de sucesso. |

**Fluxo Alternativo A1 — Cancelar Alteração**

| A1.1 | O usuário clica em \[Cancelar\] no formulário. |
| :---: | :---- |
| **A1.2** | O sistema descarta as modificações e retorna à tela UC03.39 sem nenhuma gravação. |

| Fluxos de Exceção \[TRAVA O ERRO\] |
| :---- |

| Código | Descrição e Mensagem ao Usuário |
| ----- | ----- |
| **E1** | Campo obrigatório em branco → mesma mensagem do UC03.40 E1. |
| **E2** | Nome duplicado → mesma mensagem do UC03.40 E2. |
| **E3** | Alíquota fora da faixa → mesma mensagem do UC03.40 E3. |
| **E4** | Alíquota ISS fora da faixa legal → mesma mensagem do UC03.40 E4. |
| **E5 — Conflito de concorrência (Optimistic Lock)** | Dois usuários editam a mesma alíquota simultaneamente. O segundo commit retorna: "Conflito de Edição \[TRAVA O ERRO\]: Outro usuário modificou este registro simultaneamente. Recarregue antes de prosseguir." \[RNF\_TAX\_006\] |

| Regras de Negócio |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RN\_TAX\_03** | Imutabilidade Orçamentária: Propostas Oficializadas têm snapshots congelados (is\_congelado \= TRUE). A alteração da alíquota global NÃO atualiza os snapshots congelados. |
| **RN\_TAX\_06** | Isolamento Retroativo: a alteração de alíquota afeta apenas futuros saves de Propostas em elaboração — nunca recalcula histórico. |
| **RN\_IMP\_008** | Aviso de Impacto em Propostas Em Elaboração: o sistema exibe alerta informativo (não bloqueante) quando a alíquota está em uso por Propostas não oficializadas. |
| **RNF\_TAX\_006** | Optimistic Locking: campo version incrementado a cada UPDATE. Conflito rejeita o segundo commit com HTTP 409\. |
| **RN0232** | Log delta obrigatório com estado antes e depois. Rollback se log falhar. |

| Classes Envolvidas |
| :---- |

AliquotaImpostoParametro (tb\_aliquota\_imposto\_parametro), RateioImpostoGrade (tb\_rateio\_imposto\_grade), HistoricodeOperacoes

| UC03.42 Excluir Alíquota de Imposto |
| :---- |

| Objetivo |
| :---- |

Responsável por realizar a exclusão lógica (Soft Delete) de um registro de alíquota de imposto que não esteja referenciado em nenhuma Proposta ativa ou Oficializada. Operando sob as diretrizes \[SOFT DELETE\] e \[TRAVA O ERRO\], este UC impede a destruição física de registros referenciados, convertendo a remoção em inativação lógica (ativo \= FALSE). A exclusão física definitiva não é suportada pelo SGO 2.0 para registros com histórico de uso. Uma janela modal de confirmação obrigatória protege contra exclusões acidentais.

| Atores Envolvidos | Administrador com perfil de exclusão ativo em Cadastros \> Alíquotas de Impostos |
| :---- | :---- |
| **Pré-Condições** | Alíquota selecionada na grid UC03.39 com botão \[Excluir\] habilitado (sem referências ativas). Usuário autenticado. |
| **Pós-Condições** | Campo ativo \= FALSE atualizado em tb\_aliquota\_imposto\_parametro. Alíquota deixa de aparecer nos lookups de Propostas em elaboração. Log de exclusão gravado em HistoricodeOperacoes. Dados preservados para auditoria. |

| Cenários |
| :---- |

**Fluxo Principal — Exclusão Lógica de Alíquota sem Referências Ativas**

| 1 | O usuário clica em \[Excluir\] na linha desejada da grid UC03.39 (botão visível somente para alíquotas sem referências ativas). \[RN\_IMP\_004\] |
| :---: | :---- |
| **2** | O sistema exibe modal de confirmação: "Deseja realmente excluir a alíquota \[Nome\_Imposto\]? A alíquota será inativada e não estará mais disponível para novas Propostas." — botões \[Confirmar\] e \[Cancelar\]. |
| **3** | O usuário clica em \[Confirmar\]. \[E1\]\[E2\] |
| **4** | O sistema executa varredura síncrona de referências em tb\_rateio\_imposto\_grade para confirmar ausência de vínculos ativos. \[RN\_IMP\_009\] |
| **5** | O sistema atualiza ativo \= FALSE em tb\_aliquota\_imposto\_parametro (Soft Delete). Nenhum DELETE físico é executado. \[RN\_IMP\_010\] |
| **6** | O sistema grava log de exclusão em tb\_historico\_operacoes com tipo\_operacao \= SOFT\_DELETE e payload completo do estado anterior. \[RN0232\] |
| **7** | O sistema fecha o modal, remove a linha da grid (ou exibe com badge "Inativo" se o filtro incluir inativos) e exibe mensagem de sucesso. |

**Fluxo Alternativo A1 — Cancelamento da Exclusão**

| A1.1 | O modal de confirmação está visível. O usuário clica em \[Cancelar\]. |
| :---: | :---- |
| **A1.2** | O modal fecha sem executar nenhuma operação. Alíquota permanece ativa e visível. Nenhum log gravado. |

| Fluxos de Exceção \[TRAVA O ERRO\] |
| :---- |

| Código | Descrição e Mensagem ao Usuário |
| ----- | ----- |
| **E1 — Referência ativa detectada na varredura \[TRAVA O ERRO\]** | A varredura identifica que a alíquota está referenciada em Propostas ativas (tb\_rateio\_imposto\_grade com imposto\_selecionado \= TRUE e is\_congelado \= FALSE). O sistema aborta e exibe: "Exclusão Bloqueada \[TRAVA O ERRO\]: Esta alíquota está sendo utilizada em Propostas ativas. Remova as referências antes de excluir." \[RN\_IMP\_009\] |
| **E2 — Falha de rede ou banco durante a exclusão** | O sistema executa rollback atômico completo. Nenhum dado alterado. Exibe: "Erro de Processamento: Não foi possível concluir a exclusão. Tente novamente." |

| Requisitos |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RF\_IMP\_REQ\_005** | Modal de Confirmação: exibir modal com nome da alíquota e botões \[Confirmar\] / \[Cancelar\] antes de qualquer operação. |
| **RF\_IMP\_REQ\_006** | Varredura de Referências: verificar uso em tb\_rateio\_imposto\_grade antes de executar o Soft Delete. |
| **RNF\_EXC\_REQ\_002** | Atomicidade: Soft Delete \+ log de auditoria na mesma transação ACID. |

| Regras de Negócio |
| :---- |

| ID | Descrição |
| ----- | ----- |
| **RN\_IMP\_004** | Condicionalidade do Botão \[Excluir\]: habilitado na grid UC03.39 somente para alíquotas sem referências ativas. Verificação no carregamento da grid para controle visual. |
| **RN\_IMP\_009 \[TRAVA O ERRO\]** | Bloqueio por Referência Ativa: a exclusão é bloqueada se a varredura em tb\_rateio\_imposto\_grade identificar qualquer linha com imposto\_selecionado \= TRUE e propostas não congeladas (is\_congelado \= FALSE) vinculadas à alíquota. |
| **RN\_IMP\_010 \[SOFT DELETE\]** | Inativação Lógica Mandatória: terminantemente proibido DELETE físico em tb\_aliquota\_imposto\_parametro para registros com histórico de uso. A operação atualiza ativo \= FALSE. |
| **RN0232** | Log de Exclusão Obrigatório: payload JSON com snapshot completo do estado anterior. Rollback se log falhar. |

| Classes Envolvidas |
| :---- |

AliquotaImpostoParametro (tb\_aliquota\_imposto\_parametro), RateioImpostoGrade (tb\_rateio\_imposto\_grade), HistoricodeOperacoes

| MAPA DE RELACIONAMENTOS E DEPENDÊNCIAS — UC03.39 a UC03.42 |
| :---- |

| UC | Nome | Depende de | Consome / Alimenta |
| :---: | ----- | ----- | ----- |
| UC03.39 | **Manter Alíquotas** | UC02.07 (Perfis/Permissões) | → UC03.40 / UC03.41 / UC03.42 |
| UC03.40 | **Cadastrar Alíquota** | UC03.39 (listagem ativa) | → tb\_aliquota\_imposto\_parametro (INSERT); disponível em UC03.01 Fluxo Principal |
| UC03.41 | **Alterar Alíquota** | UC03.39; Alíquota existente | → UPDATE não afeta is\_congelado \= TRUE (Propostas Oficializadas) |
| UC03.42 | **Excluir Alíquota** | UC03.39; Nenhuma referência ativa em tb\_rateio\_imposto\_grade | → ativo \= FALSE (Soft Delete). Registro preservado para auditoria |
| UC03.01 | **Aba Imposto (consumidor)** | UC03.40 / UC03.41 — lê tb\_aliquota\_imposto\_parametro via lookup por data de início da Proposta \[RN\_TAX\_01\] | Fluxo C do UC03.01 (modal inline) continua como atalho para cadastro rápido — aponta ao mesmo banco |

| COMPARATIVO: UC03.01 FLUXO C × UC03.40 (CADASTRO COMPLETO) |
| :---- |

| Característica | UC03.01 Fluxo C (Atalho Inline) | UC03.40 (Cadastro Completo) |
| ----- | ----- | ----- |
| **Acesso** | Dentro da Aba Imposto de uma Proposta | Menu Cadastros \> Alíquotas de Impostos |
| **Campos disponíveis** | Nome, Alíquota, Data de Início, Tipo de Incidência (4 campos) | 7 campos \+ Observação \+ Limites Mín/Máx |
| **Histórico de vigências** | Não suportado (apenas Data de Início) | Suportado (Data de Início \+ Data de Fim) |
| **Disponibilidade pós-criação** | Imediata (reativa na Aba Imposto atual) | Na próxima abertura da Aba Imposto de qualquer Proposta |
| **Perfil requerido** | Orçamentista (escrita em Propostas) | Administrador / Orçamentista com acesso a Cadastros |
| **Recomendação de uso** | Cadastros rápidos emergenciais durante elaboração de Proposta | Manutenção formal, histórico legislativo, gestão de vigências |

— Fim do Documento —