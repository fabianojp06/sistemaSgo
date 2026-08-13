## ADR-031: Exclusão de Cargo — individual e em lote, soft delete, bloqueada se houver Empregado vinculado

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Cargos e Salários
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`adr031_exclusao_cargo.md`) — a decisão já estava implementada em produção (commit `3d2a525`) antes deste arquivo existir.

### Contexto

Tela de Cargos não tinha como excluir um Cargo, nem exclusão múltipla.

### Decisão

Soft delete (`ativo=false`, campo já existente em `Cargo`), bloqueado se houver `EmpregadoHeadcount` ativo vinculado (mesmo padrão de `InativacaoUnidadeFuncionalBloqueadaError`, US-106), restrito a Proposta RASCUNHO/EM_ELABORACAO. Lote é **tudo-ou-nada**: valida todos os IDs antes de excluir qualquer um, listando quais bloquearam se algum tiver empregados — evita exclusão parcial silenciosa.

Peças-chave: `ExcluirCargoUseCase`/`ExcluirCargosEmLoteUseCase`, `ExclusaoCargoBloqueadaError`, actions `excluirCargo`/`excluirCargosEmLote`, UI em `CargoPanel.tsx` (botão "Excluir" por linha, checkbox "Selecionar todos", botão "Excluir Selecionados (N)"), enum `TipoOperacao.CARGO_EXCLUIDO`.

### Consequências

- ✅ Tela de Cargos ganha paridade de exclusão com as demais telas do projeto.
- ✅ Lote tudo-ou-nada evita estado inconsistente (alguns excluídos, outros não, sem o usuário saber por quê).
- Se usuário tentar excluir Cargo com Empregado vinculado, a mensagem já lista quais cargos bloquearam — orientar a excluir/realocar os Empregados primeiro.
