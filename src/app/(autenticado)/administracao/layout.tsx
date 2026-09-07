import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';

/**
 * EP085 / US-205 — o módulo de Administração é acessível apenas ao perfil
 * "Administrador" (RN_SEED_003). Esta casca nega o render de qualquer rota
 * `/administracao/*` para quem não for Administrador. Complementa (não substitui)
 * o `guardAdministrador()` que roda em cada Server Action.
 */
export default async function LayoutAdministracao({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const admin = await prisma.usuario.findFirst({
    where: {
      tenantId,
      clerkUserId: userId,
      perfis: { some: { tenantId, perfil: { nome: 'Administrador' } } },
    },
    select: { id: true },
  });
  if (!admin) redirect('/');

  return <>{children}</>;
}
