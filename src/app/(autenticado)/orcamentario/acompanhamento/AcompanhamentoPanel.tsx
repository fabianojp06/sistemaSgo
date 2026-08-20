'use client';

import { Fragment } from 'react';
import { mesesMock, resumoTopoMock, linhasDespesaMock, totalGeralMock, resumoRodapeMock } from './mockData';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: number): string {
  return formatadorMoeda.format(valor);
}

/**
 * [LAYOUT — placeholder, sem regra de negócio ainda] "Acompanhamento", novo
 * relatório do Módulo Orçamentário (EP48/26), baseado na aba "ACOMP" de
 * src/application/use-cases/plano-contas/MODELO.xlsx. Título do documento
 * reproduz o literal da planilha original: "DEMONSTRATIVO DE RECEITAS E
 * DESPESAS SINTÉTICO - FLUXO DE CAIXA CONSOLIDADO". Dado 100% mock
 * (mockData.ts) — trocar por dado real quando a US formal (regras de
 * negócio, caso de uso, critérios de aceite) existir. Sem exportação PDF/XLSX
 * ainda, só Imprimir (CSS de impressão no mesmo padrão dos outros relatórios
 * do módulo).
 */
export function AcompanhamentoPanel() {
  function imprimir() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 dark:bg-[#191D26] md:p-6 print:bg-white print:p-0 print:text-black">
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">
        Demonstrativo de Receitas e Despesas Sintético — Fluxo de Caixa Consolidado
      </h1>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">
            Demonstrativo de Receitas e Despesas Sintético — Fluxo de Caixa Consolidado
          </h2>
          <p className="mt-0.5 text-sm text-[#5B6270] dark:text-[#A4AAB6]">Acompanhamento — período de exemplo (layout)</p>
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

      {/* Bloco de resumo (topo) */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6]">
              <tr>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Indicador</th>
                {mesesMock.map((mes) => (
                  <th key={mes} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {mes}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resumoTopoMock.map((linha, indice) => (
                <tr
                  key={linha.label}
                  className={`border-b border-gray-100 dark:border-[#2B303C] ${indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`}
                >
                  <td className="px-3 py-2 font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{linha.label}</td>
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

      {/* Tabela principal — por Elemento de Despesa, 3 subcolunas por mês */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:shadow-none">
        <div className="max-h-[560px] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full min-w-[1200px] border-collapse text-left text-xs print:min-w-0">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6] print:static print:bg-white print:text-black">
              <tr>
                <th rowSpan={2} className="px-3 py-2.5 align-bottom font-semibold whitespace-nowrap">
                  Código
                </th>
                <th rowSpan={2} className="px-3 py-2.5 align-bottom font-semibold whitespace-nowrap">
                  Elemento de Despesa
                </th>
                {mesesMock.map((mes) => (
                  <th key={mes} colSpan={3} className="border-l border-gray-200 px-3 py-2 text-center font-semibold whitespace-nowrap dark:border-[#2B303C]">
                    {mes}
                  </th>
                ))}
              </tr>
              <tr>
                {mesesMock.map((mes) => (
                  <Fragment key={mes}>
                    <th className="border-l border-gray-200 px-3 py-2 text-right font-medium whitespace-nowrap dark:border-[#2B303C]">
                      Previsto
                    </th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Realizado</th>
                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Saldo Acumulado</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasDespesaMock.map((linha, indice) => (
                <tr
                  key={linha.codigo}
                  className={`border-b border-gray-100 dark:border-[#2B303C] ${indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`}
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-[#8A8F98] dark:text-[#767C89]">{linha.codigo}</td>
                  <td className="px-3 py-2 text-[#1A1F29] dark:text-[#EBEDF2]">{linha.nome}</td>
                  {linha.valoresPorMes.map((valores, i) => (
                    <Fragment key={i}>
                      <td className="border-l border-gray-100 px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:border-[#2B303C] dark:text-[#EBEDF2]">
                        {formatarMoeda(valores.previsto)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">{formatarMoeda(valores.realizado)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">{formatarMoeda(valores.saldoAcumulado)}</td>
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#1A1F29] bg-slate-100 font-semibold dark:border-[#EBEDF2] dark:bg-[#1F2430]">
                <td className="px-3 py-2.5" colSpan={2}>
                  Total Geral
                </td>
                {totalGeralMock.map((valores, i) => (
                  <Fragment key={i}>
                    <td className="border-l border-gray-200 px-3 py-2.5 text-right tabular-nums text-[#1A1F29] dark:border-[#2B303C] dark:text-[#EBEDF2]">
                      {formatarMoeda(valores.previsto)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">{formatarMoeda(valores.realizado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">{formatarMoeda(valores.saldoAcumulado)}</td>
                  </Fragment>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bloco de resumo (rodapé) */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <tbody>
              {resumoRodapeMock.map((linha, indice) => (
                <tr
                  key={linha.label}
                  className={`border-b border-gray-100 dark:border-[#2B303C] ${indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`}
                >
                  <td className="px-3 py-2 font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{linha.label}</td>
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

      <p className="hidden text-center text-[10px] uppercase print:block">
        Demonstrativo de Receitas e Despesas Sintético — Fluxo de Caixa Consolidado
      </p>
    </div>
  );
}
