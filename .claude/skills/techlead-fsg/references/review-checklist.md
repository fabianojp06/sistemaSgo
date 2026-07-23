# Review Checklist — SGO 2.0

Referência para o **Review Mode** do Tech Lead FSG.

## Severidade

- 🔴 **P1 — Bloqueador:** merge bloqueado até corrigir (risco de integridade, segurança, perda de dados)
- 🟡 **P2 — Importante:** corrigir nesta PR ou abrir issue rastreada antes de merge
- 🟢 **P3 — Sugestão:** melhoria desejável, pode ir em PR futura

---

## Checklist por Categoria

### 🔐 Multi-Tenant (P1 automático se falhar)

- [ ] Toda query tem `tenant_id` no `WHERE` ou está protegida por RLS ativo?
- [ ] Nenhuma query usa `SELECT *` sem filtro de tenant?
- [ ] Tenant context é propagado via middleware, não por parâmetro manual em cada função?
- [ ] Nova entidade foi avaliada: é global ou por tenant? Decisão documentada?
- [ ] Testes cobrem cenário de vazamento cross-tenant (tenant A não vê dados do tenant B)?

### 💰 Integridade Financeira (P1 automático se falhar)

- [ ] Nenhum `FLOAT` ou `DOUBLE` para valores monetários?
- [ ] Operações de débito/crédito estão dentro de transação explícita?
- [ ] Race conditions avaliadas? `SELECT FOR UPDATE` ou optimistic locking implementado?
- [ ] Campos de auditoria presentes: `created_at`, `updated_at`, `created_by`, `updated_by`?
- [ ] Estornos usam referência ao lançamento original (não DELETE)?
- [ ] Idempotency key em operações de escrita que podem ser retentadas?

### 🏗️ Arquitetura / Camadas (P1 se violar dependências)

- [ ] `domain/` não importa nada de `infrastructure/` ou `app/`?
- [ ] Lógica de negócio está no use-case ou na entidade, não no Route Handler ou Server Component?
- [ ] Novos módulos seguem a estrutura `domain/application/infrastructure`?
- [ ] Dependências externas injetadas via interface, não instanciadas dentro do use-case?

### 🔷 TypeScript (P2 se falhar)

- [ ] Nenhum `any` — tipos explícitos ou `unknown` com narrowing?
- [ ] DTOs de entrada/saída tipados separadamente das entidades de domínio?
- [ ] Enums de domínio usados em vez de strings literais soltas?
- [ ] Erros tipados (`DomainError` subclasses) em vez de `throw new Error('string')`?

### ⚛️ React / Next.js (P2 se falhar)

- [ ] `'use client'` só onde necessário? Server Component por padrão?
- [ ] Nenhuma chamada de banco direta em Server Component de escrita?
- [ ] `loading.tsx` e `error.tsx` presentes para rotas críticas?
- [ ] Formulários validados no servidor (não só no cliente)?
- [ ] Sem `useEffect` para busca de dados — usar Server Components ou SWR/React Query?

### 🐘 PostgreSQL (P2 se falhar)

- [ ] Índices adicionados para colunas usadas em `WHERE`, `JOIN`, `ORDER BY` frequentes?
- [ ] `tenant_id` incluído em índices compostos (índice parcial por tenant)?
- [ ] Migrations reversíveis? `rollback` documentado?
- [ ] `NOT NULL` para colunas obrigatórias? Defaults explícitos?
- [ ] Constraints de FK declaradas?

### 🧪 Testes (P2 se ausente em lógica crítica)

- [ ] Casos de uso cobertos por testes unitários (repositório mockado)?
- [ ] Cenários de erro (saldo insuficiente, tenant inválido) testados?
- [ ] Testes de integração para migrations e queries complexas?

### 📖 Legibilidade (P3)

- [ ] Nomes de variáveis e funções em português (domínio) ou inglês (técnico) consistentemente?
- [ ] Comentários de intenção onde a lógica não é óbvia?
- [ ] TODOs rastreáveis com issue/ticket?

---

## Formato de Saída do Review

```markdown
## Code Review — [nome do módulo / PR]

### 🔴 P1 — Bloqueadores
1. **[arquivo:linha]** — [problema] → [impacto no SGO] → [solução proposta]

### 🟡 P2 — Importantes
1. **[arquivo:linha]** — [problema] → [solução]

### 🟢 P3 — Sugestões
1. **[arquivo:linha]** — [sugestão]

### ✅ Pontos Positivos
- [o que está bem feito — sempre incluir ao menos um]

### Veredicto
[ ] Aprovado | [ ] Aprovado com P3s | [ ] Bloqueado (P1 ou P2 não resolvido)
```