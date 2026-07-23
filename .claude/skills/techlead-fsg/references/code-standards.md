# Code Standards — SGO 2.0

Referência para o **Code Mode** do Tech Lead FSG.

## TypeScript: Padrões Obrigatórios

### Tipos Financeiros

```typescript
// Value Object: Money (nunca usar number puro para dinheiro)
export class Money {
  private constructor(private readonly centavos: bigint) {}

  static fromReais(value: number): Money {
    if (!Number.isFinite(value) || value < 0) {
      throw new InvalidMoneyError(value)
    }
    return new Money(BigInt(Math.round(value * 100)))
  }

  static fromCentavos(centavos: bigint): Money {
    return new Money(centavos)
  }

  add(other: Money): Money {
    return new Money(this.centavos + other.centavos)
  }

  subtract(other: Money): Money {
    if (other.centavos > this.centavos) throw new SaldoInsuficienteError()
    return new Money(this.centavos - other.centavos)
  }

  toReais(): number {
    return Number(this.centavos) / 100
  }

  isGreaterThan(other: Money): boolean {
    return this.centavos > other.centavos
  }
}
```

### Erros de Domínio Tipados

```typescript
// modules/shared/errors/DomainErrors.ts

export abstract class DomainError extends Error {
  abstract readonly code: string
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class SaldoInsuficienteError extends DomainError {
  readonly code = 'SALDO_INSUFICIENTE'
  constructor(disponivel?: Money, solicitado?: Money) {
    super(
      disponivel && solicitado
        ? `Saldo insuficiente: disponível R$${disponivel.toReais()}, solicitado R$${solicitado.toReais()}`
        : 'Saldo insuficiente para a operação'
    )
  }
}

export class TenantNotFoundError extends DomainError {
  readonly code = 'TENANT_NOT_FOUND'
  constructor(tenantId: string) {
    super(`Tenant não encontrado: ${tenantId}`)
  }
}

export class ConflictVersionError extends DomainError {
  readonly code = 'CONFLICT_VERSION'
  constructor() {
    super('Conflito de versão: o registro foi modificado por outro processo')
  }
}
```

### DTOs com Zod (validação de entrada)

```typescript
// modules/orcamento/application/dtos/EmpenharDotacaoDto.ts
import { z } from 'zod'

export const EmpenharDotacaoInputSchema = z.object({
  dotacaoId: z.string().uuid('ID de dotação inválido'),
  valor: z.number()
    .positive('Valor deve ser positivo')
    .multipleOf(0.01, 'Valor deve ter no máximo 2 casas decimais'),
  descricao: z.string().min(3).max(255),
  idempotencyKey: z.string().uuid().optional(),
})

export type EmpenharDotacaoInput = z.infer<typeof EmpenharDotacaoInputSchema>

export type EmpenharDotacaoOutput = {
  lancamentoId: string
  dotacaoId: string
  saldoAnterior: number
  saldoAtual: number
  processadoEm: string  // ISO 8601
}
```

---

## Next.js: Padrões de Route Handler

```typescript
// app/api/v1/orcamento/[dotacaoId]/empenhar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { EmpenharDotacaoInputSchema } from '@/modules/orcamento/application/dtos/EmpenharDotacaoDto'
import { getEmpenharDotacaoUseCase } from '@/lib/container'
import { getTenantFromRequest } from '@/lib/auth/tenant'
import { DomainError } from '@/modules/shared/errors/DomainErrors'

export async function POST(
  request: NextRequest,
  { params }: { params: { dotacaoId: string } }
) {
  try {
    // 1. Extrair e validar tenant
    const tenantId = await getTenantFromRequest(request)

    // 2. Parsear e validar body
    const body = await request.json()
    const input = EmpenharDotacaoInputSchema.parse({
      ...body,
      dotacaoId: params.dotacaoId,
    })

    // 3. Executar caso de uso
    const useCase = getEmpenharDotacaoUseCase()
    const result = await useCase.execute(input, tenantId)

    return NextResponse.json(result, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.flatten() },
        { status: 422 }
      )
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 422 }
      )
    }
    // Log do erro (não expor detalhes internos)
    console.error('[empenhar] erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
```

---

## React Server Components: Padrão de Fetch

```typescript
// app/(tenant)/[tenant]/orcamento/dotacoes/page.tsx

import { getDotacoesUseCase } from '@/lib/container'
import { getTenantFromSession } from '@/lib/auth/server'
import { DotacoesList } from '@/components/domain/orcamento/DotacoesList'

// Server Component — sem 'use client'
export default async function DotacoesPage() {
  const tenantId = await getTenantFromSession()
  const useCase = getDotacoesUseCase()

  // Busca direta no use-case, sem fetch HTTP
  const dotacoes = await useCase.listar({ tenantId, status: 'ativa' })

  return (
    <main>
      <h1>Dotações Orçamentárias</h1>
      <DotacoesList dotacoes={dotacoes} />
    </main>
  )
}
```

---

## Tenant Context: Propagação via Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyTenantToken } from '@/lib/auth/tenant'

export async function middleware(request: NextRequest) {
  const tenant = await verifyTenantToken(request)

  if (!tenant) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Propagar tenant via header interno (não exposto ao cliente)
  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenant.id)
  return response
}

export const config = {
  matcher: ['/(tenant)/:path*', '/api/v1/:path*'],
}
```

---

## Nomenclatura

| Contexto         | Convenção                      | Exemplo                        |
|------------------|--------------------------------|--------------------------------|
| Arquivos         | kebab-case                     | `empenhar-dotacao.use-case.ts` |
| Classes          | PascalCase                     | `EmpenharDotacaoUseCase`       |
| Funções/métodos  | camelCase                      | `empenharDotacao()`            |
| Variáveis        | camelCase                      | `saldoDisponivel`              |
| Constantes       | UPPER_SNAKE_CASE               | `MAX_RETRIES`                  |
| Componentes React| PascalCase                     | `DotacoesList`                 |
| Tabelas Postgres | snake_case, plural             | `dotacoes`, `lancamentos`      |
| Colunas Postgres | snake_case                     | `saldo_disponivel`             |
| Enums Postgres   | snake_case                     | `status_dotacao`               |
| Termos de domínio| Português (domínio do negócio) | `dotacao`, `empenho`, `rubrica`|
| Termos técnicos  | Inglês                         | `repository`, `use-case`       |