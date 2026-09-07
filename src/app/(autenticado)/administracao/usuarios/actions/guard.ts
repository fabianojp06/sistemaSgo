import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { getClerkClient, ehAdministrador } from '@/infrastructure/auth/clerk';
import { NaoAutorizadoError } from '@/domain/administracao/errors';

export type ContextoAdministrador = {
  tenantId: string;
  usuarioId: string;
  usuarioNome: string;
  clerkUserId: string;
  clerkSessionId: string | null;
  ipEstacao: string | null;
};

/**
 * US-205 — guarda RBAC do módulo de Administração. Revalida SEMPRE no servidor,
 * em toda Server Action do módulo, antes de qualquer efeito:
 *   1. sessão Clerk válida;
 *   2. publicMetadata.role === 'ADMIN';
 *   3. o usuário possui UsuarioPerfil com Perfil.nome = 'Administrador' no tenant corrente
 *      (não confiar apenas no metadata — Cenário 3 da US-205).
 * `tenantId` vem sempre de getTenantId() (a requisição), nunca do payload.
 *
 * FUNDAÇÃO: núcleo funcional. O hardening/E2E completo é a US-205.
 */
export async function guardAdministrador(): Promise<ContextoAdministrador> {
  const { userId, sessionId } = await auth();
  if (!userId) throw new NaoAutorizadoError('Sessão inválida ou expirada.');

  const tenantId = await getTenantId();

  const usuario = await prisma.usuario.findFirst({
    where: {
      tenantId,
      clerkUserId: userId,
      perfis: { some: { tenantId, perfil: { nome: 'Administrador' } } },
    },
    select: { id: true, nomeCompleto: true },
  });
  if (!usuario) throw new NaoAutorizadoError();

  const clerk = await getClerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  if (!ehAdministrador(clerkUser)) throw new NaoAutorizadoError();

  const ip =
    (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ??
    (await headers()).get('x-real-ip') ??
    null;

  return {
    tenantId,
    usuarioId: usuario.id,
    usuarioNome: usuario.nomeCompleto,
    clerkUserId: userId,
    clerkSessionId: sessionId ?? null,
    ipEstacao: ip,
  };
}
