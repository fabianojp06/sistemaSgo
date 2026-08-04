US-005 

Editar Agrupador de Contas 

 

Módulo: 

Cadastros — Plano de Contas 

Épico: 

EP118/24 

Perfil: 

Orçamentista / GFIN 

Prioridade: 

🟡 Média 

Estimativa: 

P 

Depende de: 

US-004 (Agrupador existente) 

 

Como Orçamentista ou Gestor Financeiro (GFIN), 

Quero editar o nome e/ou a lista de contas analíticas vinculadas a um Agrupador de Contas existente, 

Para manter a configuração de subtotais dos relatórios atualizada conforme mudanças na estrutura de despesas, sem necessidade de excluir e recriar o Agrupador. [RF_PLA_REQ_005, RN_PLA_008, RN_PLA_009] 

 

Cenários de Aceite — US-005 

 

✅  Cenário 1 — Edição bem-sucedida de nome e contas do Agrupador 

Dado que existe o Agrupador 'Despesas com Passagens' com 2 contas vinculadas 

Quando o usuário clica em [Editar] sobre o Agrupador, altera o nome para 'Passagens e Diárias' e adiciona a conta 'Diárias de Viagem' 

E clica em [Salvar Agrupador] 

Então o sistema valida nome único e mínimo de 2 contas [RN_PLA_008] 

E persiste o novo nome e atualiza os vínculos em tb_agrupador_conta_item 

E os relatórios que referenciam o Agrupador refletem imediatamente a nova configuração [RN_PLA_009] 

E o log de alteração é gravado com estado anterior e posterior (delta) [RN_PLA_004] 

 

 

❌  Cenário 2 — Edição resulta em menos de 2 contas vinculadas [TRAVA O ERRO] 

Dado que o Agrupador possui 2 contas vinculadas 

Quando o usuário remove 1 conta no modal de edição, deixando apenas 1, e tenta salvar 

Então o sistema bloqueia o salvamento [RN_PLA_008] 

E exibe o alerta: 'O Agrupador deve ter um Nome preenchido e ao menos duas contas analíticas selecionadas.' 

E o modal permanece aberto com os dados intactos 

 

 

❌  Cenário 3 — Novo nome duplica outro Agrupador existente [TRAVA O ERRO] 

Dado que já existe o Agrupador 'Viagens Corporativas' no sistema 

Quando o usuário edita o Agrupador 'Despesas com Passagens' e altera o nome para 'Viagens Corporativas' 

Então o sistema bloqueia o salvamento 

E exibe o alerta: 'Já existe um Agrupador com este nome. Utilize um nome único.' 

 

 

Aspecto 

Detalhe 

Tabelas afetadas 

tb_agrupador_contas (UPDATE), tb_agrupador_conta_item (DELETE + INSERT para reconciliar vínculos), tb_historico_operacoes (INSERT) 

Estratégia de sync 

Comparar lista atual vs. lista nova: remover vínculos excluídos, inserir vínculos adicionados — nunca DELETE ALL + INSERT 

Transação? 

Sim — UPDATE + reconciliação de vínculos + log em transação única 

Auditoria

tipo_operacao: AGRUPADOR_EDITADO | delta: nome antes/depois, contaIds antes/depois — gravado em HistoricoOperacao dentro da mesma transação



Decisões do Debate do Time (2026-07-30)

1. Código pré-existente violava a própria US: EditarAgrupadorUseCase.ts fazia deleteMany (tudo) + createMany (tudo) em ContaAgrupadoraItem, exatamente o padrão proibido pela Estratégia de sync. Não havia teste automatizado para este use case.

2. Tech Lead decidiu implementar a reconciliação diff (remover somente contaIds ausentes na nova lista, inserir somente os novos) — não porque o delete-all+insert causasse bug hoje (a tabela ContaAgrupadoraItem só tem a FK composta, sem dado próprio a perder), mas para não perder dado silenciosamente se o modelo ganhar campos próprios no futuro, e para manter o código alinhado ao texto da US sem abrir uma segunda exceção doc-vs-implementação (a primeira foi a trigger de banco da US-004).

3. EditarAgrupadorUseCase.ts reescrito: calcula contaIdsRemovidos e contaIdsAdicionados comparando estado anterior (lido dentro da transação) vs. lista nova, e só executa deleteMany/createMany sobre essas diferenças — contas mantidas nunca são tocadas.

4. Teste criado em EditarAgrupadorUseCase.test.ts cobrindo os 3 cenários da US + um caso extra de reconciliação parcial (agrupador com [c1,c2,c3], edição para [c1,c2,c4] deve remover apenas c3 e adicionar apenas c4).



Definition of Done — US-005

☑  Cenários 1 a 3 implementados e cobertos por teste automatizado (EditarAgrupadorUseCase.test.ts)

☐  Relatórios atualizados imediatamente após edição do Agrupador — comportamento decorre de ListarAgrupadoresUseCase já ler o estado atual sem cache; não há teste de integração ponta a ponta com o módulo de relatórios ainda

☑  Estratégia de reconciliação de vínculos implementada por diff (sem DELETE ALL) e testada, incluindo caso de reconciliação parcial

☑  Log com delta de alterações gravado (nome e contaIds antes/depois) 