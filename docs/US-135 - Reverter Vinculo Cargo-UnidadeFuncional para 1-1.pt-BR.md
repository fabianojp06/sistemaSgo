## [US-135] — Reverter Vínculo Cargo↔Unidade Funcional de N:M (rateio) para 1:1

**Módulo:** Cadastros — Estrutura Funcional / Cargos e Salários (UC03.18/03.19, RN_CAR_02/08 da Rev. Jun/2026)
**Épico:** EP118/24
**Prioridade:** Alta
**Estimativa:** G
**Bloqueio:** requer ADR do Tech Lead (`techlead-fsg`) antes de qualquer código — reverte uma migration já aplicada em produção (ADR-026, 2026-08-06) sobre dado potencialmente já existente. Fluxo Git obrigatório: branch + PR (migration + regra de negócio financeira), conforme `CLAUDE.md`.

**Como** Usuário GRH,
**Quero** que cada Cargo esteja vinculado a exatamente 1 Unidade Funcional (sem rateio percentual entre setores),
**Para** que o custo do Cargo seja alocado de forma simples e integral ao setor selecionado, conforme a especificação vigente do documento Rev. Jun/2026 (RN_CAR_08).

### Contexto e Regras de Negócio

**Decisão do usuário (2026-08-13):** o documento `Tela-Cadastro-de-Cargos-Salarios-Rev-Jun2026.docx` declara "RN_CAR_02 REVOGADA — Rateio Removido... vínculo funcional é agora 1:1... Custo integral ao setor selecionado" (RN_CAR_08). Ao ser confrontado com o conflito — o schema real já migrou para N:M com rateio percentual via `CargoAlocacaoPercentual` (ADR-026, em produção desde 2026-08-06, validado com teste manual real) — o usuário confirmou que a intenção é **reverter para 1:1**, não manter o rateio.

Esta é uma reversão de arquitetura, não uma US nova de funcionalidade — precisa do mesmo rigor que motivou a criação do rateio em ADR-026: entender o que acontece com Cargos que **já têm rateio configurado com mais de 1 Unidade Funcional** (dado real possivelmente em produção) antes de qualquer migration.

**Perguntas que o Tech Lead precisa responder na ADR de reversão (não decidir na skill de AN/PO):**
1. Existem hoje, em produção, Cargos com `CargoAlocacaoPercentual` apontando para mais de 1 Unidade Funcional? Se sim, qual critério escolhe qual das Unidades "sobrevive" no novo vínculo 1:1 (maior percentual? mais recente? decisão manual por Cargo?).
2. `EmpregadoHeadcount.vinculoFuncionalHerdado` (que hoje reflete múltiplas alocações, ADR-026) precisa de ajuste de leitura ao voltar para 1:1?
3. A migration de reversão segue o mesmo padrão de 2 passos já usado em ADR-026 (recriar coluna FK direta + backfill a partir da alocação de maior percentual, depois dropar `CargoAlocacaoPercentual`)?
4. RN_EST_03 ("regra dos 100%"), introduzida justamente para validar o rateio, deixa de existir — confirmar que nenhuma outra regra do projeto depende dela antes de removê-la.

### Critérios de Aceite (sujeitos a ajuste após a ADR do Tech Lead)

**Cenário 1 — Cadastrar Cargo com vínculo único**
```gherkin
Dado que existe 1 Unidade Funcional Analítica na Proposta
Quando o usuário cadastra um Cargo selecionando essa Unidade via Tree Selection (seleção única, não múltipla)
Então o sistema persiste o vínculo 1:1
E o custo total do Cargo é alocado integralmente a essa Unidade (RN_CAR_08)
```

**Cenário 2 — Migração de dado existente com rateio**
```gherkin
Dado que um Cargo já tem CargoAlocacaoPercentual com 2 Unidades Funcionais (ex: 60%/40%)
Quando a migration de reversão é executada
Então o sistema aplica o critério definido pelo Tech Lead na ADR (ex: maior percentual) para escolher a Unidade única
E registra em log/auditoria a mudança para permitir conferência manual pós-migration
```

**Cenário 3 — Bloqueio: seleção múltipla de Unidade Funcional na UI**
```gherkin
Dado que o usuário está cadastrando ou editando um Cargo
Quando ele tenta selecionar mais de 1 Unidade Funcional na Tree Selection
Então o sistema permite apenas seleção única (RN_CAR_08)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Tabelas afetadas | `Cargo` (nova FK direta `unidadeFuncionalId`), `CargoAlocacaoPercentual` (removida após backfill) |
| Migration | 2 passos — criar FK + backfill a partir do critério definido na ADR, depois dropar `CargoAlocacaoPercentual`. **Risco de perda de dado se houver rateio real em produção com mais de 1 Unidade** — checar `prisma.count()` real antes de escrever a migration, mesmo padrão de cautela já usado em ADR-027/ADR-034. |
| Transação? | Sim — migration de dado, não código de aplicação |
| Requer lock? | Não |
| Auditoria | Registrar em `HistoricoOperacao` ou log de migration qual critério foi aplicado a cada Cargo migrado, para conferência manual |
| Regra de negócio | RN_EST_03 ("regra dos 100%") removida; `CargoPanel.tsx` volta de seleção múltipla com percentual para seleção única |

### Dependências

- ADR de reversão do Tech Lead (`techlead-fsg`) — **obrigatória antes de codificar**, responde as 4 perguntas acima
- Fluxo Git: branch + PR (migration + regra de negócio financeira), `/code-review` antes do merge

### Definition of Done

- [ ] ADR do Tech Lead produzida e aprovada
- [ ] `prisma.count()` real confirmando (ou não) a existência de rateio multi-unidade em produção antes de escrever a migration
- [ ] Migration de reversão testada com dado de rateio real (não só cenário vazio)
- [ ] `CargoPanel.tsx` ajustado para seleção única
- [ ] `/code-review` executado na branch antes do merge
