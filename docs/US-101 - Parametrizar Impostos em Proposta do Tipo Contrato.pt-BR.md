US-101

Parametrizar Impostos em Proposta



Módulo:

Central de Cálculos — Aba Imposto

Épico:

EP118/24

Perfil:

Orçamentista / GFIN

Prioridade:

🔴 Alta

Estimativa:

G

Depende de:

Proposta com Versão vigente em status RASCUNHO ou EM_ELABORACAO (ADR-012); alíquotas cadastradas em AliquotaImpostoParametro (Módulo de Administração)



Nota de origem (Debate do Time, 2026-07-30; revisado em 2026-07-31)

Título original desta US era "Parametrizar Impostos em Proposta do Tipo Contrato" — ajustado para "Parametrizar Impostos em Proposta" porque a US agora cobre explicitamente também o comportamento de Termo de Parceria (Cenário 5), não só Contrato.

Revisão de escopo (2026-07-31): a primeira versão desta US usava nomenclatura de outro contexto (tabelas `tb_proposta`, `tb_rateio_imposto_grade`, `tb_historico_operacoes`, padrões Java/JPA como `@Version` e `BigDecimal`) copiada do dicionário de campos UC03.01 sem adaptar à stack real do projeto (Next.js/Prisma/TypeScript). Corrigido para usar as entidades reais já implementadas: `Proposta` e `VersaoProposta` (ADR-012, US-007/US-008), com enum de status `RASCUNHO | EM_ELABORACAO | OFICIALIZADO | ENCERRADO` (sem "Cancelado" — confirmado pelo usuário/PO na revisão da US-007).

Grão de dados esclarecido: `RateioImpostoGrade` é uma linha por **(versão da Proposta × tributo × competência/mês)** — não por (versão × mês) como a redação original sugeria vagamente. Cada tributo selecionado (PIS, COFINS, ISS, ou outro cadastrado via UC03.01) tem sua própria linha por mês, permitindo desmarcar/remarcar tributos independentemente (ver Cenário 3).

`AliquotaImpostoParametro` entra como pré-requisito de dados explícito: é uma tabela de parâmetros fiscais **global por tenant** (não por Proposta), com vigência temporal — nunca hardcoded no código-fonte (RN_TAX_01, Anti-Hardcode). Cadastrada previamente pelo Módulo de Administração ou via atalho inline [Novo Imposto] (UC03.01, Fluxo Alt. C — fora do escopo desta US).



Como Orçamentista ou Gestor Financeiro (GFIN),

Quero selecionar os tributos que incidem sobre a Proposta (PIS, COFINS, ISS e outros cadastrados) e preencher a grade mensal de valores por competência, acionando o cálculo automático do Valor Global,

Para registrar a memória de cálculo fiscal completa por competência, garantindo precisão na projeção orçamentária da Proposta e rastreabilidade para fins de auditoria — respeitando a imunidade tributária de Termos de Parceria. [RF_TAX_001, RF_TAX_002, RF_TAX_003, RN_PRO_010]



Contexto e Regras de Negócio

A Aba Imposto é a interface de governança fiscal da Central de Cálculos do SGO. Seu comportamento depende do campo `Proposta.tipo`:

- **Contrato**: todos os tributos cadastrados (PIS, COFINS, ISS, outros) ficam disponíveis para seleção. A aba injeta as alíquotas vigentes de `AliquotaImpostoParametro` na data de início da Proposta (`Proposta.dataInicio`) e abre a grade mensal para preenchimento de valores por competência, cobrindo todos os meses entre `dataInicio` e `dataFim`.
- **Termo de Parceria** (`TipoProposta.TERMO_DE_PARCERIA`): PIS e COFINS são zerados e bloqueados automaticamente por imunidade tributária de fomento (RN_PRO_010) — não aparecem como opção editável. Apenas ISS permanece configurável.

O motor tributário processa os dados e atualiza sincronamente o Valor Global da Proposta. Toda a operação é atômica: upsert da grade + atualização do Valor Global + log de auditoria em uma única transação. [RN_TAX_01, RN_TAX_02, RNF_TAX_001, RNF_TAX_005]

