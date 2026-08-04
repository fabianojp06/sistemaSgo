US-007

Configurar Valor Orçado por Conta Analítica e Exercício



Módulo:

Cadastros — Plano de Contas

Épico:

EP118/24

Perfil:

Orçamentista / GFIN

Prioridade:

🔴 Alta

Estimativa:

M

Depende de:

US-001 (contas N7 sincronizadas)



Nota de origem (Debate do Time, 2026-07-30, revisado em 2026-07-31)

Esta US foi solicitada explicitamente pelo Orçamentista/GFIN (dono do produto) como pré-requisito da US-008a ("Exibir Badge do Semáforo Orçamentário"), hoje bloqueada por falta de dado real de valor orçado por conta. TotalizerService (src/domain/plano-contas/TotalizerService.ts) tem o ponto de extensão ObtemSaldoContaAnalitica pronto para receber esse dado assim que esta US existir.

Revisão de escopo (2026-07-31): o valor orçado NÃO é um dado solto por (tenant, conta, exercício). Cada parceiro/cliente pode ter várias Propostas (Termos de Parceria), e cada Proposta pode ter várias Versões. O valor orçado por conta analítica é sempre lançado dentro do contexto de uma Proposta/Versão específica — isolado de qualquer outra proposta, mesmo quando usam a mesma conta analítica e o mesmo exercício. Isto é: se a Proposta do Cliente A lança R$ 1.000,00 na conta 'Salários' e a Proposta do Cliente B lança R$ 2.000,00 na mesma conta, cada proposta enxerga somente o seu próprio valor — não há soma nem visão cruzada entre propostas.

Esta US-007 é o motor de configuração e totalização do valor por conta dentro de uma Proposta/Versão. As US futuras que tratam do lançamento de itens de custo do orçamento (ex: "lançar passagens aéreas", "lançar diárias") no nível da Proposta ainda serão detalhadas pelo PO e deverão gravar/atualizar o mesmo dado que esta US define (ValorOrcadoConta), respeitando o mesmo escopo de isolamento.

Decisão de escopo confirmada com o usuário: o valor é vinculado a exercício orçamentário E à Proposta/Versão (não é um campo único e livre) — permite histórico de exercícios anteriores, versionamento de propostas, e é aderente ao ciclo LOA/PPA. Isso implica uma nova tabela (ValorOrcadoConta) associada a Proposta/Versão, não um campo direto em ContaContabil.



Como Orçamentista ou Gestor Financeiro (GFIN),

Quero informar o valor orçado de cada conta analítica (N7) por exercício orçamentário, dentro do contexto de uma Proposta e sua Versão vigente, com o somatório subindo automaticamente pela hierarquia até as contas sintéticas (N1–N6) correspondentes,

Para que cada Proposta reflita a distribuição orçamentária real por rubrica, de forma isolada de outras propostas do mesmo ou de outros clientes, servindo de base para o Semáforo Orçamentário (US-008a) e demais relatórios de execução, sem exigir cálculo manual do totalizador em cada nível da árvore. [RF_PLA_REQ_003, RN_PLA_012, RN_PLA_013, RN_PLA_014]



Contexto e Regras de Negócio

O Plano de Contas é sincronizado do ERP Senior (US-001) e é hierárquico: contas sintéticas (N1–N6) agregam contas analíticas (N7, isAnalitica=true), que são os únicos nós-folha. O valor orçado só tem sentido de entrada manual na conta analítica — é onde a despesa de fato ocorre; toda conta sintética deriva seu valor exclusivamente da soma de suas contas-filhas diretas, propagada recursivamente até a raiz (RN_PLA_012).

O valor é escopado por exercício orçamentário — ano — (RN_PLA_013) e, adicionalmente, por Proposta e Versão da Proposta (RN_PLA_014): um mesmo parceiro/cliente pode ter várias Propostas, e cada Proposta pode ter várias Versões ao longo do tempo (ex: versão em elaboração, versão aprovada, versão revisada). Cada Proposta/Versão mantém seu próprio conjunto de valores por conta analítica, totalmente isolado de qualquer outra Proposta — mesma conta analítica e mesmo exercício em duas Propostas diferentes não se somam nem se sobrescrevem entre si.

Ao criar uma nova Versão de uma Proposta existente, o sistema copia os valores por conta analítica da Versão anterior como ponto de partida (RN_PLA_015) — o usuário ajusta a partir dali; a Versão anterior permanece intacta e consultável como histórico. O Semáforo Orçamentário (US-008a) sempre opera sobre a Versão vigente (a mais recente) da Proposta; versões anteriores não exibem badge ativo, apenas ficam disponíveis para consulta histórica.



