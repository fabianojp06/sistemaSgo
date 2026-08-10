'use client';

import { useMemo, useState, useTransition } from 'react';
import { exportarParaPDF, exportarParaXLSX } from '@/lib/export/exportarRelatorio';
import type { LinhaCronogramaSerializada } from './cronogramaTipos';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string | number): string {
  return formatadorMoeda.format(Number(valor));
}

const formatadorMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
function formatarCompetencia(iso: string): string {
  const texto = formatadorMes.format(new Date(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Ícones minimalistas inline — mesmo padrão do resto do projeto (EmpregadoPanel.tsx, ViagemPanel.tsx).
function IconeCalendario() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}
function IconeMoeda() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.34-2.5 3-2.5s3 1.1 3 2.5-1.34 2-3 2-3 .6-3 2 1.34 2.5 3 2.5 3-1.1 3-2.5" strokeLinecap="round" />
    </svg>
  );
}
function IconeCiclo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconeDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconeImpressora() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path
        d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** US-122/UC04.01 — Cronograma de Desembolso: matriz temporal Somente Leitura, com
 * exportação PDF/XLSX (ADR-037, geração client-side). Cenário 3 (Anexo) fora de escopo.
 * Redesign desta sessão: faixa de KPIs (mesmo padrão de EmpregadoPanel/ViagemPanel),
 * cabeçalho de tabela fixo (sticky), zebra striping, linhas de fechamento anual com
 * destaque visual mais forte, botões de exportação com hierarquia clara (PDF = ação
 * primária em accent, XLSX = secundária). */
