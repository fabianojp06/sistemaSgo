US-008a

Exibir Badge do Semáforo Orçamentário na Aba de Totalizadores



Módulo:

Cadastros — Plano de Contas / Relatórios Orçamentários

Épico:

EP118/24

Perfil:

Orçamentista / GFIN

Prioridade:

🟡 Média — depende de módulos de custo do mesmo épico (ver Nota de Bloqueio revisada)

Estimativa:

Não estimável até que ao menos um módulo de custo (Empregados, Viagens, Bens/Serviços ou Rateios) esteja implementado

Depende de:

US-007 (concluída — fornece valorOrcado), US-008 (limiares configurados), e de ao menos um dos módulos de lançamento de custo do EP118/24 (UC03.18-27 Empregados, UC03.29-33 Viagens, UC03.34-36 Bens/Serviços/Equipamentos, ou US-101 Rateio/Imposto) para fornecer valorRealizado



Nota de Bloqueio (Debate do Time, 2026-07-30 — revisada em 2026-07-31)

Esta US foi extraída do Cenário 3 original da US-008 ("Configurar Semáforo Orçamentário"). Ela depende de "Valor Realizado / Valor Orçado" por conta analítica.

Revisão de escopo (2026-07-31): a nota original presumia que `valorRealizado` viria de um módulo de execução orçamentária pública (empenho/liquidação, Lei 4.320/64) — essa premissa estava errada para o contexto do CTCEA (OSCIP com Termo de Parceria/Proposta Comercial, não execução orçamentária pública federal). Conforme a Minuta da Especificação do Módulo de Cadastros V5 (UC 3.02 — Aba Totalizadores, RN_TOT_03): "O motor de busca consolida os valores orçados e realizados extraídos exclusivamente do último nível configurado (Nível 7 / Nó Folha)... dispara uma varredura síncrona nas tabelas de despesas (Cargos, Viagens, Rateios)." Ou seja, `valorRealizado` é a soma dos lançamentos operacionais de custo já especificados neste mesmo épico (EP118/24) — Empregados/Cargos, Viagens, Bens/Serviços/Equipamentos e Rateios/Impostos (US-101) — não uma dependência de um módulo externo inexistente.

`valorOrcado` já está disponível desde a conclusão da US-007 (`ValorOrcadoConta`, escopado por Proposta/Versão/exercício).

**Decisão de produto pendente (PO)**: um semáforo com `valorRealizado` parcial (ex: só contribuição de Rateios/US-101, sem Empregados) pode dar falso senso de segurança — conta parecer "Verde" só porque a maior parte do custo (folha de pessoal) ainda não foi lançada no sistema. Recomendação: **não liberar US-008a até que ao menos o módulo de Empregados/Cargos esteja no ar**, por ser tipicamente a maior massa de custo em Termos de Parceria. Revisar esta recomendação quando os módulos de custo estiverem sequenciados no backlog.

Sequência de backlog recomendada até aqui: US-007 (✅ concluída) → US-008 (limiares) → US-101 (Rateio/Imposto) → Empregados/Cargos (UC03.18-27) → Viagens (UC03.29-33) → Bens/Serviços/Equipamentos (UC03.34-36) → US-008a.



Como Orçamentista ou Gestor Financeiro (GFIN),

Quero visualizar um badge colorido (Verde/Amarelo/Laranja/Vermelho) na aba de Totalizadores de cada conta analítica, refletindo o consumo orçamentário atual frente aos limiares configurados na US-008,

Para identificar visualmente e rapidamente quais contas estão próximas ou já ultrapassaram seus limites de consumo, sem precisar calcular manualmente cada percentual. [RN_PLA_006]



Cenários de Aceite — US-008a

✅  Cenário 1 — Semáforo exibe Vermelho quando consumo ultrapassa o limiar Laranja

Dado que a conta 'Passagens Aéreas Nacionais' possui semaforoLaranjaPct=95 (configurado via US-008)

E que o consumo atual desta conta representa 97% do valor orçado

Quando o usuário acessa a aba de Totalizadores da Proposta

Então o sistema exibe o badge Vermelho na linha da conta [RN_PLA_006]

E o valor de consumo é calculado pelo TotalizerService: Valor Realizado / Valor Orçado



✅  Cenário 2 — Semáforo exibe Verde/Amarelo/Laranja conforme faixa de consumo

Dado que a conta possui os limiares configurados (Verde=70, Amarelo=85, Laranja=95)

Quando o consumo da conta está, respectivamente, abaixo de 70%, entre 70% e 85%, ou entre 85% e 95%

Então o sistema exibe o badge correspondente (Verde, Amarelo ou Laranja) na linha da conta



✅  Cenário 3 — Conta sem limiares configurados usa padrão global do sistema

Dado que a conta analítica não teve limiares configurados via US-008

Quando o usuário acessa a aba de Totalizadores

Então o sistema aplica os limiares padrão globais (a definir pelo PO/Tech Lead)

E exibe o badge normalmente com base nesses valores padrão



Aspecto

Detalhe

Tabelas afetadas

Nenhuma (somente leitura — ContaContabil para limiares, módulo de execução orçamentária para valor realizado/orçado)

Dependência de módulo

Ao menos um módulo de lançamento de custo (Empregados, Viagens, Bens/Serviços ou Rateios) — TotalizerService (ObtemSaldoContaAnalitica, hoje semSaldoDisponivel/stub) precisa passar a agregar os lançamentos reais desses módulos, não de execução orçamentária pública

Cálculo

percentualConsumo = valorRealizado / valorOrcado; badge = comparação contra os 3 limiares da conta (ou padrão global se não configurados)

Auditoria

Não aplicável — é leitura/exibição, sem alteração de dado



Definition of Done — US-008a

☐  Ao menos o módulo de Empregados/Cargos (maior massa de custo) disponível, fornecendo valorRealizado real por conta; valorOrcado já disponível via US-007

☐  TotalizerService (ou serviço equivalente) calcula percentual de consumo real

☐  Cenários 1 a 3 implementados e aprovados em homologação

☐  Padrão global de limiares definido para contas sem configuração própria (US-008)
