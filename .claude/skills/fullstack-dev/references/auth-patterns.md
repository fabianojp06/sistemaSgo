# Auth Patterns — SGO 2.0
 
Referência para o **Auth Mode**: Clerk, tenant context e proteção de rotas.
 
## Modelo de Tenant no SGO 2.0
 
```
Clerk Organization  →  orgId  =  tenantId do SGO
Clerk User          →  userId =  criadoPor / atualizadoPor
Clerk Role          →  permissões dentro da organização
```
 
Todo dado do banco tem `orgId` (= Clerk `orgId`). Nunca acessar dados de outro `orgId`.
 
---
 
## Clerk: Leitura de Contexto
 
### Em Server Components e Server Actions
 
```typescript
import { auth, currentUser } from '@clerk/nextjs/server'
 
// Mínimo necessário (mais performático)
const { userId, orgId, orgRole } = await auth()
 
// Quando precisa de dados do usuário (nome, email, etc.)
const user = await currentUser()
```
 
### Em Client Components
 
```typescript
'use client'
import { useAuth, useOrganization, useUser } from '@clerk/nextjs'
 
export function MeuComponente() {
  const { userId, orgId, isLoaded } = useAuth()
  const { organization } = useOrganization()
  const { user } = useUser()
 
  if (!isLoaded) return <Skeleton />
  // ...
}
```
 
---
 
## Proteção de Rotas
 
### Middleware (proteção global)
 
```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
 
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])
 
export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})
 
export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'],
}
```
 
### Em Server Components (verificação adicional)
 
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
 
export default async function Page() {
  const { userId, orgId } = await auth()
 
  // Redirecionar se não autenticado
  if (!userId) redirect('/sign-in')
 
  // Redirecionar se não selecionou organização
  if (!orgId) redirect('/selecionar-organizacao')
 
  // Prosseguir com orgId garantido
  const dados = await prisma.empenho.findMany({ where: { orgId } })
  // ...
}
```
 
### Em Server Actions (padrão obrigatório)
 
```typescript
'use server'
import { auth } from '@clerk/nextjs/server'
 
export async function minhaAction(input: unknown) {
  // SEMPRE primeiro passo em toda action
  const { userId, orgId } = await auth()
  if (!userId || !orgId) {
    return { success: false, error: 'Não autorizado' }
  }
 
  // Resto da action usa orgId como tenant
}
```
 
---
 
## Verificação de Permissão por Role
 
```typescript
// Verificar role da org (admin vs membro)
const { orgRole } = await auth()
if (orgRole !== 'org:admin') {
  return { success: false, error: 'Sem permissão' }
}
 
// Verificar permissão customizada (Custom Roles no Clerk)
const { has } = await auth()
if (!has({ permission: 'org:empenho:aprovar' })) {
  return { success: false, error: 'Sem permissão para aprovar empenhos' }
}
```
 
---
 
## URL com orgSlug: Estrutura de Rotas
 
O SGO 2.0 usa `orgSlug` na URL para identificar a organização visualmente:
 
```
/[orgSlug]/dotacoes          → lista de dotações
/[orgSlug]/empenhos          → lista de empenhos
/[orgSlug]/empenhos/novo     → formulário
/[orgSlug]/empenhos/[id]     → detalhe
```
 
### Resolver orgId a partir de orgSlug
 
```typescript
// lib/auth/org.ts
import { auth, clerkClient } from '@clerk/nextjs/server'
 
export async function getOrgFromSlug(orgSlug: string) {
  const { userId } = await auth()
  if (!userId) return null
 
  const client = await clerkClient()
  const orgs = await client.users.getOrganizationMembershipList({ userId })
  return orgs.data.find((m) => m.organization.slug === orgSlug)?.organization ?? null
}
```
 
### Em layouts protegidos
 
```typescript
// app/(dashboard)/[orgSlug]/layout.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getOrgFromSlug } from '@/lib/auth/org'
 
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
 
  const org = await getOrgFromSlug(params.orgSlug)
  if (!org) redirect('/selecionar-organizacao')
 
  return <>{children}</>
}
```
 
---
 
## Componentes Clerk Úteis
 
```typescript
// Troca de organização (multi-tenant switcher)
import { OrganizationSwitcher } from '@clerk/nextjs'
 
<OrganizationSwitcher
  afterSelectOrganizationUrl="/:slug/dotacoes"
  afterCreateOrganizationUrl="/:slug/dotacoes"
/>
 
// Perfil do usuário
import { UserButton } from '@clerk/nextjs'
<UserButton afterSignOutUrl="/" />
 
// Botões de sign-in/up
import { SignInButton, SignUpButton } from '@clerk/nextjs'
<SignInButton mode="modal" />
```
 
---
 
## Anti-Patterns de Auth
 
```typescript
// ❌ Confiar apenas no cliente para tenant
const orgId = searchParams.get('orgId') // nunca! usuário pode manipular
 
// ❌ Esquecer de verificar orgId no banco
await prisma.empenho.findUnique({ where: { id } }) // sem filtro de orgId!
 
// ❌ Expor userId ou orgId em logs públicos
console.log(`userId: ${userId}`) // logar apenas em dev, nunca em prod visível
 
// ✅ Sempre do Clerk, nunca do cliente
const { userId, orgId } = await auth()
```