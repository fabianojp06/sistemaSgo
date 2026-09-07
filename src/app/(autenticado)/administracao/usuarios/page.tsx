import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';

/**
 * EP085 / UC02.11 + UC02.12 — Manter / Cadastrar Usuários.
 * FUNDAÇÃO: scaffold da rota. A listagem (UC02.11), o formulário de cadastro
 * (US-201) e os painéis de perfis/exceções (US-202/US-203) são costurados na
 * Wave 2 (feat/us-201-integracao). Ver docs/PLANO.
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

  const usuarios = await prisma.usuario.findMany({
    where: { tenantId },
    orderBy: { nomeCompleto: 'asc' },
    select: { id: true, nomeCompleto: true, login: true, status: true, situacaoAcesso: true },
  });

  return (
    <main className="p-6">
      <h1 className="text-lg font-bold text-[#1A1F29] dark:text-[#EBEDF2]">Usuários</h1>
      <p className="mt-1 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
        Módulo de Administração — Operadores e Permissões. Tela em construção (UC02.12 / US-201..205).
      </p>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-[#DDE2EA] text-left dark:border-[#2B303C]">
            <th className="py-2 pr-4 font-semibold">Nome</th>
            <th className="py-2 pr-4 font-semibold">Login</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 pr-4 font-semibold">Situação de acesso</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b border-[#EEF1F5] dark:border-[#21262F]">
              <td className="py-2 pr-4">{u.nomeCompleto}</td>
              <td className="py-2 pr-4">{u.login}</td>
              <td className="py-2 pr-4">{u.status}</td>
              <td className="py-2 pr-4">{u.situacaoAcesso}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
