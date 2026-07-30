US-006 

Excluir Agrupador de Contas 

 

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

Quero excluir um Agrupador de Contas que não está referenciado em nenhum documento orçamentário ativo, 

Para manter o painel de Agrupadores limpo e sem configurações obsoletas, preservando a integridade dos relatórios que ainda referenciam outros Agrupadores. [RN_PLA_010] 

 

Cenários de Aceite — US-006 

 

✅  Cenário 1 — Exclusão bem-sucedida de Agrupador sem referências ativas 

Dado que existe o Agrupador 'Passagens Antigas' sem referências em Cronogramas de Desembolso ou Propostas ativas 

Quando o usuário clica em [Excluir] sobre o Agrupador 

E o sistema exibe o modal de confirmação: 'Deseja excluir o Agrupador Passagens Antigas? Esta ação removerá o subtotal correspondente de todos os relatórios vinculados.' 

E o usuário clica em [Confirmar] 

Então o sistema remove o Agrupador (ativo = FALSE ou DELETE físico se sem histórico) e seus vínculos em tb_agrupador_conta_item 

E o Agrupador desaparece do painel imediatamente 

E o log de exclusão é gravado [RN_PLA_004] 

 

 

✅  Cenário 2 — Cancelamento da exclusão 

Dado que o modal de confirmação de exclusão está visível 

Quando o usuário clica em [Cancelar] 

Então o modal fecha sem executar nenhuma operação 

E o Agrupador permanece ativo e visível no painel 

E nenhum log é gravado 

 

 

❌  Cenário 3 — Exclusão bloqueada por referência ativa [TRAVA O ERRO] 

Dado que o Agrupador 'Despesas com Passagens' está referenciado em uma Proposta ativa no Cronograma de Desembolso 

Quando o usuário tenta excluir o Agrupador e confirma no modal 

Então o sistema aborta a exclusão [RN_PLA_010] 

E exibe o alerta: 'Exclusão Bloqueada [TRAVA O ERRO]: Este Agrupador está referenciado em documentos orçamentários ativos. Remova as referências antes de excluí-lo.' 

E o Agrupador permanece ativo no painel 

E nenhuma alteração é feita no banco de dados 

 

 

Aspecto 

Detalhe 

Tabelas afetadas 

tb_agrupador_contas (UPDATE ativo=FALSE ou DELETE), tb_agrupador_conta_item (DELETE vínculos), tb_historico_operacoes (INSERT) 

Varredura prévia 

Sistema verifica referências em tb_cronograma_desembolso e tb_dotacao_conta antes de permitir exclusão 

Transação? 

Sim — varredura + remoção + log em transação única. Rollback se log falhar 

Auditoria

tipo_operacao: AGRUPADOR_EXCLUIDO | payload: agrupadorId, nome, contaIds — gravado em HistoricoOperacao dentro da mesma transação, antes do delete físico (cascade removeria o dado antes de poder ser lido)



Decisões do Debate do Time (2026-07-30)

1. Código pré-existente: ExcluirAgrupadorUseCase.ts já cobria os Cenários 1 e 3 via um parâmetro injetável `possuiReferenciaAtiva` (stub sempre `false`, documentado como ponto de extensão — nenhum módulo de Cronograma de Desembolso/Proposta existe ainda no SGO). Decisão mantida sem alteração.

2. Achado do Tech Lead: o payload de auditoria gravava apenas `{ agrupadorId, nome }`, sem `contaIds` — inconsistente com Criar/EditarAgrupadorUseCase (que sempre incluem contaIds) e incompleto frente ao "snapshot completo" pedido pela US. Como o delete é físico com cascade em ContaAgrupadoraItem, uma vez commitado não há outra fonte para recuperar quais contas estavam vinculadas.

3. Corrigido: findUniqueOrThrow agora inclui `itens: true` antes do delete, e `contaIds` foi adicionado ao payload de auditoria. Teste atualizado para verificar `contaIds` no log.

4. Exclusão é DELETE físico (não `ativo=FALSE`) — consistente com a decisão já tomada na US-004 de que não existe/não é necessário o campo `ativo` no schema.

5. Cenário 2 (cancelamento do modal) é comportamento de frontend puro — nenhuma ação de backend é chamada, portanto nada a testar em nível de use case; cobertura fica a cargo de teste de componente/E2E quando a UI for implementada.



Definition of Done — US-006

☑  Cenários 1 e 3 implementados e cobertos por teste automatizado (ExcluirAgrupadorUseCase.test.ts)

☐  Cenário 2 (cancelamento) — depende da UI do modal de confirmação, ainda não auditada nesta conversa

☑  Varredura de referências ativas implementada via ponto de extensão `possuiReferenciaAtiva` (retorna sempre false até existir módulo de Cronograma de Desembolso)

☐  Modal de confirmação exibe nome do Agrupador — depende da UI, não verificado nesta conversa

☑  Log com snapshot completo gravado (nome + contaIds) antes do delete físico 