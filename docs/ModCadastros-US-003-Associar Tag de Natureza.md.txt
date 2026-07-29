US-003
Associar Tag de Natureza (OPEX/CAPEX) a Conta Analítica

Módulo:	Cadastros — Plano de Contas	Épico:	EP118/24
Perfil:	Orçamentista / GFIN	Prioridade:	🟡 Média
Estimativa:	M	Depende de:	US-001 (conta existente no SGO)

Como Orçamentista ou Gestor Financeiro (GFIN),
Quero associar uma Tag de Natureza (OPEX — Custeio ou CAPEX — Investimento) a uma conta analítica N7 importada do ERP, diretamente no painel de parametrização do SGO,
Para classificar as despesas por natureza econômica sem interferir na hierarquia oficial do ERP, habilitando o Semáforo Orçamentário e os relatórios gerenciais de custeio vs. investimento. [RF_PLA_REQ_003, RN_PLA_005]

Cenários de Aceite — US-003

✅  Cenário 1 — Atribuição de tag OPEX a conta analítica N7 sem tag prévia
Dado que o usuário acessa o painel de parametrização de uma conta analítica N7
E que a conta não possui tag_natureza atribuída (NULL)
Quando o usuário seleciona 'OPEX (Custeio)' no seletor de Tag de Natureza e confirma
Então o sistema salva tag_natureza = 'OPEX' em tb_conta_contabil para aquela conta
E a tag é exibida visualmente na árvore (badge ou ícone identificador)
E o log de auditoria é gravado com estado anterior (NULL) e estado posterior ('OPEX') [RN_PLA_004]


❌  Cenário 2 — Tentativa de atribuir tag OPEX a conta filha de pai CAPEX [TRAVA O ERRO]
Dado que existe uma conta sintética de Nível 6 com tag_natureza = 'CAPEX' ou cuja natureza hierárquica é de Investimento
E que o usuário tenta atribuir 'OPEX (Custeio)' a uma conta analítica N7 filha dessa sintética
Quando o usuário tenta confirmar a atribuição
Então o sistema bloqueia o salvamento com rollback [RN_PLA_005]
E exibe o alerta: 'Classificação Inválida [TRAVA O ERRO]: A conta sintética pai desta conta está classificada como CAPEX. Não é permitido classificar uma conta filha como OPEX — a natureza deve ser consistente com a hierarquia.'
E o campo tag_natureza permanece sem alteração no banco


✅  Cenário 3 — Remoção de tag de natureza de conta analítica
Dado que uma conta analítica N7 possui tag_natureza = 'OPEX'
Quando o usuário seleciona a opção 'Sem classificação' (NULL) e confirma
Então o sistema atualiza tag_natureza para NULL
E o badge de natureza desaparece da exibição na árvore
E o log de auditoria registra a remoção com estado anterior ('OPEX') e posterior (NULL)


❌  Cenário 4 — Tentativa de atribuir tag a conta sintética N1–N6 [TRAVA O ERRO]
Dado que o usuário tenta acessar o painel de parametrização de uma conta sintética (Nível 1 a 6)
Quando o painel é carregado
Então o seletor de Tag de Natureza não é renderizado para contas sintéticas — apenas leitura
E o sistema exibe a informação: 'Tags de Natureza são configuráveis somente em contas analíticas (Nível 7).'


Aspecto	Detalhe
Tabelas afetadas	tb_conta_contabil (UPDATE em tag_natureza), tb_historico_operacoes (INSERT)
Campos alterados	tag_natureza (OPEX | CAPEX | NULL)
Transação?	Sim — UPDATE + log de auditoria em transação única
Validação crítica	Hierarquia de herança de natureza (RN_PLA_005): validada na camada de aplicação antes do UPDATE
Auditoria	tipo_operacao: UPDATE | campos: estado anterior e posterior de tag_natureza

Definition of Done — US-003
☐  Cenários 1 a 4 implementados e aprovados em homologação
☐  Herança hierárquica bloqueada corretamente (pai CAPEX → filho não pode ser OPEX)
☐  Tag exibida visualmente na árvore após atribuição
☐  Log com delta de estado gravado corretamente
☐  Seletor não renderizado para contas sintéticas N1–N6