Critérios de Aceite — US-007

✅  Cenário 1 — Configuração válida de valor em conta analítica dentro de uma Proposta/Versão

Dado que o usuário acessa o painel de valores orçados da Versão vigente da Proposta 'TP-2026-014' (Cliente A), exercício 2026

E que existe a conta analítica 'Salários' (N7) sem valor configurado nesta Proposta/Versão para 2026

Quando o usuário informa o valor R$ 1.000,00 e confirma

Então o sistema persiste o valor em ValorOrcadoConta (tenantId, propostaId, versaoId, contaId, exercicio=2026, valor=1000.00)

E os totais de todas as contas sintéticas ancestrais (pai, avô, ... até a raiz), dentro desta mesma Proposta/Versão, são recalculados imediatamente para o exercício 2026

E o log de auditoria é gravado com valor anterior (nulo/zero) e posterior, contendo propostaId e versaoId [RN_PLA_004]



✅  Cenário 2 — Alteração de valor recalcula toda a cadeia de ancestrais dentro da mesma Proposta/Versão

Dado que a conta analítica 'Salários' possui valor R$ 1.000,00 no exercício 2026, na Versão vigente da Proposta 'TP-2026-014'

E que sua conta sintética avó (N5) tem valor total de R$ 4.000,00 somando 4 contas analíticas, nesta mesma Proposta/Versão

Quando o usuário altera o valor de 'Salários' para R$ 1.800,00

Então o sistema atualiza o valor da conta N7 para R$ 1.800,00 nesta Proposta/Versão

E recalcula e persiste o novo total da conta N6 (pai imediato), da N5 (avô) e de todos os níveis acima, até a raiz N1, sempre restrito a esta mesma Proposta/Versão

E o log de auditoria é gravado com delta (valor anterior e posterior) [RN_PLA_004]



✅  Cenário 3 — Isolamento entre Propostas de clientes diferentes na mesma conta e exercício

Dado que a Proposta 'TP-2026-014' (Cliente A) possui valor R$ 1.000,00 na conta 'Salários', exercício 2026

E que a Proposta 'TP-2026-030' (Cliente B) possui valor R$ 2.000,00 na mesma conta 'Salários', mesmo exercício 2026

Quando o usuário acessa o painel de valores orçados da Proposta 'TP-2026-030'

Então o sistema exibe R$ 2.000,00 para a conta 'Salários', sem qualquer soma ou interferência do valor da Proposta 'TP-2026-014' [RN_PLA_014]

E o mesmo isolamento se aplica aos totais das contas sintéticas ancestrais — cada Proposta/Versão tem sua própria árvore de totais



✅  Cenário 4 — Nova Versão da Proposta copia os valores da Versão anterior

Dado que a Proposta 'TP-2026-014' tem Versão 1 com valor R$ 1.000,00 na conta 'Salários' e totais já calculados nas sintéticas ancestrais, exercício 2026

Quando o usuário cria a Versão 2 desta Proposta

Então o sistema copia, para a Versão 2, o valor de R$ 1.000,00 na conta 'Salários' e os totais correspondentes das sintéticas ancestrais, como ponto de partida

E a Versão 1 permanece inalterada e consultável [RN_PLA_015]

E o log de auditoria registra a criação da Versão 2 com origem na Versão 1



❌  Cenário 5 — Tentativa de inserir valor em conta sintética [TRAVA O ERRO]

Dado que o usuário tenta informar um valor diretamente em uma conta sintética (N1–N6, isAnalitica=false), em qualquer Proposta/Versão

Quando o sistema renderiza o seletor/campo de valor

Então o campo de valor não é exibido ou é somente leitura para contas sintéticas [RN_PLA_012]

E, caso a tentativa chegue ao backend por qualquer via, o sistema bloqueia com o alerta: 'Valor não pode ser inserido diretamente em conta sintética. O valor é calculado automaticamente pela soma das contas analíticas filhas.'



❌  Cenário 6 — Valor negativo ou não numérico [TRAVA O ERRO]

Dado que o usuário está configurando o valor de uma conta analítica em uma Proposta/Versão

Quando informa um valor negativo (zero é permitido, negativo não) ou um valor não numérico

E tenta salvar

Então o sistema bloqueia o salvamento

E exibe o alerta: 'Valor Inválido: informe um valor monetário maior ou igual a zero.'



