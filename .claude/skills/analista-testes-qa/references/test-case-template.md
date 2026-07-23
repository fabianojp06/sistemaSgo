# Template de Casos de Teste

Consulte este arquivo no **Case Mode** — ao detalhar casos de teste funcionais.

---

## Estrutura de um conjunto de casos de teste

Para cada feature, organize os casos em quatro grupos obrigatórios:

```
Feature: [Nome da Feature]
  ├── Grupo 1: Caminho feliz (o que deve funcionar)
  ├── Grupo 2: Cenários negativos (o que deve ser rejeitado)
  ├── Grupo 3: Casos de borda (limites, extremos, simultaneidade)
  └── Grupo 4: Segurança e isolamento (tenant, auth, injeção)
```

---

## Template de caso individual

```markdown
### CT-[NNN] — [Resumo: verbo + objeto + condição]

| Campo            | Valor                                                              |
|------------------|--------------------------------------------------------------------|
| **Módulo**       | [Dotações / Empenhos / Liquidações / Aprovações / Relatórios]     |
| **Grupo**        | Caminho feliz / Negativo / Borda / Segurança                      |
| **Prioridade**   | P0 / P1 / P2 / P3                                                 |
| **Tipo**         | Funcional / Regressão / Segurança / Performance / Exploratório    |
| **Pré-condição** | [estado exato do sistema e do banco antes de iniciar]             |
| **Perfil**       | Admin / Operador / Auditor / Não autenticado                      |
| **Tenant**       | Tenant A (e Tenant B para testes de isolamento)                   |
| **Automatizado** | Sim (Vitest integração) / Sim (Playwright E2E) / Não              |

**Passos de execução:**
1. [ação específica — "Acessar /dotacoes/[id]/empenhos/novo"]
2. [ação — "Preencher campo 'Valor' com '3000,00'"]
3. [ação — "Clicar em 'Confirmar empenho'"]

**Resultado esperado:**
- [ ] [asserção 1 — o que deve aparecer na UI]
- [ ] [asserção 2 — o que deve estar no banco: "campo valorEmpenhado = 3000.00"]
- [ ] [asserção 3 — o que deve ter sido registrado: "auditoria criada"]

**Resultado obtido:** _(preencher na execução)_
**Evidências:** _(screenshot / log / payload)_
**Executado por / Data:** _____
**Status:** Passou / Falhou / Bloqueado / Não executado
```

---

## Exemplo completo: Módulo de Empenho

### CT-001 — Empenhar dotação com saldo suficiente (operador)

| Campo            | Valor                                                    |
|------------------|----------------------------------------------------------|
| **Módulo**       | Empenhos                                                 |
| **Grupo**        | Caminho feliz                                            |
| **Prioridade**   | P0                                                       |
| **Tipo**         | Funcional                                                |
| **Pré-condição** | Dotação ativa, saldo = R$ 10.000,00, sem empenhos prévios|
| **Perfil**       | Operador autenticado no Tenant A                         |
| **Tenant**       | Tenant A                                                 |
| **Automatizado** | Sim (Vitest integração + Playwright E2E)                 |

**Passos:**
1. Acessar `/dotacoes/{id}/empenhos/novo`
2. Preencher "Valor" com `3000,00`
3. Preencher "Descrição" com `Material de escritório`
4. Clicar em "Confirmar empenho"

**Resultado esperado:**
- [ ] Mensagem de sucesso: "Empenho registrado com sucesso"
- [ ] Saldo exibido atualizado para R$ 7.000,00
- [ ] Banco: `empenho.valor = 3000.00`, `empenho.status = 'ATIVO'`
- [ ] Banco: `dotacao.valorEmpenhado = 3000.00`
- [ ] Banco: registro de auditoria criado com `userId`, `orgId`, `operacao = 'CRIAR_EMPENHO'`

---

### CT-002 — Rejeitar empenho quando saldo é insuficiente