export function CronogramaDesembolsoPanel({
  nomeProposta,
  codigoProposta,
  versaoNumero,
  metaNome,
  linhas,
}: {
  nomeProposta: string;
  codigoProposta: string;
  versaoNumero: number;
  metaNome: string | null;
  linhas: LinhaCronogramaSerializada[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const rotuloMeta = metaNome ?? 'Todos'; // RN0250 — nunca dado nulo

  // Rótulos literais do documento de especificação (UC04.01) — usados tanto no
  // cabeçalho da grade em tela quanto na exportação PDF/XLSX, para não haver
  // dois textos diferentes descrevendo a mesma coluna.
  const colunas = [
    { chave: 'evento', rotulo: 'Evento' },
    { chave: 'data', rotulo: 'Data' },
    { chave: 'descricao', rotulo: 'Descrição do Evento' },
    { chave: 'desembolsoMensal', rotulo: 'Desembolso Mensal (R$)' },
    { chave: 'desembolsoAcumulado', rotulo: 'Desembolso Acumulado (R$)' },
    { chave: 'percentualAcumulado', rotulo: '% Financeiro Acumulado (%)' },
    { chave: 'repasse12Meses', rotulo: 'Valor Repassado a cada 12 meses de execução (R$)' },
  ];

  const linhasFormatadas = linhas.map((l) => ({
    evento: `Mês ${l.mes}`,
    data: formatarCompetencia(l.competencia),
    descricao: `Competência ${formatarCompetencia(l.competencia)}`,
    desembolsoMensal: formatarMoeda(l.desembolsoMensal),
    desembolsoAcumulado: formatarMoeda(l.desembolsoAcumulado),
    percentualAcumulado: `${l.percentualFinanceiroAcumulado}%`,
    repasse12Meses: l.valorRepassado12Meses !== null ? formatarMoeda(l.valorRepassado12Meses) : '–',
  }));

  const kpis = useMemo(() => {
    const custoTotal = linhas.length > 0 ? Number(linhas[linhas.length - 1].desembolsoAcumulado) : 0;
    const ciclosFechados = linhas.filter((l) => l.mes % 12 === 0).length;
    return { custoTotal, duracaoMeses: linhas.length, ciclosFechados };
  }, [linhas]);

  function exportarXLSX() {
    setErro(null);
    startTransition(async () => {
      try {
        await exportarParaXLSX({
          nomeArquivo: `cronograma-desembolso-${codigoProposta}`,
          titulo: `CRONOGRAMA DE DESEMBOLSO — ${nomeProposta}`,
          colunas,
          linhas: linhasFormatadas,
        });
      } catch {
        setErro('Não foi possível gerar o arquivo XLSX.');
      }
    });
  }

  function imprimir() {
    window.print();
  }

  function exportarPDF() {
    setErro(null);
    try {
      exportarParaPDF({
        nomeArquivo: `cronograma-desembolso-${codigoProposta}`,
        titulo: 'CRONOGRAMA DE DESEMBOLSO',
        subtitulo: `${nomeProposta} — Meta: ${rotuloMeta} — Versão ${versaoNumero}`,
        colunas,
        linhas: linhasFormatadas,
        rodape: 'CRONOGRAMA DE DESEMBOLSO',
      });
    } catch {
      setErro('Não foi possível gerar o arquivo PDF.');
    }
  }

  if (linhas.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#DDE2EA] bg-white p-6 text-sm text-[#5B6270] shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6]">
        Operação Rejeitada: A Proposta selecionada não possui dados financeiros cadastrados para consolidação.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-[#F7F8FA] p-4 dark:bg-[#12151C] md:p-6 print:bg-white print:p-0 print:text-black">
      {/* Cabeçalho impresso — título centralizado fixo, só existe na versão para impressão/PDF (cabeçalho do documento, RN0259/layout do relatório). */}
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">Cronograma de Desembolso</h1>

      {/* Cabeçalho: identificação da Proposta + ações de exportação/impressão */}
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Cronograma de Desembolso</h2>
          <p className="mt-0.5 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
            <span className="font-mono text-xs text-[#8A8F98] dark:text-[#767C89]">{codigoProposta}</span> {nomeProposta}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={imprimir}
            className="flex items-center gap-1.5 rounded-[7px] border border-[#DDE2EA] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6270] shadow-sm hover:bg-[#EEF1F6] dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6] dark:hover:bg-[#1F2430]"
          >
            <IconeImpressora />
            Imprimir
          </button>
          <button
            type="button"
            onClick={exportarXLSX}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-[7px] border border-[#DDE2EA] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6270] shadow-sm hover:bg-[#EEF1F6] disabled:opacity-50 dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6] dark:hover:bg-[#1F2430]"
          >
            <IconeDownload />
            {pending ? 'Gerando...' : 'XLSX'}
          </button>
          <button
            type="button"
            onClick={exportarPDF}
            className="flex items-center gap-1.5 rounded-[7px] bg-[#2B5FD9] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 dark:bg-[#6D93F0] dark:text-[#12151C]"
          >
            <IconeDownload />
            PDF
          </button>
        </div>
      </div>

      {erro && <p className="text-xs text-[#C43D3D] dark:text-[#E0716B] print:hidden">{erro}</p>}

      {/* Painel de Filtros Aplicados (RN0200/RN0250) — rótulo + valor por item, sempre visível (tela e impressão). */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg border border-[#DDE2EA] bg-white px-4 py-3 text-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:border-b print:border-black print:px-0 print:py-2">
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Termo de Parceria:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">
            {codigoProposta} — {nomeProposta}
          </span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Meta:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{rotuloMeta}</span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Versão do TP:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{versaoNumero}</span>
        </span>
      </div>

      {/* Faixa de KPIs — mesmo padrão de EmpregadoPanel/ViagemPanel; não faz parte do documento oficial, só da tela. */}
      <div className="rounded-xl bg-slate-900 p-5 shadow-md md:p-6 print:hidden">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeMoeda />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Custo Total do Cronograma</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{formatarMoeda(kpis.custoTotal)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeCalendario />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Duração da Vigência</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{kpis.duracaoMeses} meses</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeCiclo />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Ciclos Anuais Fechados</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{kpis.ciclosFechados}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Matriz temporal — Somente Leitura */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="max-h-[560px] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs print:min-w-0">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6] print:static print:bg-white print:text-black">
              <tr>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Evento</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Descrição do Evento</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Desembolso Mensal (R$)</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Desembolso Acumulado (R$)</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">% Financeiro Acumulado (%)</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Valor Repassado a cada 12 meses de execução (R$)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, indice) => {
                const fechamentoAno = l.mes % 12 === 0;
                const percentual = Number(l.percentualFinanceiroAcumulado);
                return (
                  <tr
                    key={l.mes}
                    className={
                      fechamentoAno
                        ? 'border-y-2 border-[#2B5FD9]/30 bg-[#E8EEFC] font-semibold dark:border-[#6D93F0]/30 dark:bg-[#1D2A48]'
                        : `border-b border-gray-100 dark:border-[#2B303C] ${indice % 2 === 1 ? 'bg-slate-50/60 dark:bg-white/[0.02]' : ''}`
                    }
                  >
                    <td className="px-3 py-2 tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">Mês {l.mes}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap text-[#5B6270] dark:text-[#A4AAB6]">
                      {formatarCompetencia(l.competencia)}
                    </td>
                    <td className="px-3 py-2 text-[#5B6270] dark:text-[#A4AAB6]">Competência {formatarCompetencia(l.competencia)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {formatarMoeda(l.desembolsoMensal)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {formatarMoeda(l.desembolsoAcumulado)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-[#2B303C]">
                          <div
                            className="h-full rounded-full bg-[#2B5FD9] dark:bg-[#6D93F0]"
                            style={{ width: `${Math.min(percentual, 100)}%` }}
                          />
                        </div>
                        <span className="text-[#1A1F29] dark:text-[#EBEDF2]">{l.percentualFinanceiroAcumulado}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {l.valorRepassado12Meses !== null ? formatarMoeda(l.valorRepassado12Meses) : <span className="text-[#8A8F98] dark:text-[#767C89]">–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-[#8A8F98] dark:text-[#767C89] print:hidden">
        Linhas destacadas em azul marcam o fechamento de cada ciclo de 12 meses (RN0254).
      </p>
      {/* Rodapé do documento impresso — título unificado fixo, conforme layout do relatório. */}
      <p className="hidden text-center text-[10px] uppercase print:block">Cronograma de Desembolso</p>
    </div>
  );
}
