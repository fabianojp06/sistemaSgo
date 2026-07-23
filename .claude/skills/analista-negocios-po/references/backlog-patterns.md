# Backlog Patterns — SGO 2.0
 
Guia de priorização, refinamento e rastreabilidade.
 
---
 
## Estrutura do Backlog do SGO 2.0
 
```
Produto: SGO 2.0
│
├── EP-001 — Ciclo de Execução da Despesa (empenho → liquidação → pagamento)
├── EP-002 — Gestão de Dotações Orçamentárias
├── EP-003 — Relatórios de Execução Orçamentária
├── EP-004 — Controle de Acesso e Perfis
├── EP-005 — Gestão do Termo de Parceria (OSCIP)
├── EP-006 — Prestação de Contas (OSCIP)
├── EP-007 — Workflow de Aprovações (WA_01 a WA_06)
├── EP-008 — Integrações (SIAFI, SIGCON, sistemas do concedente)
└── EP-009 — Auditoria e Rastreabilidade
```
 
---
 
## Critérios de Priorização
 
Usar score ponderado. Pontuar cada US de 1 a 5 em cada critério:
 
| Critério                    | Peso | Descrição                                              |
|------------------------------|------|----------------------------------------------------------|
| Obrigatoriedade legal       | 3×   | A funcionalidade é exigida por lei ou normativo?       |
| Impacto financeiro          | 2×   | Erros podem causar perda financeira ou glosa?          |
| Bloqueio de outras stories  | 2×   | Outras US dependem desta?                              |
| Frequência de uso           | 1×   | Quantos usuários usam e com que frequência?            |
| Complexidade de entrega     | −1×  | Quanto mais complexo, menor a prioridade relativa      |
 
**Score = (legal × 3) + (financeiro × 2) + (bloqueio × 2) + (frequência × 1) − (complexidade × 1)**
 
---
 
## Checklist de Refinamento de Story
 
Antes de mover uma US para "pronta para desenvolvimento", verificar:
 
### Clareza
- [ ] A US tem persona, ação e objetivo definidos
- [ ] Não há ambiguidade na descrição ("rápido", "adequado", "quando necessário" = reescrever)
- [ ] Regras de negócio referenciadas com normativo (quando aplicável)
### Critérios de Aceite
- [ ] Cenário feliz (happy path) descrito com Gherkin
- [ ] Cenário de saldo/valor insuficiente especificado
- [ ] Cenário de status inválido especificado
- [ ] Cenário de usuário sem permissão especificado
- [ ] Comportamento de estorno/cancelamento especificado (se operação é reversível)
- [ ] Mensagens de erro com texto exato definido
### Impacto Técnico
- [ ] Tabelas e campos afetados identificados
- [ ] Necessidade de transação declarada
- [ ] Necessidade de lock declarada (para operações financeiras)
- [ ] Requisito de auditoria especificado
### Dependências e DoD
- [ ] Dependências de outras US declaradas
- [ ] Definition of Done com checklist de auditoria
---
 
## Matriz de Rastreabilidade — Exemplo
 
Rastrear requisitos do sistema até normativos legais:
 
| ID     | Funcionalidade                     | Normativo                  | EP      | Status     |
|--------|-------------------------------------|------------------------------|---------|------------|
| US-001 | Criar empenho ordinário            | Art. 58–60, Lei 4.320/64   | EP-001  | Em dev     |
| US-002 | Criar empenho global/estimativo    | Art. 60, Lei 4.320/64      | EP-001  | Backlog    |
| US-005 | Registrar liquidação               | Art. 63, Lei 4.320/64      | EP-001  | Backlog    |
| US-007 | Registrar pagamento                | Art. 64, Lei 4.320/64      | EP-001  | Backlog    |
| US-042 | Remanejamento de rubrica           | Decreto 3.100/99, Art. 7º  | EP-005  | Backlog    |
| US-050 | Relatório de execução financeira   | Art. 72, Lei 4.320/64      | EP-003  | Backlog    |
 
---
 
## Decomposição de Épico em Stories (padrão)
 
Ao receber um épico, decompor em stories seguindo esta ordem:
 
1. **Cadastro base** — entidades mestras que outras dependem
2. **Criação** — a operação principal
3. **Consulta / listagem** — ler os dados criados
4. **Edição** — modificar registros (quando permitido por regra)
5. **Cancelamento / estorno** — desfazer (com validação de estado)
6. **Relatório / exportação** — visibilidade dos dados
7. **Integração** — enviar/receber de sistemas externos
Para o domínio financeiro, a ordem 2 → 5 é crítica: nunca entregar "criação" sem
"cancelamento" — a ausência do estorno é risco financeiro e de auditoria.
 
---
 
## Padrão de Numeração
 
| Prefixo | Tipo                       | Exemplo     |
|---------|------------------------------|-------------|
| EP-NNN  | Épico                      | EP-001      |
| US-NNN  | História de usuário        | US-001      |
| RN-XXX-NNN | Regra de negócio       | RN-EMP-001  |
| RF-NNN  | Requisito funcional        | RF-001      |
| RNF-NNN | Requisito não-funcional   | RNF-001     |
| INT-NNN | Requisito de integração    | INT-001     |
 
Prefixos de domínio para RN:
- `RN-DOT` — Dotações
- `RN-EMP` — Empenhos
- `RN-LIQ` — Liquidações
- `RN-PAG` — Pagamentos
- `RN-OSCIP` — OSCIP / Termo de Parceria
- `RN-AUD` — Auditoria
---
 
## Requisitos Não-Funcionais Transversais do SGO 2.0
 
| ID      | Requisito                                                              | Categoria     |
|---------|--------------------------------------------------------------------------|---------------|
| RNF-001 | Operações financeiras (empenho, liquidação, pagamento) devem completar em ≤ 3s (p95) | Performance |
| RNF-002 | Toda operação financeira deve ser atomicamente consistente (transação com rollback) | Confiabilidade |
| RNF-003 | Log de auditoria deve ser imutável — sem UPDATE ou DELETE em `log_auditoria` | Segurança |
| RNF-004 | Dados de um tenant não devem ser visíveis para outro tenant em nenhuma circunstância | Segurança |
| RNF-005 | Relatórios com até 10.000 registros devem gerar em ≤ 10s | Performance |
| RNF-006 | Exportações de PDF/CSV devem executar em background para volumes > 1.000 registros | UX |
| RNF-007 | Sistema deve suportar execução simultânea de até 50 empenhos em dotações distintas sem inconsistência | Concorrência |
