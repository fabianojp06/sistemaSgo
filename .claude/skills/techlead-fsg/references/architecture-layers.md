# Architecture Layers — SGO 2.0

Referência para o **Design Mode** do Tech Lead FSG.

## Estrutura de Pastas Alvo

```
src/
├── app/                          # Next.js App Router (apresentação)
│   ├── (public)/                 # rotas públicas
│   ├── (tenant)/                 # rotas protegidas por tenant
│   │   ├── [tenant]/
│   │   │   ├── orcamento/
│   │   │   ├── aprovacoes/
│   │   │   └── relatorios/
│   └── api/                      # Route Handlers (BFF)
│       └── v1/
│
├── modules/                      # Módulos de domínio (DDD Bounded Contexts)
│   ├── orcamento/
│   │   ├── domain/
│   │   │   ├── entities/         # Entidades e Value Objects
│   │   │   ├── repositories/     # Interfaces (contratos)
│   │   │   └── events/           # Domain Events
│   │   ├── application/
│   │   │   ├── use-cases/        # Um arquivo por caso de uso
│   │   │   └── dtos/             # Input/Output types
│   │   └── infrastructure/
│   │       ├── repositories/     # Implementações Postgres
│   │       └── mappers/          # Entity ↔ DB row
│   │
│   ├── aprovacoes/               # Mesmo padrão
│   ├── tenant/                   # Multi-tenant core
│   └── shared/                   # Kernel compartilhado
│       ├── domain/               # Base classes, Value Objects comuns
│       ├── errors/               # Erros de domínio tipados
│       └── types/                # Tipos utilitários globais
│
├── lib/                          # Infraestrutura técnica (sem lógica de negócio)
│   ├── db/                       # Cliente Postgres, migrations
│   ├── auth/                     # Auth adapter
│   └── http/                     # Fetch wrappers, interceptors
│
└── components/                   # Componentes React compartilhados
    ├── ui/                       # Primitivos (shadcn/ui ou custom)
    └── domain/                   # Componentes com lógica de negócio
```

---

## Regras de Dependência (Clean Architecture)

```
Presentation (app/) 
    → Application (use-cases/)
        → Domain (entities/, repositories interfaces)
            ← Infrastructure (implementações)
```

**Regra de ouro:** as setas apontam para dentro. `domain/` não importa nada de `infrastructure/`
ou `app/`. Violations desta regra são P1 no code review.

---

## Módulos do SGO 2.0

| Módulo          | Bounded Context                              | Entidades Principais                    |
|-----------------|----------------------------------------------|-----------------------------------------|
| `orcamento`     | Gestão de dotações e saldos                  | Dotação, Rubrica, LançamentoOrçamentário|
| `aprovacoes`    | Workflow de aprovação (WA_01 a WA_06)        | SolicitacaoAprovacao, EtapaWorkflow     |
| `tenant`        | Multi-tenancy core                           | Tenant, TenantConfig, TenantUser        |
| `relatorios`    | Consultas e exportações                      | (read-only, sem entidades de escrita)   |
| `shared`        | Kernel compartilhado                         | Money, DateRange, AuditFields           |

---

## Padrão de Caso de Uso

```typescript
// modules/orcamento/application/use-cases/EmpenharDotacaoUseCase.ts

import type { DotacaoRepository } from '../domain/repositories/DotacaoRepository'
import type { EmpenharDotacaoInput, EmpenharDotacaoOutput } from '../dtos/EmpenharDotacaoDto'
import { DotacaoInsuficienteError } from '../../shared/errors/DomainErrors'

export class EmpenharDotacaoUseCase {
  constructor(
    private readonly dotacaoRepo: DotacaoRepository,
    // injetar outros repos/services aqui
  ) {}

  async execute(
    input: EmpenharDotacaoInput,
    tenantId: string,
  ): Promise<EmpenharDotacaoOutput> {
    // 1. buscar agregado
    const dotacao = await this.dotacaoRepo.findById(input.dotacaoId, tenantId)
    if (!dotacao) throw new NotFoundError('Dotação', input.dotacaoId)

    // 2. executar lógica de domínio na entidade
    dotacao.empenhar(input.valor)  // lança DotacaoInsuficienteError se necessário

    // 3. persistir
    await this.dotacaoRepo.save(dotacao, tenantId)

    // 4. retornar DTO de saída
    return { dotacaoId: dotacao.id, saldoAtual: dotacao.saldoDisponivel }
  }
}
```

---

## React Server Components vs Client Components

| Caso de uso                                    | Tipo              |
|------------------------------------------------|-------------------|
| Busca de dados, leitura de DB                  | Server Component  |
| Interatividade, estado local, eventos UI       | Client Component  |
| Formulários com validação inline               | Client Component  |
| Layouts, páginas de leitura                    | Server Component  |
| Contexto de tenant (leitura)                   | Server Component  |

**Regra:** só adicionar `'use client'` quando houver um motivo explícito. Default é Server.

---

## BFF Pattern (Route Handlers como Backend for Frontend)

Para operações de escrita, os Route Handlers do Next.js atuam como BFF:

```
Client Component → POST /api/v1/orcamento/empenhar
                        ↓
                   Route Handler (validação HTTP, auth, tenant ctx)
                        ↓
                   EmpenharDotacaoUseCase.execute()
                        ↓
                   DotacaoRepository (Postgres)
```

Nunca chamar o banco diretamente de um Server Component de escrita — passar sempre pelo use-case.