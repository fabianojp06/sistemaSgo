# Template de Plano de Testes

Consulte este arquivo no **Plan Mode** — ao criar um plano de testes para uma feature ou módulo.

---

## Template completo

```markdown
# Plano de Testes — [Nome da Feature / Módulo]

**Versão**: 1.0
**Data**: [data]
**Responsável QA**: [nome]
**Módulo SGO**: [Dotações / Empenhos / Liquidações / Aprovações / Relatórios]
**Sprint / Release**: [referência]
**Referência de requisitos**: [US-NNN / RF-NNN da ba-po-architect]

---

## 1. Objetivo

[O que este plano cobre. O que está fora do escopo.]

**Em escopo:**
- [feature 1]
- [feature 2]

**Fora de escopo:**
- [o que não será testado e por quê]

---

## 2. Critérios de entrada

Antes de iniciar os testes, verificar:
- [ ] Feature implementada e deployada em ambiente de homologação
- [ ] Banco de dados de teste populado com dados de fixture adequados
- [ ] Critérios de aceite (BDD) disponíveis e revisados
- [ ] Acesso aos ambientes configurado (usuários de teste, tenants de teste)
- [ ] Build de CI passando (testes unitários e de integração sem falha)

---

## 3. Critérios de saída (Definition of Done para QA)

O módulo está aprovado para release quando:
- [ ] 100% dos casos P0 executados e aprovados
- [ ] 100% dos casos P1 executados e aprovados
- [ ] ≥ 80% dos casos P2 executados (os reprovados com plano de correção documentado)
- [ ] Nenhum bug P0 ou P1 aberto sem data de correção definida
- [ ] Teste de isolamento de tenant executado e aprovado
- [ ] Teste de regressão dos módulos impactados executado

---

## 4. Ambiente de testes

| Item              | Valor                                              |
|-------------------|----------------------------------------------------|
| URL               | [URL do ambiente de homologação]                   |
| Banco             | PostgreSQL — instância de teste isolada            |
| Tenant de teste A | [orgId do Tenant A — dados do módulo testado]      |
| Tenant de teste B | [orgId do Tenant B — para validar isolamento]      |
| Usuários de teste | Admin: [email] / Operador: [email] / Auditor: [email] |

---

## 5. Abordagem por nível de teste

### 5.1 Testes unitários (responsabilidade: Dev)
- Regras de negócio isoladas (cálculos, validações Zod)
- Meta de cobertura: ≥ 80% das linhas de lógica de negócio
- Ferramenta: Vitest

### 5.2 Testes de integração (responsabilidade compartilhada Dev + QA)
- Server Actions com banco de dados real
- Foco em: integridade transacional, rollback, efeitos colaterais no banco
- Ferramenta: Vitest + banco PostgreSQL de teste

### 5.3 Testes E2E (responsabilidade: QA)
- Fluxos críticos de ponta a ponta via browser
- Foco em: jornada completa do usuário, validações de UI, feedback de erro
- Ferramenta: Playwright

### 5.4 Testes exploratórios (responsabilidade: QA)
- Sessões de 60-90 min sem script fixo
- Foco em: comportamentos inesperados, combinações de dados, edge cases não documentados
- Registrar achados em tempo real

---

## 6. Riscos e mitigações

| Risco                                         | Probabilidade | Impacto | Mitigação                                  |
|-----------------------------------------------|---------------|---------|--------------------------------------------|
| Dados de fixture insuficientes para edge cases| Média         | Alto    | Criar script de seed específico para o módulo |
| Dependência de serviço externo indisponível   | Baixa         | Alto    | Usar mocks para o serviço externo          |
| Race condition em operação concorrente        | Média         | P0      | Teste de concorrência com N threads simultâneas |

---

## 7. Índice de casos de teste

| ID      | Descrição resumida                        | Tipo        | Prioridade | Status     |
|---------|-------------------------------------------|-------------|------------|------------|
| CT-001  | [descrição]                               | Funcional   | P0         | Pendente   |
| CT-002  | [descrição]                               | Segurança   | P0         | Pendente   |
| ...     | ...                                       | ...         | ...        | ...        |
```

---

## Guia de priorização

| Prioridade | Critério                                                                 | Exemplos no SGO 2.0                              |
|------------|--------------------------------------------------------------------------|--------------------------------------------------|
| **P0**     | Falha causa perda de dados, corrupção financeira ou vazamento de tenant  | Empenho duplicado, saldo negativo, cross-tenant  |
| **P1**     | Falha impede fluxo principal ou exige workaround significativo           | Não consegue criar empenho, aprovação travada    |
| **P2**     | Falha afeta experiência mas tem workaround simples                       | Mensagem de erro vaga, ordenação incorreta       |
| **P3**     | Polimento visual, texto, preferência de UX                               | Alinhamento de coluna, texto de tooltip          |

**Regra SGO 2.0**: qualquer falha que afete integridade financeira ou isolamento de tenant
é automaticamente P0, independente da frequência esperada.
