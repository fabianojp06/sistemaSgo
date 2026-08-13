## ADR-021: Funcionalidade ganha campo `tipo` (NAVEGAVEL/CONTEXTUAL)

**Status**: Aceito
**Data**: 2026-08-03
**Módulo SGO**: Tela Principal / Menu (UC01.03)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`adr021_funcionalidade_navegavel_contextual.md`) — a decisão já estava implementada em produção (commit `dbe62a1`) antes deste arquivo existir.

### Contexto

O menu principal apresentava links quebrados. Investigação revelou que, das 6 `Funcionalidade` seedadas no módulo "Cadastros", 4 não tinham link no menu não por mapa desatualizado, mas porque **nunca deveriam ter link próprio** — são ações contextuais dentro de outra tela (`plano-contas.classificar-natureza`, `.configurar-valor-orcado`, `.configurar-semaforo`, `.configurar-rateio-imposto`).

### Decisão

Novo enum `TipoFuncionalidade` (`NAVEGAVEL` | `CONTEXTUAL`) e campo `Funcionalidade.tipo` (default `NAVEGAVEL`). `ObterMenuUsuarioUseCase` + `src/app/page.tsx` passam a filtrar o menu por `tipo === 'NAVEGAVEL'`; funcionalidades `CONTEXTUAL` somem do menu principal (permissão continua checada dentro da tela onde a ação vive). O mapa manual `ROTA_POR_FUNCIONALIDADE` só precisa cobrir itens `NAVEGAVEL` a partir de agora.

**Padrão a repetir:** ao cadastrar qualquer `Funcionalidade` nova, decidir explicitamente `NAVEGAVEL` ou `CONTEXTUAL` antes de seedar.

### Consequências

- ✅ Elimina a classe inteira de "link quebrado no menu" para ações contextuais.
- ✅ Padrão reaproveitado em toda `Funcionalidade` nova desde então (`propostas.gerenciar-estrutura`, `propostas.criar-versao`, `propostas.restaurar-versao`, etc.).
- Migration `20260803220000_add_funcionalidade_tipo` (cria enum, adiciona coluna, UPDATE retroativo marcando as 4 chaves como CONTEXTUAL) aplicada em produção.
