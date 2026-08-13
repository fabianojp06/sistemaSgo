## ADR-020: Elegibilidade de Benefícios como tabela própria por (Empregado × TipoBenefício)

**Status**: Aceito
**Data**: 2026-08-03
**Módulo SGO**: Cadastros — Elegibilidade de Benefícios do Empregado (US-108a, UC03.28)
**Nota de proveniência**: documento reconstruído retroativamente em 2026-08-13 a partir da memória do projeto (`us108a_elegibilidade_beneficios_refinamento.md`) — a decisão já estava implementada em produção antes deste arquivo existir.

### Contexto

US-108a precisava resolver 2 pontos: (1) Vale Transporte era um 7º benefício ausente de US-107a/ADR-019 por lacuna documental; (2) o número de dependentes deveria ser um único campo no Empregado ou granular por benefício.

### Decisão

1. **Vale Transporte** vira retrabalho pontual em `Cargo` (novos `transporteAtivo`/`transporteValorUnitario`, mesma fórmula de VA/VR × `diasUteisPadrao`; `custoTotalCargo` passa a somar Transporte também).
2. Nova tabela **`EmpregadoBeneficioElegibilidade`** (1 linha por Empregado × `TipoBeneficioElegibilidade`, enum com 7 valores), com `numeroDependentes` próprio por linha. `EmpregadoHeadcount.numeroDependentes` (ADR-018) fica formalmente **deprecated** — mantido no schema por compatibilidade, mas deixa de ser fonte de verdade; `CadastrarEmpregadoUseCase`/`EditarEmpregadoUseCase` deixam de aceitá-lo como input.
3. Valores financeiros da elegibilidade são sempre lidos **ao vivo** do Cargo (não snapshot congelado como o custo do Empregado em ADR-018) — elegibilidade é registro de uso, não histórico de custo, então não precisa da mesma blindagem de imutabilidade.

### Consequências

- ✅ Granularidade real de dependentes por benefício, sem perder histórico de elegibilidade.
- ✅ Migration do Vale Transporte e da nova tabela aplicadas no mesmo pacote de mudança.
- ⚠️ `EmpregadoHeadcount.numeroDependentes` continua existindo no schema sem uso funcional — decisão consciente de não remover ainda; reavaliar remoção física numa limpeza futura.
- ⚠️ RN0274 (recálculo de Totalizadores de Benefícios) fora de escopo — `TotalizerService` formal ainda não existe.
