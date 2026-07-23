# UI Patterns — SGO 2.0
 
Referência para o **UI Mode**: componentes React, formulários e Tailwind.
 
## Template: Formulário com Server Action
 
```typescript
// features/empenhos/components/EmpenhoForm.tsx
'use client'
 
import { useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarEmpenhoAction } from '../actions/criar-empenho'
import type { ActionResult } from '../schemas/empenho.schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
 
type Props = {
  dotacoes: { id: string; codigo: string; descricao: string; saldoDisponivel: number }[]
}
 
export function EmpenhoForm({ dotacoes }: Props) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    criarEmpenhoAction,
    null
  )
  const router = useRouter()
 
  // Redirecionar após sucesso
  if (state?.success) {
    router.push('/empenhos')
  }
 
  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      {/* Erro geral */}
      {state?.success === false && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
 
      {/* Dotação */}
      <div className="space-y-1">
        <Label htmlFor="dotacaoId">Dotação</Label>
        <select
          id="dotacaoId"
          name="dotacaoId"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Selecione uma dotação...</option>
          {dotacoes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo} — {d.descricao} (saldo: {formatCurrency(d.saldoDisponivel)})
            </option>
          ))}
        </select>
        {state?.success === false && state.fieldErrors?.dotacaoId && (
          <p className="text-xs text-destructive">{state.fieldErrors.dotacaoId[0]}</p>
        )}
      </div>
 
      {/* Descrição */}
      <div className="space-y-1">
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          name="descricao"
          placeholder="Descrição do empenho"
          required
          minLength={3}
        />
        {state?.success === false && state.fieldErrors?.descricao && (
          <p className="text-xs text-destructive">{state.fieldErrors.descricao[0]}</p>
        )}
      </div>
 
      {/* Valor */}
      <div className="space-y-1">
        <Label htmlFor="valor">Valor (R$)</Label>
        <Input
          id="valor"
          name="valor"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0,00"
          required
        />
        {state?.success === false && state.fieldErrors?.valor && (
          <p className="text-xs text-destructive">{state.fieldErrors.valor[0]}</p>
        )}
      </div>
 
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? 'Salvando...' : 'Criar Empenho'}
      </Button>
    </form>
  )
}
 
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
```
 
---
 
## Template: Tabela de Listagem
 
```typescript
// features/empenhos/components/EmpenhoList.tsx
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { Empenho, Dotacao } from '@prisma/client'
 
type EmpenhoComDotacao = Empenho & { dotacao: Pick<Dotacao, 'codigo'> }
 
const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDENTE:  { label: 'Pendente',  variant: 'secondary' },
  APROVADO:  { label: 'Aprovado',  variant: 'default' },
  LIQUIDADO: { label: 'Liquidado', variant: 'outline' },
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
}
 
export function EmpenhoList({ empenhos }: { empenhos: EmpenhoComDotacao[] }) {
  if (empenhos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum empenho encontrado.
      </div>
    )
  }
 
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Dotação</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {empenhos.map((empenho) => {
          const badge = STATUS_BADGE[empenho.status]
          return (
            <TableRow key={empenho.id}>
              <TableCell className="font-mono">{empenho.numero}</TableCell>
              <TableCell>{empenho.dotacao.codigo}</TableCell>
              <TableCell className="max-w-xs truncate">{empenho.descricao}</TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(empenho.valor.toNumber())}
              </TableCell>
              <TableCell>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {empenho.criadoEm.toLocaleDateString('pt-BR')}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
 
function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
```
 
---
 
## Skeleton de Loading
 
```typescript
// app/(dashboard)/[orgSlug]/empenhos/loading.tsx
import { Skeleton } from '@/components/ui/skeleton'
 
export default function EmpenhosLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
```
 
---
 
## Error Boundary
 
```typescript
// app/(dashboard)/[orgSlug]/empenhos/error.tsx
'use client'
 
import { Button } from '@/components/ui/button'
 
export default function EmpenhosError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-destructive font-medium">Erro ao carregar empenhos</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
```
 
---
 
## Convenções Tailwind do Projeto
 
```
Layout:     container mx-auto px-4 py-6
Seções:     space-y-6 | gap-4
Cards:      rounded-lg border bg-card p-6 shadow-sm
Títulos:    text-2xl font-bold | text-lg font-semibold
Subtítulos: text-sm text-muted-foreground
Erros:      text-destructive text-sm
Mono:       font-mono (números, códigos)
Tabela:     usar sempre shadcn/ui Table
Formulário: space-y-4, Label + Input + erro inline
Botões:     shadcn/ui Button — variant: default/outline/destructive/ghost
```
 
---
 
## Formatação de Valores Financeiros
 
```typescript
// lib/formatters.ts
 
export function formatCurrency(value: number | string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value))
}
 
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}
 
export function formatDatetime(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}
```
 