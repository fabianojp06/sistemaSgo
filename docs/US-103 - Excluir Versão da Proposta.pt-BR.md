## [US-103] — Excluir Versão da Proposta

**Módulo:** Cadastros — Propostas / Termos de Parceria
**Épico:** EP118/24
**Prioridade:** Média
**Estimativa:** P

**Como** Orçamentista ou Gestor Financeiro (GFIN),
**Quero** excluir (logicamente) uma Versão de Proposta que ainda esteja em Rascunho ou Em Elaboração,
**Para** remover uma versão criada por engano ou abandonada, sem perder o histórico auditável e sem risco de apagar dado já vinculado a lançamentos reais.

### Contexto e Regras de Negócio

Esta US cobre o UC03.07 da Minuta V5. Nota de nomenclatura: o título do UC na Minuta diz "Excluir Proposta", mas todo o corpo do texto (pré-condições, fluxos, regras RN_EXC_001-004) trata de excluir uma **Versão/snapshot**, não a Proposta como entidade inteira — mesma inconsistência título-vs-corpo já observada em outros documentos deste épico. Esta US segue o corpo do texto: o alvo da exclusão é sempre uma `VersaoProposta`, nunca a `Proposta` (que não tem, e não precisa ter, um mecanismo de exclusão próprio — ela deixa de aparecer nas listagens naturalmente quando todas as suas versões estiverem inativas, mas isso é um comportamento de tela, fora do escopo desta US).

A exclusão é sempre lógica (`ativa = false` em `VersaoProposta`, já modelado desde o ADR-012) — nunca `DELETE` físico. Só é permitida para versões em status `RASCUNHO` ou `EM_ELABORACAO`. Uma versão nunca pode ser a única versão ativa de uma Proposta — isso deixaria a Proposta sem nenhuma versão vigente, violando a invariante estabelecida desde a US-102 (toda Proposta nasce com ao menos uma versão e deve manter ao menos uma ativa).

Escopo de "vínculos operacionais ativos" nesta primeira versão: hoje os únicos dados analíticos reais vinculados a uma `VersaoProposta` são `ValorOrcadoConta` (US-007) e `RateioImpostoGrade` (US-101). A checagem de bloqueio (RN_EXC_002) verifica a existência de registros nessas duas tabelas para a versão-alvo. Quando os módulos de Metas, Empregados/Headcount, Viagens e Bens/Serviços forem implementados, esta mesma checagem deve ser **estendida** para incluir essas tabelas — não reescrita do zero.

### Critérios de Aceite

**Cenário 1 — Exclusão bem-sucedida de versão sem vínculos**
```gherkin
Dado que a Proposta "PROP-2026-0001" possui duas versões ativas: Versão 1 (RASCUNHO) e Versão 2 (RASCUNHO, vigente)
E que a Versão 1 não possui nenhum registro em ValorOrcadoConta nem em RateioImpostoGrade
Quando o usuário solicita a exclusão da Versão 1
Então o sistema marca VersaoProposta.ativa = false para a Versão 1
E um log de auditoria é gravado em HistoricoOperacao com o payload completo da versão removida
E a Versão 1 deixa de aparecer nas listagens ativas, mas permanece no banco para histórico/auditoria
```

**Cenário 2 — Bloqueio por vínculos operacionais ativos [TRAVA O ERRO]**
```gherkin
Dado que a Versão 1 de uma Proposta possui ao menos um registro em ValorOrcadoConta ou em RateioImpostoGrade
Quando o usuário tenta excluir a Versão 1
Então o sistema bloqueia a exclusão
E exibe: "Exclusão Rejeitada [TRAVA O ERRO]: Operação bloqueada. A versão da proposta possui registros operacionais ou memórias de cálculo analíticas ativas vinculadas."
E nenhum dado é alterado no banco
```

**Cenário 3 — Bloqueio por ciclo de vida [TRAVA O ERRO]**
```gherkin
Dado que a versão-alvo está com status OFICIALIZADO ou ENCERRADO
Quando o usuário tenta excluí-la
Então o sistema bloqueia a operação
E exibe: "Ação Negada [TRAVA O ERRO]: O ciclo de vida atual do projeto não permite exclusão. Documentos oficializados ou encerrados são estritamente imutáveis."
```

**Cenário 4 — Bloqueio por ser a única versão ativa [TRAVA O ERRO]**
```gherkin
Dado que a Proposta possui apenas uma versão ativa (a Versão 1, RASCUNHO)
Quando o usuário tenta excluir essa única versão
Então o sistema bloqueia a operação
E exibe: "Exclusão Rejeitada [TRAVA O ERRO]: Não é possível excluir a única versão existente desta Proposta."
E nenhum dado é alterado no banco
```

### Impacto Técnico (orientação para dev)

| Aspecto           | Detalhe                                                  |
|-------------------|------------------------------------------------------------|
| Tabelas afetadas  | `VersaoProposta` (UPDATE — `ativa = false`), leitura em `ValorOrcadoConta` e `RateioImpostoGrade` (checagem de vínculos), `HistoricoOperacao` (INSERT) |
| Transação?        | Sim — checagem de vínculos + soft delete + log de auditoria em transação única |
| Requer lock?      | Não é necessário lock adicional — é uma operação de leitura-então-escrita sobre um registro que, se já estiver inativo ou oficializado, a própria condição de status já impede dupla execução concorrente problemática |
| Auditoria         | Registrar em `HistoricoOperacao`: tenantId, usuarioId, versaoId, propostaId, payload completo da versão no momento da exclusão |
| Regra de negócio  | Só permite exclusão em status RASCUNHO/EM_ELABORACAO; bloqueia se houver `ValorOrcadoConta` ou `RateioImpostoGrade` vinculados; bloqueia se for a única versão ativa da Proposta |

### Dependências

- ADR-012 (`VersaoProposta.ativa` já modelado)
- US-007 e US-101 (fornecem as tabelas de vínculo a checar: `ValorOrcadoConta`, `RateioImpostoGrade`)
- Quando Metas/Empregados/Viagens/Bens existirem: estender a checagem de vínculos (não substituir)

### Definition of Done

- [ ] Cenários 1 a 4 implementados e aprovados em homologação
- [ ] Nenhum `DELETE` físico em `VersaoProposta` — sempre `ativa = false`
- [ ] Bloqueio testado com `ValorOrcadoConta` vinculado e com `RateioImpostoGrade` vinculado, separadamente
- [ ] Bloqueio testado com versão sendo a única ativa da Proposta
- [ ] Log de auditoria gravado com payload completo da versão removida
- [ ] Operação testada com usuário sem permissão (deve bloquear no backend)