| Campo            | Valor                                                    |
|------------------|----------------------------------------------------------|
| **Módulo**       | Empenhos                                                 |
| **Grupo**        | Negativo                                                 |
| **Prioridade**   | P0                                                       |
| **Pré-condição** | Dotação ativa, saldo = R$ 1.000,00                       |
| **Perfil**       | Operador autenticado no Tenant A                         |

**Passos:**
1. Acessar `/dotacoes/{id}/empenhos/novo`
2. Preencher "Valor" com `5000,00`
3. Clicar em "Confirmar empenho"

**Resultado esperado:**
- [ ] Mensagem de erro: "Saldo insuficiente para este empenho"
- [ ] Banco: nenhum empenho criado
- [ ] Banco: `dotacao.valorEmpenhado` permanece inalterado (R$ 0,00)

---

### CT-003 — Empenhar exatamente o saldo disponível (borda)

| Campo            | Valor                                                    |
|------------------|----------------------------------------------------------|
| **Módulo**       | Empenhos                                                 |
| **Grupo**        | Borda                                                    |
| **Prioridade**   | P0                                                       |
| **Pré-condição** | Dotação ativa, saldo = R$ 5.000,00                       |

**Passos:**
1. Preencher "Valor" com `5000,00` (exatamente o saldo)
2. Confirmar

**Resultado esperado:**
- [ ] Empenho criado com sucesso
- [ ] Banco: `dotacao.valorEmpenhado = 5000.00`
- [ ] Banco: `dotacao` com saldo disponível = R$ 0,00

---

### CT-004 — Operador do Tenant B não acessa dotação do Tenant A (isolamento)

| Campo            | Valor                                                    |
|------------------|----------------------------------------------------------|
| **Módulo**       | Empenhos                                                 |
| **Grupo**        | Segurança                                                |
| **Prioridade**   | P0                                                       |
| **Pré-condição** | Dotação do Tenant A existe com ID conhecido              |
| **Perfil**       | Operador autenticado no **Tenant B**                     |

**Passos:**
1. Autenticar como Tenant B
2. Tentar acessar `/dotacoes/{id-do-tenant-A}/empenhos/novo`

**Resultado esperado:**
- [ ] Resposta HTTP 403 ou redirecionamento para 404
- [ ] Dados do Tenant A não são exibidos
- [ ] Banco: nenhuma operação realizada sobre dados do Tenant A

---

### CT-005 — Dois empenhos simultâneos não ultrapassam o saldo (concorrência)

| Campo            | Valor                                                              |
|------------------|--------------------------------------------------------------------|
| **Módulo**       | Empenhos                                                           |
| **Grupo**        | Borda                                                              |
| **Prioridade**   | P0                                                                 |
| **Pré-condição** | Dotação ativa, saldo = R$ 5.000,00                                 |
| **Automatizado** | Sim (Vitest integração com Promise.all)                            |

**Passos:**
1. Disparar simultaneamente dois empenhos de R$ 4.000,00 via `Promise.all`

**Resultado esperado:**
- [ ] Exatamente um empenho é aprovado (R$ 4.000,00)
- [ ] O segundo retorna erro de saldo insuficiente
- [ ] Banco: `dotacao.valorEmpenhado` = R$ 4.000,00 (nunca R$ 8.000,00)
- [ ] Nenhum deadlock ou erro 500

---

## Guia de nomenclatura de casos

Padrão: `CT-[NNN] — [Verbo] [objeto] [condição]`

Bons exemplos:
- `CT-012 — Rejeitar liquidação quando empenho está cancelado`
- `CT-013 — Exibir histórico de alterações em ordem cronológica decrescente`
- `CT-014 — Bloquear acesso de usuário sem perfil de aprovador`

Ruins:
- `CT-012 — Testar empenho` (muito genérico)
- `CT-013 — Liquidação funciona` (não descreve a condição)
