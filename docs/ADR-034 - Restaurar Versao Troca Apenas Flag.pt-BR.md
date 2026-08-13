## ADR-034: Restaurar Versão troca apenas a flag `vigente`, sem copiar dados

**Status**: Aceito
**Data**: 2026-08-07
**Módulo SGO**: Cadastros — Propostas, Restaurar Versão (US-120)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-07 17:15 UTC) — a decisão já estava implementada em produção (commit `58cfbc9`) antes deste arquivo existir.

### Contexto

Próxima peça natural depois de US-119 (Criar Nova Versão): restaurar uma versão antiga como vigente, com modal de confirmação.

### Decisão

Use case **novo e separado** (`RestaurarVersaoPropostaUseCase`), não extensão de `CriarVersaoPropostaUseCase` — são operações de negócio diferentes (cópia de dados vs. reposicionamento de flag) e acoplar as duas arriscaria quebrar a suíte de US-119. Restaurar troca **apenas a flag `vigente`** — a versão restaurada mantém seu `numeroVersao` original, sem copiar dados; justificado por `ContaContabil` nunca ser hard-deleted nem ter flag de inativação, então não há risco de FK órfã ao reativar uma versão antiga. Restaurar uma versão excluída (`ativa=false`, via US-103) também a **reativa** (`ativa=true`).

**Risco de produção identificado explicitamente:** novo valor de enum `TipoOperacao` (`VERSAO_PROPOSTA_RESTAURADA`) exige `ALTER TYPE ... ADD VALUE`, que precisa ser aplicado *antes* de qualquer deploy de código que grave esse valor — migration `20260807171048_add_versao_proposta_restaurada_enum` aplicada em produção antes do código.

### Consequências

- ✅ Operações de negócio semanticamente distintas (cópia vs. flag) mantidas em use cases distintos — reduz risco de regressão cruzada.
- ✅ Ordem de deploy (migration antes do código que consome o novo valor de enum) virou padrão a repetir para qualquer `ALTER TYPE ... ADD VALUE`.
- Sem lock pessimista (mesma decisão de ADR-033 para VersaoProposta).
