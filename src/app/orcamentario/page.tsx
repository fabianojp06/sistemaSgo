import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

/**
 * [EP48/26] Módulo Orçamentário — landing "em construção". Nenhuma UC04 está
 * implementada ainda (Cronograma de Desembolso, Execução Orçamentária,
 * Remanejamento entre Contas etc., ver docs/SGO2_Estrutura_Menu_Relacionamentos.docx
 * seção 2, item 4) — esta página só garante que o módulo exista na navegação,
 * seguindo a estrutura de menu oficial (logo após Cadastros).
 */
export default async function OrcamentarioPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

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
          Este módulo trará Cronograma de Desembolso, Premissas de Reajuste, Recursos Financeiros, Contratações Previstas,
          Execução Orçamentária, Demonstrativo Orçamentário Analítico, Remanejamento de Valores entre Contas e demais
          funcionalidades do ciclo orçamentário do Termo de Parceria.
        </p>
      </div>
    </main>
  );
}
