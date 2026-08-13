import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { listarAliquotasImposto } from './actions';
import { AliquotaImpostoListPanel } from './AliquotaImpostoListPanel';

/** US-123 (UC03.39, ADR-038) — Central de Manutenção de Alíquotas de Impostos. */
export default async function AliquotasImpostosPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const [podeCriar, podeEditar, podeExcluir, contasParaSugestao, resultado] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'aliquotas-impostos.criar'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'aliquotas-impostos.editar'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'aliquotas-impostos.excluir'),
    prisma.contaContabil.findMany({
      where: { tenantId },
      select: { id: true, codigoErp: true, nomeConta: true },
      orderBy: { codigoErp: 'asc' },
    }),
    listarAliquotasImposto(),
  ]);

  const aliquotas = resultado.sucesso ? resultado.dados : [];
  const opcoesContaSugerida = contasParaSugestao.map((c) => ({ id: c.id, label: `${c.codigoErp} — ${c.nomeConta}` }));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Alíquotas de Impostos</h1>
          <p className="text-sm text-gray-500">Cadastros &gt; Alíquotas de Impostos (UC03.39-42)</p>
        </div>
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
        <AliquotaImpostoListPanel
          aliquotasIniciais={aliquotas}
          opcoesContaSugerida={opcoesContaSugerida}
          podeCriar={podeCriar}
          podeEditar={podeEditar}
          podeExcluir={podeExcluir}
        />
      )}
    </main>
  );
}
