US-004 

Criar Agrupador de Contas Analíticas 

 

Módulo: 

Cadastros — Plano de Contas 

Épico: 

EP118/24 

Perfil: 

Orçamentista / GFIN 

Prioridade: 

🟡 Média 

Estimativa: 

M 

Depende de: 

US-001 (contas N7 disponíveis) 

 

Como Orçamentista ou Gestor Financeiro (GFIN), 

Quero criar um Agrupador de Contas que consolide duas ou mais contas analíticas (N7) do ERP sob um rótulo personalizado SGO, 

Para gerar subtotais customizados nos relatórios orçamentários (Cronograma de Desembolso, Previsão de Despesas) sem alterar a hierarquia oficial do ERP Senior. [RF_PLA_REQ_005, RN_PLA_007, RN_PLA_008, RN_PLA_009] 

 

Cenários de Aceite — US-004 

 

✅  Cenário 1 — Criação de Agrupador válido com 2 ou mais contas N7 

Dado que o usuário acessa o painel de Agrupadores de Contas 

E que existem contas analíticas N7 sincronizadas no SGO 

Quando o usuário clica em [Novo Agrupador], preenche o nome 'Despesas com Passagens' e seleciona as contas 'Passagens Aéreas Nacionais' e 'Passagens Aéreas Internacionais' 

E clica em [Salvar Agrupador] 

Então o sistema valida nome único e mínimo de 2 contas N7 [RN_PLA_008] 

E persiste o Agrupador em tb_agrupador_contas com ativo = TRUE 

E persiste os vínculos em tb_agrupador_conta_item para cada conta selecionada 

E o Agrupador aparece imediatamente no painel, disponível para os relatórios do módulo Orçamentário [RN_PLA_009] 

E o log de criação é gravado em tb_historico_operacoes com tipo_operacao='INSERT' e payload completo [RN_PLA_004] 

 

 

✅  Cenário 2 — Mesma conta N7 participa de múltiplos Agrupadores simultaneamente 

Dado que a conta 'Passagens Aéreas Nacionais' já pertence ao Agrupador 'Despesas com Passagens' 

Quando o usuário cria um novo Agrupador 'Viagens Corporativas' e seleciona a mesma conta 'Passagens Aéreas Nacionais' junto com 'Diárias de Viagem' 

Então o sistema permite o vínculo sem conflito [RN_PLA_011] 

E a conta aparece em ambos os Agrupadores no painel 

E o TotalizerService calcula o valor de cada Agrupador de forma independente 

 

 

❌  Cenário 3 — Nome de Agrupador duplicado [TRAVA O ERRO] 

Dado que já existe um Agrupador com o nome 'Despesas com Passagens' cadastrado no tenant 

Quando o usuário tenta criar um novo Agrupador com o mesmo nome 

E clica em [Salvar Agrupador] 

Então o sistema bloqueia o salvamento [RN_PLA_008] 

E exibe o alerta: 'Já existe um Agrupador com este nome. Utilize um nome único.' 

E o modal permanece aberto com os dados preenchidos intactos para correção 

 

 

❌  Cenário 4 — Agrupador com menos de 2 contas N7 [TRAVA O ERRO] 

Dado que o usuário está criando um Agrupador e selecionou apenas 1 conta analítica 

Quando clica em [Salvar Agrupador] 

Então o sistema bloqueia o salvamento [RN_PLA_008] 

E exibe o alerta: 'O Agrupador deve ter um Nome preenchido e ao menos duas contas analíticas selecionadas.' 

E o modal permanece aberto com os dados preenchidos intactos 

 

 

❌  Cenário 5 — Agrupador com nome em branco [TRAVA O ERRO] 

Dado que o usuário está criando um Agrupador com 2 contas selecionadas mas sem preencher o Nome 

Quando clica em [Salvar Agrupador] 

Então o sistema bloqueia o salvamento 

E exibe o alerta: 'O Agrupador deve ter um Nome preenchido e ao menos duas contas analíticas selecionadas.' 

E o campo Nome é destacado visualmente em vermelho 

 

 

❌  Cenário 6 — Tentativa de vincular conta sintética N1–N6 ao Agrupador [TRAVA O ERRO] 