A grade só é editável quando a Versão vigente da Proposta está em status `RASCUNHO` ou `EM_ELABORACAO`; ao ser `OFICIALIZADO`, os dados fiscais congelam (RN_TAX_03), consistente com o mesmo padrão de imutabilidade já aplicado a `ValorOrcadoConta` (US-007) e aos limiares do Semáforo (US-008).



Critérios de Aceite — US-101

✅  Cenário 1 — Parametrização completa de impostos e salvamento bem-sucedido em Contrato

Dado que o usuário está autenticado com perfil de escrita no módulo orçamentário

E que a Proposta é do tipo CONTRATO e sua Versão vigente está em status RASCUNHO ou EM_ELABORACAO

E que as alíquotas de PIS (9,25%), COFINS (7,60%) e ISS (3,00%) estão cadastradas e vigentes em AliquotaImpostoParametro para este tenant

Quando o usuário acessa a Central de Cálculos > Aba Impostos da Proposta

Então o sistema renderiza os checkboxes de PIS, COFINS e ISS com as alíquotas vigentes injetadas automaticamente [RN_TAX_01]

E a grade mensal é exibida cobrindo todos os meses entre `dataInicio` e `dataFim` da Proposta

Quando o usuário marca os checkboxes de PIS e ISS, preenche todos os meses com valores (nenhum em branco) e clica em [Salvar]

Então o sistema executa as validações síncronas (RN_TAX_01 a RN_TAX_04) sem identificar inconsistências

E persiste uma linha em RateioImpostoGrade por (versaoId, tributo, competência) com `aliquotaAplicadaSnapshot` = alíquota vigente no momento do salvamento [RN_TAX_03]

E o serviço de totalização recalcula e atualiza o Valor Global da Proposta (campo Read-only, [ORIGEM BLINDADA])

E o tempo total da operação não excede 2,0 segundos para até 1.000 linhas na grade [RNF_TAX_001]

E um log de auditoria é gravado em HistoricoOperacao com estado anterior e posterior, usuarioId e timestamp [RNF_TAX_005]

E o sistema exibe a mensagem de sucesso e mantém a tela aberta para continuidade



✅  Cenário 2 — Abertura da aba consulta alíquota vigente na data de início da Proposta

Dado que a Proposta tem `dataInicio` em 01/03/2025

E que a alíquota de ISS vigente em 01/03/2025 é de 3,00% e uma nova alíquota de 4,00% vigorará a partir de 01/01/2026

Quando o usuário abre a Aba Impostos desta Proposta

Então o sistema injeta a alíquota de ISS = 3,00% (vigente na data de início) [RN_TAX_01]

E a alíquota de 4,00% não é exibida nem aplicada a esta Proposta



✅  Cenário 3 — Desmarcação de um imposto remove seus valores da grade e do Valor Global

Dado que os impostos PIS e ISS estão marcados e salvos na grade fiscal da Versão vigente da Proposta

Quando o usuário desmarca o checkbox do PIS e clica em [Salvar]

Então o sistema remove (ou marca como inativas) todas as linhas de RateioImpostoGrade do tributo PIS para esta versaoId

E o serviço de totalização recalcula o Valor Global excluindo os valores do PIS

E o log de auditoria registra a mudança, incluindo o tributo removido



❌  Cenário 4 — Tentativa de salvar Proposta com Versão Oficializada [TRAVA O ERRO]

Dado que a Versão vigente da Proposta está com status OFICIALIZADO

Quando o usuário tenta modificar qualquer célula ou salvar a grade de impostos

Então o backend rejeita o commit com rollback imediato [RN_TAX_03]

E o sistema exibe: "Ação Negada [TRAVA O ERRO]: Esta Proposta está oficializada e seus dados fiscais estão congelados. Nenhuma alteração é permitida."

E nenhum dado é alterado na base



✅  Cenário 5 — Termo de Parceria zera e bloqueia PIS e COFINS automaticamente [RN_PRO_010]

Dado que a Proposta é do tipo TERMO_DE_PARCERIA

Quando o usuário acessa a Aba Impostos desta Proposta

