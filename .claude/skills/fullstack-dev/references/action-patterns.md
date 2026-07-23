# Action Patterns — SGO 2.0
 
Referência para o **Action Mode**: Server Actions com Next.js 15+.
 
## Template Base de Server Action
 
```typescript
// features/empenhos/actions/criar-empenho.ts
'use server'
 
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { CriarEmpenhoSchema, type ActionResult } from '../schemas/empenho.schema'
import type { Empenho } from '@prisma/client'
 
export async function criarEmpenho(
  rawInput: unknown
): Promise<ActionResult<Empenho>> {
  // 1. Autenticação e tenant
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return { success: false, error: 'Não autorizado' }
  }
 
  // 2. Validação com Zod
  const parsed = CriarEmpenhoSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Dados inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }
  const input = parsed.data
 
  // 3. Lógica de negócio + persistência
  try {
    const empenho = await prisma.$transaction(async (tx) => {
      // verificar se dotação pertence ao org e tem saldo
      const dotacao = await tx.dotacao.findUnique({
        where: { id: input.dotacaoId, orgId },
      })
      if (!dotacao) throw new Error('Dotação não encontrada')
      if (dotacao.saldoDisponivel.lessThan(input.valor)) {
        throw new Error('Saldo insuficiente na dotação')
      }
 
      // debitar saldo
      await tx.dotacao.update({
        where: { id: dotacao.id },
        data: { saldoDisponivel: { decrement: input.valor } },
      })
 
      // criar empenho
      return tx.empenho.create({
        data: {
          orgId,
          dotacaoId: input.dotacaoId,
          descricao: input.descricao,
          valor: input.valor,
          criadoPor: userId,
        },
      })
    }, {
      isolationLevel: 'Serializable', // obrigatório para operações financeiras
    })
 
    // 4. Revalidar cache
    revalidatePath('/[orgSlug]/empenhos', 'page')
 
    return { success: true, data: empenho }
 
  } catch (error) {
    // Logar internamente, nunca expor stack trace
    console.error('[criarEmpenho]', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return { success: false, error: message }
  }
}
```
 
---
 
## Padrões de Autenticação e Tenant
 
```typescript
// Sempre no topo da action, antes de qualquer operação
const { userId, orgId } = await auth()
if (!userId || !orgId) {
  return { success: false, error: 'Não autorizado' }
}
 
// Para verificar permissão de role dentro da org (quando necessário)
const { has } = await auth()
if (!has({ permission: 'org:empenho:criar' })) {
  return { success: false, error: 'Sem permissão para esta operação' }
}
```
 
---
 
## Revalidação de Cache
 
```typescript
// Após mutação, revalidar a página ou segmento afetado
revalidatePath(`/${orgSlug}/empenhos`)           // rota específica
revalidatePath(`/${orgSlug}/empenhos`, 'page')   // força rerender da page
revalidatePath(`/${orgSlug}/dotacoes/[id]`, 'page') // quando dotação é afetada também
```
 
---
 
## Action com `useFormState` (React 19 / Next.js 15)
 
Para formulários progressivos (sem JS ou com estado de form):
 
```typescript
// action — assinatura compatível com useActionState
export async function criarEmpenhoAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult<Empenho>> {
  const rawInput = {
    dotacaoId: formData.get('dotacaoId'),
    descricao: formData.get('descricao'),
    valor: Number(formData.get('valor')),
  }
  return criarEmpenho(rawInput)
}
```
 
```typescript
// componente client
'use client'
import { useActionState } from 'react'
import { criarEmpenhoAction } from '../actions/criar-empenho'
 
export function EmpenhoForm() {
  const [state, formAction, isPending] = useActionState(criarEmpenhoAction, null)
 
  return (
    <form action={formAction}>
      {state?.success === false && (
        <p className="text-red-600 text-sm">{state.error}</p>
      )}
      {/* campos */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Salvando...' : 'Criar Empenho'}
      </button>
    </form>
  )
}
```
 
---
 
## Ações de Leitura (Query Actions)
 
Para casos onde Server Components não resolvem (ex: busca dinâmica client-side):
 
```typescript
'use server'
 
export async function buscarDotacoes(termo: string) {
  const { orgId } = await auth()
  if (!orgId) return []
 
  return prisma.dotacao.findMany({
    where: {
      orgId,
      OR: [
        { codigo: { contains: termo, mode: 'insensitive' } },
        { descricao: { contains: termo, mode: 'insensitive' } },
      ],
      status: 'ATIVA',
    },
    take: 10,
    select: { id: true, codigo: true, descricao: true, saldoDisponivel: true },
  })
}
```
 
---
 
## Anti-Patterns — Nunca Fazer
 
```typescript
// ❌ Sem validação Zod
export async function criarEmpenho(dotacaoId: string, valor: number) { /* ... */ }
 
// ❌ Sem verificação de tenant
const empenho = await prisma.empenho.findUnique({ where: { id } }) // pode pegar de outro org!
 
// ❌ Operação financeira sem transação
await prisma.dotacao.update({ data: { saldoDisponivel: { decrement: valor } } })
await prisma.empenho.create({ data: { /* ... */ } }) // se isso falhar, saldo já foi debitado!
 
// ❌ Expor erro interno
return { success: false, error: error.stack } // nunca!
 
// ❌ Float para dinheiro
valor: 1250.50  // Prisma vai tratar como Float se o schema estiver errado
```