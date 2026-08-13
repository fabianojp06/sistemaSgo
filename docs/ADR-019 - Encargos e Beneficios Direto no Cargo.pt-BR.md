## ADR-019: Campos de Encargos/Benefícios direto em Cargo (sem tabela 1:1 separada)

**Status**: Aceito
**Data**: 2026-08-03
**Módulo SGO**: Cadastros — Benefícios do Cargo (US-107a, bloco C não numerado do UC03.19)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`us107a_beneficios_cargo_refinamento.md`) — a decisão já estava implementada em produção antes deste arquivo existir.

### Contexto

US-107a precisava decidir onde persistir os campos de Encargos Sociais e 6 Benefícios (VA/VR/Plano de Saúde/Odontológico/Seguro de Vida/Auxílio-Creche) do Cargo: campos diretos em `Cargo` ou uma tabela filha 1:1 separada.

### Decisão

Campos direto em `Cargo` (15 novos campos: encargos + 6 benefícios + `Cargo.custoTotalCargo` calculado = `salarioTotal` + Encargos + soma de Benefícios ativos) — sem tabela 1:1 separada, por não haver CRUD/cardinalidade próprios que justifiquem a divisão, e para evitar join extra numa tabela lida a cada cadastro de Empregado.

Decidido também nesta rodada: **sem tabela de parâmetros globais de Benefícios** — valores são digitados diretamente por Cargo, exceto `diasUteisPadrao` (novo campo em `ParametroSistema`, parametrizado por tenant, usado na fórmula VA/VR = valorUnitario × dias úteis).

### Consequências

- ✅ Sem join extra no caminho crítico de cadastro de Empregado.
- ✅ `EmpregadoHeadcount.custoTotalMensal` passou a herdar `custoTotalCargo` (não mais só `salarioTotal`).
- ⚠️ Sinalizado para reavaliar a divisão em tabela separada se um 5º bloco de dados for adicionado a `Cargo` no futuro (limite prático de campos soltos numa única tabela).
- ⚠️ RN_CAR_06 (alerta de mudança retroativa ao desativar benefício) ficou fora de escopo — sem mecanismo de notificação entre módulos ainda.
