import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';

/**
 * [EP48/26] Módulo Orçamentário — landing parcial. A maioria das UC04 ainda
 * não está implementada (Execução Orçamentária, Remanejamento entre Contas
 * etc.), mas UC04.01 (Cronograma de Desembolso, US-122) e UC04.02 (Premissas
 * e Reajustes, US-128) já existem como guias dentro do detalhe de cada
 * Proposta — por isso esta tela lista as Propostas com link direto para cada
 * submódulo, em vez de deixar o usuário sem nenhum caminho para chegar lá a
 * partir do módulo Orçamentário.
 */
export default async function OrcamentarioPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const propostas = await prisma.proposta.findMany({
    where: { tenantId },
    orderBy: { codigo: 'desc' },
    select: { id: true, codigo: true, nome: true },
  });

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#F7F8FA] p-6 dark:bg-[#12151C]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Orçamentário</h1>
        <Link
          href="/"
          className="rounded-lg border border-[#DDE2EA] bg-white px-4 py-2 text-sm font-medium text-[#2B5FD9] shadow-sm hover:shadow-md dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#6D93F0]"
        >
          &larr; Página Inicial
        </Link>
      </header>

      <div className="max-w-lg rounded-[10px] border border-[#DDE2EA] bg-white p-6 shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
        <p className="text-sm font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Módulo Orçamentário (EP48/26) — em desenvolvimento</p>
        <p className="mt-2 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
          Cronograma de Desembolso (UC04.01) e Premissas e Reajustes (UC04.02) já estão disponíveis abaixo. As demais
          funcionalidades — Recursos Financeiros, Contratações Previstas, Execução Orçamentária, Demonstrativo
          Orçamentário Analítico, Remanejamento de Valores entre Contas — ainda serão implementadas.
        </p>
      </div>

      <div className="max-w-lg rounded-[10px] border border-[#DDE2EA] bg-white shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
        <div className="border-b border-[#DDE2EA] px-4 py-3 dark:border-[#2B303C]">
          <p className="text-sm font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Cronograma de Desembolso — escolha a Proposta</p>
        </div>
        {propostas.length === 0 ? (
          <p className="p-4 text-sm text-[#8A8F98] dark:text-[#767C89]">Nenhuma Proposta cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-[#DDE2EA] dark:divide-[#2B303C]">
            {propostas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/propostas/${p.id}/cronograma-desembolso`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-[#E8EEFC] dark:hover:bg-[#1D2A48]"
                >
                  <span>
                    <span className="font-mono text-xs text-[#8A8F98] dark:text-[#767C89]">{p.codigo}</span>{' '}
                    <span className="text-[#1A1F29] dark:text-[#EBEDF2]">{p.nome}</span>
                  </span>
                  <span className="text-[#2B5FD9] dark:text-[#6D93F0]">Ver Cronograma &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="max-w-lg rounded-[10px] border border-[#DDE2EA] bg-white shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
        <div className="border-b border-[#DDE2EA] px-4 py-3 dark:border-[#2B303C]">
          <p className="text-sm font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Premissas e Reajustes — escolha a Proposta</p>
        </div>
        {propostas.length === 0 ? (
          <p className="p-4 text-sm text-[#8A8F98] dark:text-[#767C89]">Nenhuma Proposta cadastrada ainda.</p>
        ) : (
          <ul className="divide-y divide-[#DDE2EA] dark:divide-[#2B303C]">
            {propostas.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/propostas/${p.id}/premissas-reajustes`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-[#E8EEFC] dark:hover:bg-[#1D2A48]"
                >
                  <span>
                    <span className="font-mono text-xs text-[#8A8F98] dark:text-[#767C89]">{p.codigo}</span>{' '}
                    <span className="text-[#1A1F29] dark:text-[#EBEDF2]">{p.nome}</span>
                  </span>
                  <span className="text-[#2B5FD9] dark:text-[#6D93F0]">Ver Premissas &rarr;</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
