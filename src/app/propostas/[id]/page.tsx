import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';

/**
 * US-114 — ponte temporária: ainda não existe a tela de detalhe com guias
 * analíticas (US-115, próxima da fila). Enquanto isso, redireciona para o
 * host mínimo já existente (`/plano-contas/[versaoId]`) na versão vigente.
 */
export default async function PropostaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  if (!usuario) redirect('/login');

  const versaoVigente = await prisma.versaoProposta.findFirst({
    where: { tenantId, propostaId: id, vigente: true, ativa: true },
    select: { id: true },
  });
  if (!versaoVigente) notFound();

  redirect(`/plano-contas/${versaoVigente.id}`);
}