✅  Cenário 7 — Consulta de valor por exercício anterior preserva histórico dentro da mesma Proposta/Versão

Dado que a conta 'Salários', na Versão vigente da Proposta 'TP-2026-014', teve valor R$ 900,00 configurado no exercício 2025

E no exercício 2026 foi configurado o valor R$ 1.000,00, na mesma Proposta/Versão

Quando o usuário consulta o painel de valores do exercício 2025 desta Proposta

Então o sistema exibe R$ 900,00 para a conta, sem interferência do valor de 2026 [RN_PLA_013]



Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | Nova tabela `ValorOrcadoConta` (INSERT/UPDATE); leitura recursiva de `ContaContabil` (idPai/filhas) para recálculo de ancestrais; `HistoricoOperacao` (INSERT). Depende de entidades de Proposta/Versão (a serem confirmadas com Tech Lead — presume-se `Proposta` e `PropostaVersao` já existentes ou a criar em US correlata) |
| Modelo sugerido   | `ValorOrcadoConta { id, tenantId, propostaId (FK Proposta), versaoId (FK PropostaVersao), contaId (FK ContaContabil, deve ser isAnalitica=true), exercicio Int, valor Decimal, createdAt, updatedAt }` com `@@unique([tenantId, versaoId, contaId, exercicio])` |
| Totais de sintéticas | Não persistidos como coluna própria nesta primeira versão — calculados sob demanda por soma recursiva das folhas descendentes, no mesmo exercício e na mesma Proposta/Versão (ver Nota Técnica abaixo) OU persistidos e recalculados em cascata — decisão do Tech Lead |
| Cópia entre versões | Ao criar nova `PropostaVersao`, copiar todas as linhas de `ValorOrcadoConta` da versão de origem para a nova versão (novos registros, novo `versaoId`), preservando a versão de origem intacta |
| Transação?        | Sim — insert/update do valor + (se persistido) recálculo em cascata + log em transação única. Cópia de versão também é transação única (todas as contas ou nenhuma) |
| Requer lock?      | Sim, lock otimista ou transação serializável por (versaoId, contaId) durante recálculo de ancestrais, para evitar condição de corrida entre duas alterações concorrentes na mesma Proposta/Versão |
| Regra de negócio  | Valor só é aceito em conta com isAnalitica=true; valor ≥ 0; escopo por (tenantId, propostaId, versaoId, contaId, exercicio); nenhuma leitura ou escrita pode vazar entre propostaId/versaoId diferentes |
| Auditoria         | Registrar em `HistoricoOperacao`: ator, data, propostaId, versaoId, contaId, exercicio, valor anterior e novo |

Nota Técnica (para o Tech Lead decidir): a US não prescreve se o total da conta sintética deve ser persistido (coluna calculada, recalculada em cascata a cada alteração) ou calculado sob demanda (query recursiva, sem persistência). Isso é uma decisão de arquitetura — favor avaliar trade-off de consistência vs. performance antes de modelar. Fica também para o Tech Lead confirmar o modelo de dados de `Proposta` e `PropostaVersao` (se já existem em outra US ou precisam ser criados como pré-requisito desta).



Dependências

- US-001: contas N7 sincronizadas e disponíveis
- US correlata (a detalhar pelo PO): estrutura de dados de Proposta e Versão de Proposta — pré-requisito de modelagem para esta US, caso ainda não exista
- US correlata (a detalhar pelo PO): lançamento de itens de custo do orçamento por rubrica (ex: passagens, diárias, pessoal), que escreverá em ValorOrcadoConta usando o mesmo contrato de escopo definido aqui
- Desbloqueia US-008a (Exibir Badge do Semáforo): fornece o dado real de "Valor Orçado" da Versão vigente da Proposta, que o TotalizerService precisa



Definition of Done — US-007

☐  Cenários 1 a 7 implementados e aprovados em homologação

☐  Totais de contas sintéticas refletem corretamente a soma recursiva das analíticas filhas, em todos os níveis, para o exercício e a Proposta/Versão corretos

☐  Valor não pode ser inserido em conta sintética, nem via UI nem via backend

☐  Valores de exercícios diferentes não se misturam (isolamento por exercício)

☐  Valores de Propostas diferentes não se misturam, mesmo usando a mesma conta e o mesmo exercício (isolamento por propostaId/versaoId)

☐  Nova Versão de uma Proposta copia corretamente os valores da Versão anterior, sem alterar a Versão de origem

☐  Log de auditoria com delta gravado, incluindo propostaId e versaoId
