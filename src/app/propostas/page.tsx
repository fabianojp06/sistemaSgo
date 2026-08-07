import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { listarPropostas } from './actions';
import { PropostaListPanel } from './PropostaListPanel';

/** US-114 (UC03.06, porta de entrada) — Listar/Cadastrar/Duplicar/Excluir Versão de Proposta. */
export default async function PropostasPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const [podeCriar, podeDuplicar, podeExcluirVersao, podeCriarVersao, resultado] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'propostas.criar'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'propostas.duplicar'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'propostas.excluir-versao'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'propostas.criar-versao'),
    listarPropostas(),
  ]);

  const propostas = resultado.sucesso ? resultado.dados : [];

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Propostas</h1>
        <Link
          href="/"
          className="rounded-lg border border-gray-100 bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:shadow-md"
        >
          &larr; Página Inicial
        </Link>
      </header>

      {!resultado.sucesso ? (
        <p className="text-sm text-red-600">{resultado.mensagem}</p>
      ) : (
        <PropostaListPanel
          propostasIniciais={propostas}
          podeCriar={podeCriar}
          podeDuplicar={podeDuplicar}
          podeExcluirVersao={podeExcluirVersao}
          podeCriarVersao={podeCriarVersao}
        />
      )}
    </main>
  );
}
