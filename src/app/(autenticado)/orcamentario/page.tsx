import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/infrastructure/db/prisma';
import { getTenantId } from '@/infrastructure/tenant';
import { usuarioTemFuncionalidade } from '@/application/use-cases/plano-contas/verificarPermissao';

function IconeCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[1.2rem] w-[1.2rem]">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function IconeRelatorio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[1.2rem] w-[1.2rem]">
      <path d="M4 19h16M7 15l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconeAcompanhamento() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[1.2rem] w-[1.2rem]">
      <path d="M3 3v18h18M7 15l4-6 3 3 4-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconeOrcado() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[1.2rem] w-[1.2rem]">
      <path d="M9 3v18M4 8h5m-5 4h5m-5 4h5M13 6h7M13 12h7M13 18h7" strokeLinecap="round" />
    </svg>
  );
}
function IconePremissas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[1.2rem] w-[1.2rem]">
      <path
        d="M12 3v4m0 10v4M5 12H3m18 0h-2M6.3 6.3 5 5m14 14-1.3-1.3M17.7 6.3 19 5M5 19l1.3-1.3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

type ChipStatus = 'pronto' | 'layout';

function ChipStatusBadge({ status }: { status: ChipStatus }) {
  return status === 'pronto' ? (
    <span className="rounded-full bg-[#E7F6EC] px-2 py-0.5 text-[0.64rem] font-bold tracking-wide text-[#16A34A] uppercase dark:bg-[#133622] dark:text-[#4ADE80]">
      Pronto
    </span>
  ) : (
    <span className="rounded-full bg-[#FBEFDD] px-2 py-0.5 text-[0.64rem] font-bold tracking-wide text-[#C2740A] uppercase dark:bg-[#3A2A12] dark:text-[#F2B155]">
      Em layout
    </span>
  );
}

/** Tile de relatório do Módulo Orçamentário — opção D escolhida pelo usuário (2026-08-20). */
function RelatorioTile({
  href,
  icone,
  status,
  titulo,
  descricao,
  rotuloAcao,
}: {
  href: string;
  icone: React.ReactNode;
  status: ChipStatus;
  titulo: string;
  descricao: string;
  rotuloAcao: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-[#DDE2EA] bg-white p-[1.15rem] shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] transition hover:-translate-y-0.5 hover:border-[#2B5FD9] hover:shadow-[0_6px_16px_rgba(20,24,33,0.09),0_2px_4px_rgba(20,24,33,0.06)] dark:border-[#2B303C] dark:bg-[#191D26] dark:hover:border-[#6D93F0]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#E8EEFC] text-[#2B5FD9] dark:bg-[#1D2A48] dark:text-[#6D93F0]">
          {icone}
        </span>
        <ChipStatusBadge status={status} />
      </div>
      <h3 className="text-[0.95rem] font-bold text-[#1A1F29] dark:text-[#EBEDF2]">{titulo}</h3>
      <p className="flex-1 text-[0.8rem] leading-relaxed text-[#5B6270] dark:text-[#A4AAB6]">{descricao}</p>
      <span className="text-[0.78rem] font-semibold text-[#2B5FD9] dark:text-[#6D93F0]">{rotuloAcao} &rarr;</span>
    </Link>
  );
}

/**
 * [EP48/26] Módulo Orçamentário — landing parcial. A maioria das UC04 ainda
 * não está implementada (Execução Orçamentária, Remanejamento entre Contas
 * etc.), mas UC04.01 (Cronograma de Desembolso, US-122), UC04.02 (Premissas
 * e Reajustes, US-128), US-138 (Relatório de Cronograma) já existem como
 * telas do módulo, e Acompanhamento/Orçado existem como layout (2026-08-20,
 * sem regra de negócio ainda). Grade de tiles com selo de status (opção D
 * do artefato de estilos escolhida pelo usuário) — Cronograma de Desembolso
 * e Premissas e Reajustes ainda exigem escolher a Proposta antes, então o
 * tile leva à seção de escolha logo abaixo em vez de navegar direto.
 */
export default async function OrcamentarioPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tenantId = await getTenantId();
  const usuario = await prisma.usuario.findFirst({ where: { tenantId, clerkUserId: userId }, select: { id: true } });
  const podeVerRelatorioCronograma = usuario
    ? await usuarioTemFuncionalidade(prisma, tenantId, usuario.id, 'orcamentario.cronograma-desembolso-relatorio.visualizar')
    : false;

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

      <div className="rounded-[10px] border border-[#DDE2EA] bg-white p-6 shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]">
        <p className="text-sm font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Módulo Orçamentário (EP48/26) — em desenvolvimento</p>
        <p className="mt-2 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
          Os relatórios abaixo já estão disponíveis. As demais funcionalidades — Recursos Financeiros, Contratações Previstas,
          Execução Orçamentária, Demonstrativo Orçamentário Analítico, Remanejamento de Valores entre Contas — ainda serão
          implementadas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RelatorioTile
          href="#cronograma-desembolso"
          icone={<IconeCalendario />}
          status="pronto"
          titulo="Cronograma de Desembolso"
          descricao="Aba dentro de cada Proposta — geração automática, sem filtro."
          rotuloAcao="Escolher Proposta"
        />
        {podeVerRelatorioCronograma && (
          <RelatorioTile
            href="/orcamentario/cronograma-desembolso-relatorio"
            icone={<IconeRelatorio />}
            status="pronto"
            titulo="Relatório de Cronograma"
            descricao="Filtro por Termo Aditivo e Exercício, Totais Finais, exportação com trilha de auditoria."
            rotuloAcao="Abrir relatório"
          />
        )}
        <RelatorioTile
          href="/orcamentario/acompanhamento"
          icone={<IconeAcompanhamento />}
          status="layout"
          titulo="Acompanhamento"
          descricao="Fluxo de caixa consolidado: previsto x realizado por mês."
          rotuloAcao="Abrir relatório"
        />
        <RelatorioTile
          href="/orcamentario/orcado"
          icone={<IconeOrcado />}
          status="layout"
          titulo="Orçado"
          descricao="Árvore de contas de despesa por mês, com quadro de pessoal."
          rotuloAcao="Abrir relatório"
        />
        <RelatorioTile
          href="#premissas-reajustes"
          icone={<IconePremissas />}
          status="pronto"
          titulo="Premissas e Reajustes"
          descricao="Simular e aplicar reajuste em lote sobre a grade de impostos."
          rotuloAcao="Escolher Proposta"
        />
      </div>

      <div
        id="cronograma-desembolso"
        className="max-w-lg scroll-mt-6 rounded-[10px] border border-[#DDE2EA] bg-white shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]"
      >
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

      <div
        id="premissas-reajustes"
        className="max-w-lg scroll-mt-6 rounded-[10px] border border-[#DDE2EA] bg-white shadow-[0_1px_2px_rgba(20,24,33,0.05),0_1px_1px_rgba(20,24,33,0.04)] dark:border-[#2B303C] dark:bg-[#191D26]"
      >
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