Dado que o usuário tenta selecionar uma conta sintética (Nível 1 a 6) no seletor de contas do modal de Agrupador 

Quando o seletor de contas é renderizado 

Então apenas contas analíticas N7 são exibidas como opções no seletor [RN_PLA_003] 

E contas sintéticas N1–N6 não aparecem na lista de seleção 

 

 

Aspecto 

Detalhe 

Tabelas afetadas 

tb_agrupador_contas (INSERT), tb_agrupador_conta_item (INSERT por conta), tb_historico_operacoes (INSERT) 

Transação? 

Sim — INSERT no agrupador + INSERT nos vínculos + log em transação única. Rollback total em falha 

Constraint banco

UNIQUE (tenantId, nome) em ContaAgrupadora [implementado]. Validação de conta analítica (N7) feita em código de aplicação, em CriarAgrupadorUseCase, via contaContabil.count({isAnalitica: true}) — não há trigger fn_check_conta_analitica no Postgres (ver Decisões do Debate)

Auditoria

tipo_operacao: AGRUPADOR_CRIADO | payload: agrupadorId, nome, contaIds, usuarioId, timestamp — gravado em HistoricoOperacao dentro da mesma transação

Relatórios

Agrupador disponível imediatamente no Cronograma de Desembolso (UC04.01) — não há campo `ativo` na tabela; todo Agrupador criado é considerado disponível (ver Decisões do Debate)



Decisões do Debate do Time (2026-07-30)



1. RN_PLA_007 — confirmada: significa que ContaAgrupadora é entidade 100% SGO, isolada da árvore importada do ERP (CRUD completo permitido, sem vínculo de escrita com ContaContabil). Não é regra de isolamento multi-tenant (isso já é coberto por tenantId em todas as tabelas).

2. Campo `ativo = TRUE` do Cenário 1 — texto desatualizado em relação à implementação. Não existe coluna `ativo` no schema (ContaAgrupadora) e não há necessidade de adicioná-la: todo Agrupador criado já é retornado por ListarAgrupadoresUseCase sem filtro de status. Decisão: manter o schema como está, sem migration; texto do Cenário 1 mantido apenas como referência histórica da intenção de negócio ("disponível imediatamente"), já satisfeita.

3. Trigger fn_check_conta_analitica — decisão do time: não implementar. A validação já ocorre em CriarAgrupadorUseCase (único ponto de escrita em ContaAgrupadoraItem hoje), é testável em unit test e evita lógica de negócio em PL/pgSQL. Reavaliar apenas se surgir uma segunda via de escrita nessa tabela (import em lote, script administrativo, etc.).

4. Transação interativa (prisma.$transaction(async (tx) => {...})) em CriarAgrupadorUseCase — mesmo padrão que causou falha no sync do plano de contas com o pooler do Supabase (commit 814d57e). Risco considerado menor aqui (3 writes fixos, não um loop dinâmico), não bloqueia a US, mas registrado como débito técnico a revisar se houver instabilidade em produção.

5. Cenário 2 (mesma conta em múltiplos Agrupadores) não tinha teste automatizado — TotalizerService usa hoje um stub que sempre retorna saldo zero (não há módulo de empenho/liquidação implementado), então o comportamento nunca era exercitado com valores reais. Teste adicionado em ListarAgrupadoresUseCase.test.ts injetando saldo fake por conta, confirmando totais independentes por Agrupador mesmo com conta compartilhada.



Definition of Done — US-004

☑  Cenários 1, 3, 4, 5 implementados e cobertos por teste automatizado (CriarAgrupadorUseCase.test.ts)

☑  Cenário 2 implementado e coberto por teste automatizado (ListarAgrupadoresUseCase.test.ts)

☑  Agrupador disponível nos relatórios imediatamente após criação (sem campo `ativo` — ver Decisões do Debate, item 2)

☑  Participação múltipla da mesma conta em diferentes agrupadores validada (N:N)

☑  Validação de conta analítica (N7) implementada em CriarAgrupadorUseCase e testada — decisão do time de não usar trigger de banco (ver Decisões do Debate, item 3)

☐  Seletor exibe apenas contas N7 no modal — pendente de verificação de UI/frontend (fora do escopo dos use cases já auditados)

☑  Log de criação com payload completo gravado 