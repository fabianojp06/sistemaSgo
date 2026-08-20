import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AcompanhamentoPanel } from './AcompanhamentoPanel';

/**
 * [LAYOUT — placeholder, sem regra de negócio ainda] "Acompanhamento", novo
 * relatório do Módulo Orçamentário (EP48/26), a partir de
 * src/application/use-cases/plano-contas/MODELO.xlsx (aba "ACOMP"). Só
 * estrutura visual com dado mock (AcompanhamentoPanel.tsx/mockData.ts) — sem
 * Server Action real, sem Prisma, sem checagem de Funcionalidade (ainda não
 * existe uma definida para esta tela). Regras de negócio, caso de uso e
 * critérios de aceite formais virão depois (analista-negocios-po).
 */
export default async function AcompanhamentoPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-[#F7F8FA] p-6 dark:bg-[#12151C]">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Acompanhamento</h1>
        <Link
          href="/orcamentario"
          className="rounded-lg border border-[#DDE2EA] bg-white px-4 py-2 text-sm font-medium text-[#2B5FD9] shadow-sm hover:shadow-md dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#6D93F0]"
        >
          &larr; Módulo Orçamentário
        </Link>
      </header>

      <AcompanhamentoPanel />
    </main>
  );
}