Então os checkboxes de PIS e COFINS aparecem desmarcados e desabilitados, sem alíquota exibida

E o checkbox de ISS aparece normalmente, disponível para seleção e configuração

Quando o usuário tenta, por qualquer via (inclusive chamada direta ao backend), habilitar PIS ou COFINS para esta Proposta

Então o sistema bloqueia a operação e exibe: "Termos de Parceria possuem imunidade tributária — PIS e COFINS não podem ser aplicados (RN_PRO_010)."

E nenhuma linha de RateioImpostoGrade é criada para PIS/COFINS nesta versaoId



Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | Novas: `AliquotaImpostoParametro` (parâmetro global por tenant, com vigência), `RateioImpostoGrade` (grão: versaoId × tributo × competência). Leitura/atualização: `Proposta` (tipo, status via VersaoProposta), `HistoricoOperacao` (INSERT) |
| Modelo sugerido — AliquotaImpostoParametro | `{ id, tenantId, nome, aliquotaPct Decimal, dataInicioVigencia DateTime, tipoIncidencia enum(CONTRATO\|TERMO_DE_PARCERIA\|AMBOS), createdAt, updatedAt }` — `@@unique([tenantId, nome])` case-insensitive (RN_TAX_05, ver UC03.01) |
| Modelo sugerido — RateioImpostoGrade | `{ id, tenantId, versaoId (FK VersaoProposta), aliquotaParametroId (FK AliquotaImpostoParametro), competencia DateTime (primeiro dia do mês), valorDeclarado Decimal, aliquotaAplicadaSnapshot Decimal, createdAt, updatedAt }` — `@@unique([tenantId, versaoId, aliquotaParametroId, competencia])` |
| Transação?        | Sim — upsert em lote da grade + atualização do Valor Global + log de auditoria em transação única. Rollback total em falha |
| Requer lock?      | Sim — mesmo padrão de transação por `versaoId` já adotado em US-007 (`ConfigurarValorOrcadoContaUseCase`), para evitar condição de corrida entre duas edições concorrentes da mesma Versão |
| Regra de negócio  | PIS/COFINS bloqueados para TERMO_DE_PARCERIA (RN_PRO_010); alíquota sempre snapshot no momento do salvamento (RN_TAX_03); grade só editável em versão RASCUNHO/EM_ELABORACAO; nenhuma célula em branco ao salvar (RN_TAX_04) |
| Auditoria         | Registrar em `HistoricoOperacao`: tenantId, usuarioId, versaoId, tributo(s) alterado(s), competência, valor anterior e novo |

Nota Técnica (para o Tech Lead decidir): confirmar se `RateioImpostoGrade` deve ter índice de performance para consultas por `(tenantId, versaoId)` (mesma leitura em lote de toda a grade), e revisar a estratégia de lock (a US-007 usou transação por `versaoId`, sem `SELECT FOR UPDATE` explícito — avaliar se esta US precisa de algo mais forte dado o volume potencial de 1.000 linhas por grade).



Dependências

- Proposta/VersaoProposta (ADR-012) — já implementado (US-007, US-008)
- AliquotaImpostoParametro precisa ser modelada como pré-requisito desta própria US (não é uma US separada — é dado de parametrização, análogo aos limiares padrão do Semáforo, ADR-013)
- Desbloqueia parcialmente US-008a (Semáforo Orçamentário): RateioImpostoGrade é uma das fontes de `valorRealizado` (ver nota de bloqueio revisada da US-008a)



Definition of Done — US-101

☐  Cenários 1 a 5 implementados e aprovados em homologação

☐  Alíquota injetada corretamente com base na `dataInicio` da Proposta (não na data atual)

☐  Serviço de totalização atualiza Valor Global da Proposta após cada save (validado com inspeção de banco)

☐  Operação ≤ 2,0s validada com grade de 1.000 linhas

☐  Log de auditoria gravado com todos os campos obrigatórios

☐  Termo de Parceria bloqueia PIS/COFINS nativamente, sem depender de validação apenas no frontend

☐  Tentativa de edição em Versão Oficializada bloqueada no backend (não só na UI)
