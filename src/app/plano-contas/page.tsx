import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { getListarAgrupadoresUseCase } from '@/application/use-cases/plano-contas/container';
import { BotaoSincronizar } from './BotaoSincronizar';
import { AgrupadorPanel } from './AgrupadorPanel';
import { ArvoreContas, type NoContaContabil } from './ArvoreContas';

function montarArvore(contas: { id: string; codigoErp: string; nomeConta: string; idPai: string | null; isAnalitica: boolean; statusSync: string; natureza: 'OPEX' | 'CAPEX' | null }[]): NoContaContabil[] {
  const porId = new Map<string, NoContaContabil>(
    contas.map((c) => [c.id, { ...c, filhas: [] }]),
  );
  const raizes: NoContaContabil[] = [];

  for (const conta of porId.values()) {
    if (conta.idPai && porId.has(conta.idPai)) {
      porId.get(conta.idPai)!.filhas.push(conta);
    } else {
      raizes.push(conta);
    }
  }

  return raizes;
}

/** UC03.00 — Configurar Estrutura Plano de Contas. */
export default async function PlanoContasPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const [podeSincronizar, podeClassificarNatureza, contas, agrupadores] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'plano-contas.sincronizar'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'plano-contas.classificar-natureza'),
    prisma.contaContabil.findMany({
      where: { tenantId },
      orderBy: { codigoErp: 'asc' },
      select: { id: true, codigoErp: true, nomeConta: true, idPai: true, isAnalitica: true, statusSync: true, natureza: true },
    }),
    getListarAgrupadoresUseCase().execute(tenantId),
  ]);

  const contasAnaliticas = contas.filter((c) => c.isAnalitica);
  const arvore = montarArvore(contas);

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plano de Contas Único</h1>
        {podeSincronizar && <BotaoSincronizar />}
      </header>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Árvore Contábil</h2>
        {arvore.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma conta sincronizada ainda. Clique em &quot;Sincronizar com ERP Senior&quot; para importar o plano fictício.
          </p>
        ) : (
          <ArvoreContas nos={arvore} podeClassificarNatureza={podeClassificarNatureza} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Agrupadores de Contas</h2>
        <AgrupadorPanel
          agrupadores={agrupadores.map((a) => ({ ...a, total: a.total.toString() }))}
          contasAnaliticas={contasAnaliticas.map((c) => ({ id: c.id, label: `${c.codigoErp} — ${c.nomeConta}` }))}
        />
      </section>
    </main>
  );
}
