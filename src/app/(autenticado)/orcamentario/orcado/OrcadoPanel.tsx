'use client';

import { colunasMock, headcountMock, linhasOrcadoMock } from './mockData';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor);
}

const formatadorNumero = new Intl.NumberFormat('pt-BR');

const indentacaoPorNivel: Record<number, string> = {
  1: 'pl-3',
  2: 'pl-6',
  3: 'pl-10',
};

/**
 * [LAYOUT — placeholder, sem regra de negócio ainda] "Orçado", novo relatório
 * do Módulo Orçamentário (EP48/26), baseado na aba "ORÇADO" de
 * src/application/use-cases/plano-contas/MODELO.xlsx: árvore de contas de
 * despesa (Despesas > Elemento > item analítico) por mês, com headcount no
 * topo. Dado 100% mock (mockData.ts) — a planilha original tem ~219 linhas
 * de conta e vários anos de vigência; este mock reproduz só um recorte
 * representativo. Sem exportação PDF/XLSX ainda, só Imprimir.
 */
export function OrcadoPanel() {
  function imprimir() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 dark:bg-[#191D26] md:p-6 print:bg-white print:p-0 print:text-black">
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">Orçado</h1>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Orçado</h2>
          <p className="mt-0.5 text-sm text-[#5B6270] dark:text-[#A4AAB6]">Árvore de contas por mês — período de exemplo (layout)</p>
        </div>
        <button
          type="button"
          onClick={imprimir}
          className="rounded-[7px] border border-[#DDE2EA] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6270] shadow-sm hover:bg-[#EEF1F6] dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6]"
        >
          Imprimir
        </button>
      </div>

      <p className="rounded-lg border border-dashed border-[#DDE2EA] bg-[#F7F8FA] px-4 py-2 text-xs text-[#8A8F98] dark:border-[#2B303C] dark:bg-[#12151C] dark:text-[#767C89] print:hidden">
        Layout de referência — números de exemplo (mock), sem cálculo real. Regras de negócio, filtros e caso de uso ainda serão definidos.
      </p>

      {/* Headcount */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6]">
              <tr>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Quadro de Pessoal</th>
                {colunasMock.map((coluna) => (
                  <th key={coluna} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {headcountMock.map((linha, indice) => (
                <tr
                  key={linha.label}
                  className={`border-b border-gray-100 dark:border-[#2B303C] ${indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`}
                >
                  <td className="px-3 py-2 font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{linha.label}</td>
                  {linha.valores.map((valor, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {formatadorNumero.format(valor)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Árvore de contas de despesa */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:shadow-none">
        <div className="max-h-[560px] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full min-w-[1000px] border-collapse text-left text-xs print:min-w-0">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6] print:static print:bg-white print:text-black">
              <tr>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Código</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Conta</th>
                {colunasMock.map((coluna) => (
                  <th key={coluna} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {coluna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasOrcadoMock.map((linha, indice) => (
                <tr
                  key={linha.codigo ?? indice}
                  className={
                    linha.negrito
                      ? 'border-y border-[#DDE2EA] bg-slate-50 font-semibold dark:border-[#2B303C] dark:bg-[#1F2430]'
                      : `border-b border-gray-100 dark:border-[#2B303C] ${indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`
                  }
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-[#8A8F98] dark:text-[#767C89]">{linha.codigo}</td>
                  <td className={`py-2 pr-3 text-[#1A1F29] dark:text-[#EBEDF2] ${indentacaoPorNivel[linha.nivel]}`}>{linha.nome}</td>
                  {linha.valoresPorMes.map((valor, i) => (
                    <td key={i} className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {formatarMoeda(valor)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="hidden text-center text-[10px] uppercase print:block">Orçado</p>
    </div>
  );
}
