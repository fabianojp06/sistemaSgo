US-002
Bloquear Tentativa de Alteração Manual de Conta ERP

Módulo:	Cadastros — Plano de Contas	Épico:	EP118/24
Perfil:	Sistema SGO (barramento de backend)	Prioridade:	🔴 Alta
Estimativa:	M	Depende de:	US-001 (Plano de Contas sincronizado)

Como Sistema SGO (barramento de backend),
Quero interceptar e rejeitar qualquer tentativa de inserção, alteração de nome ou exclusão direta de contas importadas do ERP,
Para garantir a integridade contábil e a governança exclusiva do ERP Senior sobre a estrutura oficial do Plano de Contas. [RN_PLA_001, RN_PLA_002, RF_PLA_REQ_002]

Cenários de Aceite — US-002

❌  Cenário 1 — Tentativa de alteração via interface gráfica [TRAVA O ERRO]
Dado que o usuário acessa a tela do Plano de Contas
Quando o usuário visualiza qualquer conta importada do ERP
Então os botões [Novo Conta], [Editar Nome], [Excluir Conta] não são renderizados na interface [RF_PLA_REQ_002]
E os campos código_conta, nome_conta e nivel estão em modo Read-only estrito
E não existe input ou campo de texto editável vinculado à estrutura ERP


❌  Cenário 2 — Tentativa de bypass via chamada direta de API [TRAVA O ERRO]
Dado que um usuário tenta forçar uma inserção ou alteração de conta via requisição direta ao endpoint de persistência do SGO (bypass de interface)
Quando o barramento de backend recebe a requisição não autorizada
Então o sistema rejeita a operação com rollback imediato da transação
E retorna status HTTP 403 com mensagem: 'Operação Negada [TRAVA O ERRO]: O Plano de Contas é governado exclusivamente pelo ERP Senior. Não é permitido incluir, excluir ou alterar nomes de contas diretamente no SGO.'
E o banco de dados permanece 100% inalterado
E o evento de violação de governança é registrado na tb_historico_operacoes com tipo_operacao='VIOLACAO_GOVERNANCA'


Aspecto	Detalhe
Tabelas afetadas	tb_conta_contabil (nenhuma escrita permitida via interface)
Validação	Backend verifica origem da requisição; rejeita qualquer UPDATE/INSERT/DELETE em campos estruturais ERP
Auditoria	Tentativas bloqueadas registradas em tb_historico_operacoes com tipo VIOLACAO_GOVERNANCA
Transação?	Rollback imediato em qualquer tentativa detectada

Definition of Done — US-002
☐  Interface não renderiza botões de escrita em contas ERP (testado com inspeção de DOM)
☐  Endpoint de persistência rejeita requisições diretas (testado com Postman/curl sem token de admin de sync)
☐  Mensagem de erro exibida conforme texto especificado
☐  Log de violação gravado corretamente
