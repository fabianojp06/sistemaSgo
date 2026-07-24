'use server';

import { auth } from '@clerk/nextjs/server';
import { getEfetuarLogoffUseCase } from '@/application/use-cases/auth/container';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';

/**
 * UC01.04 — Efetuar Logoff (Server Action).
 * CA-01.04.02 — revoga a sessão no Clerk e registra o evento antes de o cliente
 * limpar o token local e redirecionar para a tela de login [UC01.01].
 * Nunca lança para o cliente: mesmo em falha [E1/E2], o logoff no cliente deve prosseguir.
 */
export async function efetuarLogoff(): Promise<void> {
  const { userId, sessionId } = await auth();

  if (!userId || !sessionId) {
    return;
  }

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({
    where: { tenantId, clerkUserId: userId },
    select: { id: true },
  });

  if (!usuario) {
    return;
  }

  const efetuarLogoffUseCase = await getEfetuarLogoffUseCase();
  await efetuarLogoffUseCase.execute({
    tenantId,
    usuarioId: usuario.id,
    clerkSessionId: sessionId,
  });
}
