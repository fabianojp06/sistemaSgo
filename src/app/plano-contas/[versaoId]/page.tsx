import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';
import { getListarTermosAjusteUseCase } from '@/application/use-cases/plano-contas/container';
import { ValorOrcadoContaForm } from '../ValorOrcadoContaForm';
import { TermoAjustePanel } from '../TermoAjustePanel';

/**
 * Host mínimo para os formulários escopados por Versão de Proposta (US-007, US-111)
 * enquanto a tela completa de "Alterar Proposta" com guias analíticas (UC03.06) não
 * existe — ver nota no backlog (`docs/BACKLOG - Kanban EP118-24 Módulo de Cadastros.md`).
 * Sem navegação própria no menu ainda: acessível só por link direto /plano-contas/{versaoId}.
 */
export default async function VersaoPropostaPage({ params }: { params: Promise<{ versaoId: string }> }) {
  const { versaoId } = await params;

  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const versao = await prisma.versaoProposta.findFirst({
    where: { tenantId, id: versaoId, ativa: true },
    include: { proposta: true },
  });
  if (!versao) notFound();

  const [podeConfigurarValorOrcado, podeAprovarN1, podeHomologarGestorMaster, contas, termosAjuste] = await Promise.all([
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'plano-contas.configurar-valor-orcado'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'termo-ajuste.aprovar-n1'),
    usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'termo-ajuste.homologar-gestor-master'),
    prisma.contaContabil.findMany({
      where: { tenantId, isAnalitica: true },
      orderBy: { codigoErp: 'asc' },
      select: { id: true, codigoErp: true, nomeConta: true },
    }),
    getListarTermosAjusteUseCase().execute(tenantId, versaoId),
  ]);

  const contasAnaliticas = contas.map((c) => ({ id: c.id, label: `${c.codigoErp} — ${c.nomeConta}` }));

  return (
    <main className="flex min-h-screen flex-col gap-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">{versao.proposta.nome}</h1>
        <p className="text-sm text-gray-500">
          {versao.proposta.codigo} — Versão {versao.numeroVersao} ({versao.status})
        </p>
      </header>

      {podeConfigurarValorOrcado && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-500">Valor Orçado por Conta</h2>
          <ValorOrcadoContaForm versaoId={versao.id} contasAnaliticas={contasAnaliticas} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-500">Termo de Ajuste</h2>
        <TermoAjustePanel
          versaoId={versao.id}
          contasAnaliticas={contasAnaliticas}
          termosIniciais={termosAjuste.map((t) => ({
            id: t.id,
            contaOrigemLabel: t.contaOrigemLabel,
            contaDestinoLabel: t.contaDestinoLabel,
            exercicio: t.exercicio,
            valor: t.valor.toString(),
            status: t.status,
            updatedAt: t.updatedAt.toISOString(),
          }))}
          podeAprovarN1={podeAprovarN1}
          podeHomologarGestorMaster={podeHomologarGestorMaster}
        />
      </section>
    </main>
  );
}
