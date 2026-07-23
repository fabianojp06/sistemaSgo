# Feature Playbook — SGO 2.0
 
Referência para o **Feature Mode**: implementação ponta a ponta.
 
## Estrutura de Pastas da Feature
 
```
src/
├── app/
│   └── (dashboard)/
│       └── [orgSlug]/
│           └── empenhos/                  # rota do módulo
│               ├── page.tsx               # Server Component — lista
│               ├── loading.tsx            # Skeleton automático
│               ├── error.tsx              # Boundary de erro
│               └── novo/
│                   └── page.tsx           # Server Component — formulário
│
├── features/
│   └── empenhos/                          # feature slice
│       ├── actions/
│       │   └── criar-empenho.ts           # Server Action
│       ├── components/
│       │   ├── EmpenhoForm.tsx            # Client Component
│       │   └── EmpenhoList.tsx            # Server ou Client
│       ├── schemas/
│       │   └── empenho.schema.ts          # Zod schemas
│       └── types/
│           └── empenho.types.ts           # tipos derivados do Zod e Prisma
│
└── lib/
    └── db/
        └── empenho.queries.ts             # queries Prisma reutilizáveis
```
 
---
 
## Sequência de Implementação
 
### Passo 1 — Schema Prisma
 
```prisma
// prisma/schema.prisma
 
model Empenho {
  id            String         @id @default(cuid())
  orgId         String         // tenant — nunca nulo
  numero        String
  descricao     String
  valor         Decimal        @db.Decimal(15, 2)
  status        StatusEmpenho  @default(PENDENTE)
  dotacaoId     String
  dotacao       Dotacao        @relation(fields: [dotacaoId], references: [id])
  criadoPor     String         // Clerk userId
  atualizadoPor String?
  criadoEm     DateTime       @default(now())
  atualizadoEm DateTime       @updatedAt
 
  @@index([orgId])
  @@index([orgId, status])
  @@index([orgId, dotacaoId])
  @@unique([orgId, numero])
}
 
enum StatusEmpenho {
  PENDENTE
  APROVADO
  LIQUIDADO
  CANCELADO
}
```
 
```bash
npx prisma migrate dev --name add_empenho
```
 
### Passo 2 — Zod Schema
 
```typescript
// features/empenhos/schemas/empenho.schema.ts
import { z } from 'zod'
 
export const CriarEmpenhoSchema = z.object({
  dotacaoId: z.string().cuid('ID de dotação inválido'),
  descricao: z.string().min(3, 'Mínimo 3 caracteres').max(255),
  valor: z
    .number({ invalid_type_error: 'Valor deve ser um número' })
    .positive('Valor deve ser positivo')
    .multipleOf(0.01, 'Máximo 2 casas decimais'),
})
 
export type CriarEmpenhoInput = z.infer<typeof CriarEmpenhoSchema>
 
// Tipo de retorno padrão de actions
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
```
 
### Passo 3 — Server Action
 
Ver `references/action-patterns.md` para o template completo.
 
### Passo 4 — Page (Server Component)
 
```typescript
// app/(dashboard)/[orgSlug]/empenhos/page.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { EmpenhoList } from '@/features/empenhos/components/EmpenhoList'
 
export default async function EmpenhosPage() {
  const { orgId } = await auth()
  if (!orgId) redirect('/selecionar-organizacao')
 
  const empenhos = await prisma.empenho.findMany({
    where: { orgId },
    orderBy: { criadoEm: 'desc' },
    take: 50,
  })
 
  return (
    <main className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Empenhos</h1>
      <EmpenhoList empenhos={empenhos} />
    </main>
  )
}
```
 
### Passo 5 — Form Component (Client)
 
Ver `references/ui-patterns.md` para o template de formulário.
 
---
 
## Checklist de Integração
 
Antes de considerar a feature pronta:
 
- [ ] Schema Prisma com índices em `orgId` e colunas de filtro frequente
- [ ] Migration aplicada e testada localmente
- [ ] Zod schema cobre todos os campos obrigatórios e opcionais
- [ ] Server Action valida com Zod antes de abrir transação
- [ ] Server Action verifica `orgId` do Clerk antes de qualquer DB call
- [ ] Operações financeiras usam `prisma.$transaction()` (ver Tx Mode)
- [ ] Auditoria (`criadoPor`, `atualizadoPor`) registrada
- [ ] `revalidatePath()` chamado após mutação
- [ ] `loading.tsx` implementado para a rota
- [ ] `error.tsx` implementado para a rota
- [ ] Estados de loading/error/empty no componente React
- [ ] Sem `console.log` de dados sensíveis
- [ ] Sem stack trace exposto para o cliente