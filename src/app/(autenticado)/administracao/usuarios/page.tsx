import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { getListarPerfisAtivosUseCase } from '@/application/use-cases/administracao/container';
import { UsuariosClient } from './UsuariosClient';

// Página administrativa por usuário — nunca estática (depende de sessão Clerk + banco).
export const dynamic = 'force-dynamic';

/**
 * EP085 / UC02.11 + UC02.12 — Manter / Cadastrar Usuários.
 * O acesso é restrito a Administrador pelo layout de /administracao (US-205);
 * cada Server Action revalida via guardAdministrador().
 */
export default async function UsuariosPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({
    where: { tenantId, clerkUserId: userId },
    select: { id: true },
  });
  if (!usuario) redirect('/login');

  const [usuarios, perfis] = await Promise.all([
    prisma.usuario.findMany({
      where: { tenantId },
      orderBy: { nomeCompleto: 'asc' },
      select: { id: true, nomeCompleto: true, login: true, email: true, status: true, situacaoAcesso: true },
    }),
    getListarPerfisAtivosUseCase().execute(tenantId),
  ]);

  return (
    <main className="p-6">
      <h1 className="text-lg font-bold text-[#1A1F29] dark:text-[#EBEDF2]">Usuários</h1>
      <p className="mt-1 mb-4 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
        Módulo de Administração — Operadores e Permissões.
      </p>
      <UsuariosClient usuarios={usuarios} perfis={perfis} />
    </main>
  );
}
