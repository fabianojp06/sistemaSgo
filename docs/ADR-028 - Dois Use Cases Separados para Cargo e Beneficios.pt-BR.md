## ADR-028: Cargo e Benefícios permanecem use cases separados, orquestrados só na Server Action

**Status**: Aceito
**Data**: 2026-08-06
**Módulo SGO**: Cadastros — Tela de Cargos (US-117)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir de `CONTEXTO_SESSOES.md` (seção 2026-08-06, 14h18–21h11 UTC) — a decisão já estava implementada em produção (commit `96fce36`) antes deste arquivo existir.

### Contexto

1ª rodada de feedback de teste manual (`docs/testeHml/empregados.docx`) reportou 2 botões de salvar na tela de Cargo (dados + benefícios) — confuso para o usuário.

### Decisão

Manter `CadastrarCargoUseCase`/`ConfigurarBeneficiosCargoUseCase` **separados** (não fundir) — orquestrar só na Server Action (`salvarCargoCompleto`), com contrato de erro parcial: Cargo salvo mesmo se Benefícios falhar.

### Consequências

- ✅ Um único botão "Salvar" na UI, sem acoplar os 2 use cases no domínio.
- ✅ Erro parcial (Cargo ok, Benefícios falhou) é reportado sem desfazer o que já foi salvo — evita frustração de perder o cadastro do Cargo por um erro de campo em Benefícios.
- Ver [[US-117]] para o restante da entrega desta sessão (US-108b, US-113b).
