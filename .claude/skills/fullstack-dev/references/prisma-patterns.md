# Prisma Patterns — SGO 2.0
 
Referência para o **Schema Mode**: Prisma schema, tipos e migrations.
 
## Tipos de Campo: Regras Inegociáveis
 
| Dado                  | Tipo Prisma          | Anotação DB            | Nunca usar       |
|-----------------------|----------------------|------------------------|------------------|
| Valores monetários    | `Decimal`            | `@db.Decimal(15, 2)`   | `Float`          |
| IDs internos          | `String @id @default(cuid())` | —             | `Int @autoincrement` |
| Timestamps            | `DateTime`           | `@default(now())`      | `String`         |
| Tenant identifier     | `String` (Clerk orgId) | `// obrigatório`     | ausente          |
| Enums de status       | `enum` Prisma        | —                      | `String` livre   |
| JSON flexível         | `Json`               | —                      | `String` serializado |
 
---
 
## Template de Model com Multi-Tenant e Auditoria
 
```prisma
model NomeEntidade {
  // — Identificação —
  id            String          @id @default(cuid())
  orgId         String          // Clerk orgId — tenant obrigatório
 
  // — Dados do domínio —
  // ... campos específicos ...
 
  // — Controle de versão (optimistic lock quando necessário) —
  // version    Int             @default(0)
 
  // — Auditoria (obrigatório em entidades financeiras) —
  criadoEm      DateTime        @default(now())
  atualizadoEm  DateTime        @updatedAt
  criadoPor     String          // Clerk userId
  atualizadoPor String?         // Clerk userId
 
  // — Índices (obrigatório) —
  @@index([orgId])
}
```
 
---
 
## Schema Completo: Módulo Orçamentário
 
```prisma
// prisma/schema.prisma
 
generator client {
  provider = "prisma-client-js"
}
 
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
 
// ─── Enums ────────────────────────────────────────────────
 
enum StatusDotacao {
  ATIVA
  BLOQUEADA
  ENCERRADA
}
 
enum StatusEmpenho {
  PENDENTE
  APROVADO
  LIQUIDADO
  CANCELADO
}
 
enum StatusLiquidacao {
  PENDENTE
  CONFIRMADA
  ESTORNADA
}
 
// ─── Models ───────────────────────────────────────────────
 
model Dotacao {
  id                String        @id @default(cuid())
  orgId             String
  codigo            String
  descricao         String
  valorTotal        Decimal       @db.Decimal(15, 2)
  saldoDisponivel   Decimal       @db.Decimal(15, 2)
  status            StatusDotacao @default(ATIVA)
  empenhos          Empenho[]
  criadoEm          DateTime      @default(now())
  atualizadoEm      DateTime      @updatedAt
  criadoPor         String
  atualizadoPor     String?
 
  @@index([orgId])
  @@index([orgId, status])
  @@unique([orgId, codigo])
}
 
model Empenho {
  id            String        @id @default(cuid())
  orgId         String
  numero        String
  descricao     String
  valor         Decimal       @db.Decimal(15, 2)
  status        StatusEmpenho @default(PENDENTE)
  dotacaoId     String
  dotacao       Dotacao       @relation(fields: [dotacaoId], references: [id])
  liquidacoes   Liquidacao[]
  criadoEm      DateTime      @default(now())
  atualizadoEm  DateTime      @updatedAt
  criadoPor     String
  atualizadoPor String?
 
  @@index([orgId])
  @@index([orgId, status])
  @@index([orgId, dotacaoId])
  @@unique([orgId, numero])
}
 
model Liquidacao {
  id            String           @id @default(cuid())
  orgId         String
  valor         Decimal          @db.Decimal(15, 2)
  status        StatusLiquidacao @default(PENDENTE)
  empenhoId     String
  empenho       Empenho          @relation(fields: [empenhoId], references: [id])
  criadoEm      DateTime         @default(now())
  atualizadoEm  DateTime         @updatedAt
  criadoPor     String
  atualizadoPor String?
 
  @@index([orgId])
  @@index([orgId, empenhoId])
}
```
 
---
 
## Migrations: Boas Práticas
 
```bash
# Criar migration com nome descritivo
npx prisma migrate dev --name add_empenho_status_aprovado
 
# Aplicar em produção (sem prompt)
npx prisma migrate deploy
 
# Inspecionar estado
npx prisma migrate status
 
# Resetar dev (NUNCA em produção)
npx prisma migrate reset
```
 
**Regras:**
- Nunca editar arquivo de migration já aplicado — criar nova migration
- Sempre revisar o SQL gerado antes de aplicar em staging/produção
- Migrations que removem colunas: fazer em 3 passos (deploy sem a coluna no código → migration remove → deploy limpo)
- Adicionar índice em tabela grande em produção: fazer via migration com `CREATE INDEX CONCURRENTLY`
```prisma
// migration manual para índice concorrente
-- CreateIndex CONCURRENTLY
CREATE INDEX CONCURRENTLY "Empenho_orgId_status_idx" ON "Empenho"("orgId", "status");
```
 
---
 
## Prisma Client: Padrões de Query
 
### Busca com tenant obrigatório
 
```typescript
// ✅ Sempre filtrar por orgId
const empenhos = await prisma.empenho.findMany({
  where: { orgId, status: 'PENDENTE' },
  include: { dotacao: { select: { codigo: true, descricao: true } } },
  orderBy: { criadoEm: 'desc' },
})
 
// ❌ Nunca buscar sem tenant
const empenho = await prisma.empenho.findUnique({ where: { id } })
```
 
### Valores Decimal no código
 
```typescript
import { Prisma } from '@prisma/client'
 
// Comparações
where: { saldoDisponivel: { gte: new Prisma.Decimal(valor) } }
 
// Operações aritméticas
data: { saldoDisponivel: { decrement: new Prisma.Decimal(valor) } }
 
// Serialização para JSON (Decimal não é nativo)
const result = empenho.valor.toNumber() // para retornar ao cliente
```
 
### Select para evitar over-fetching
 
```typescript
// Para listagens, selecionar só o necessário
const lista = await prisma.empenho.findMany({
  where: { orgId },
  select: {
    id: true,
    numero: true,
    descricao: true,
    valor: true,
    status: true,
    criadoEm: true,
    dotacao: { select: { codigo: true } },
  },
})
```
 
---
 
## Instância Prisma (singleton)
 
```typescript
// lib/db.ts
import { PrismaClient } from '@prisma/client'
 
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
 
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  })
 
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```