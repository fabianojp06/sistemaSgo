'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { exportarParaPDF, exportarParaXLSX, type LinhaRelatorio } from '@/lib/export/exportarRelatorio';
import type { CronogramaParceladoSerializado } from './cronogramaTipos';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string | number): string {
  return formatadorMoeda.format(Number(valor));
}

const formatadorMesExtenso = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
function formatarDataExtenso(iso: string): string {
  return formatadorMesExtenso.format(new Date(iso)); // "janeiro 2026"
}

function anoDe(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

// Ícones minimalistas inline — mesmo padrão do resto do projeto.
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

const COLUNAS = [
  { chave: 'evento', rotulo: 'Evento' },
  { chave: 'data', rotulo: 'Data' },
  { chave: 'descricao', rotulo: 'Descrição do Evento' },
  { chave: 'desembolsoMensal', rotulo: 'Desembolso Mensal (R$)' },
  { chave: 'desembolsoAcumulado', rotulo: 'Desembolso Acumulado (R$)' },
  { chave: 'percentualAcumulado', rotulo: '% Financeiro Acumulado' },
  { chave: 'valorAcumuladoAno', rotulo: 'Valor Acumulado por Ano do Termo de Parceria (R$)' },
];

/**
 * US-142 / ADR-049 — Cronograma de Desembolso por parcelas, layout ANEXO 9.
 * Tela Somente Leitura na guia da Proposta. Reaproveita a faixa de KPIs, o painel
 * de filtros aplicados, os botões de exportação (PDF/XLSX client-side, ADR-037) e
 * o estado de bloqueio "sem dados financeiros" da versão anterior (US-122).
 *
 * Filtro de período: puramente visual (client-side) — esconde parcelas fora do
 * intervalo mas NÃO recalcula Desembolso Acumulado / %. Quando ativo, exibe a nota
 * de que Acumulado e % se referem ao cronograma completo.
 */
export function CronogramaDesembolsoPanel({
  nomeProposta,
  codigoProposta,
  versaoNumero,
  metaNome,
  cronograma,
  calendarioConfigurado,
}: {
  nomeProposta: string;
  codigoProposta: string;
  versaoNumero: number;
  metaNome: string | null;
  cronograma: CronogramaParceladoSerializado | null;
  calendarioConfigurado: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const rotuloMeta = metaNome ?? 'Todos'; // RN0250 — nunca dado nulo

  const parcelas = cronograma?.parcelas ?? [];
  const subtotais = cronograma?.subtotaisAnuais ?? [];

  const filtroAtivo = de !== '' || ate !== '';
  const parcelasVisiveis = useMemo(() => {
    if (!filtroAtivo) return parcelas;
    const deMs = de ? new Date(de).getTime() : -Infinity;
    const ateMs = ate ? new Date(ate).getTime() : Infinity;
    return parcelas.filter((p) => {
      const t = new Date(p.data).getTime();
      return t >= deMs && t <= ateMs;
    });
  }, [parcelas, de, ate, filtroAtivo]);

  const anosDoTP = useMemo(() => subtotais.map((s) => s.ano), [subtotais]);
  const rotuloAnos =
    anosDoTP.length === 0
      ? '—'
      : anosDoTP.length === 1
        ? `ANO ${anosDoTP[0]}`
        : `ANOS ${anosDoTP.slice(0, -1).join(', ')} E ${anosDoTP[anosDoTP.length - 1]}`;

  const kpis = useMemo(() => {
    const valorGlobal = cronograma ? Number(cronograma.valorGlobal) : 0;
    return { valorGlobal, numParcelas: parcelas.length, anos: anosDoTP.length };
  }, [cronograma, parcelas.length, anosDoTP.length]);

  // Linhas para exportação — parcela + sub-linha + subtotal anual + total geral.
  const linhasExport: LinhaRelatorio[] = useMemo(() => {
    const out: LinhaRelatorio[] = [];
    for (let i = 0; i < parcelas.length; i++) {
      const p = parcelas[i];
      out.push({
        estiloLinha: 'normal',
        evento: `Evento T${p.numero}`,
        data: formatarDataExtenso(p.data),
        descricao: p.descricao,
        desembolsoMensal: formatarMoeda(p.desembolso),
        desembolsoAcumulado: formatarMoeda(p.desembolsoAcumulado),
        percentualAcumulado: `${p.percentualFinanceiroAcumulado}%`,
        valorAcumuladoAno: '',
      });
      for (const sub of p.subLinhas) {
        out.push({
          estiloLinha: 'subitem',
          evento: '',
          data: '',
          descricao: sub.rotulo,
          desembolsoMensal: formatarMoeda(sub.valor),
          desembolsoAcumulado: '',
          percentualAcumulado: '',
          valorAcumuladoAno: '',
        });
      }
      const proxima = parcelas[i + 1];
      const fimDeAno = !proxima || anoDe(proxima.data) !== anoDe(p.data);
      if (fimDeAno) {
        const st = subtotais.find((s) => s.ano === anoDe(p.data));
        if (st) {
          out.push({
            estiloLinha: 'subtotal',
            evento: `ANO ${st.ano}`,
            data: '',
            descricao: `TOTAL A DESEMBOLSAR EM ${st.ano}`,
            desembolsoMensal: formatarMoeda(st.totalDoAno),
            desembolsoAcumulado: formatarMoeda(st.desembolsoAcumulado),
            percentualAcumulado: `${st.percentualFinanceiroAcumulado}%`,
            valorAcumuladoAno: formatarMoeda(st.valorAcumuladoPorAnoDoTP),
          });
        }
      }
    }
    if (cronograma && parcelas.length > 0) {
      out.push({
        estiloLinha: 'total',
        evento: rotuloAnos,
        data: '',
        descricao: 'TOTAL A DESEMBOLSAR NO TERMO DE PARCERIA',
        desembolsoMensal: formatarMoeda(cronograma.totalGeral),
        desembolsoAcumulado: formatarMoeda(cronograma.totalGeral),
        percentualAcumulado: '100,00%',
        valorAcumuladoAno: formatarMoeda(cronograma.totalGeral),
      });
    }
    return out;
  }, [parcelas, subtotais, cronograma, rotuloAnos]);

  function exportarXLSX() {
    setErro(null);
    startTransition(async () => {
      try {
        await exportarParaXLSX({
          nomeArquivo: `cronograma-desembolso-${codigoProposta}`,
          titulo: `ANEXO 9 — CRONOGRAMA DE DESEMBOLSO — ${nomeProposta}`,
          colunas: COLUNAS,
          linhas: linhasExport,
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
        titulo: 'ANEXO 9 — CRONOGRAMA DE DESEMBOLSO',
        subtitulo: `${nomeProposta} — Meta: ${rotuloMeta} — Versão ${versaoNumero}`,
        colunas: COLUNAS,
        linhas: linhasExport,
        rodape: 'ANEXO 9 — CRONOGRAMA DE DESEMBOLSO',
      });
    } catch {
      setErro('Não foi possível gerar o arquivo PDF.');
    }
  }

  // Cenário 4 (US-122) — Proposta sem dados financeiros bloqueia a grade inteira.
  if (!cronograma || parcelas.length === 0) {
    return (
      <div className="rounded-[10px] border border-[#DDE2EA] bg-white p-6 text-sm text-[#5B6270] shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6]">
        Operação Rejeitada: A Proposta selecionada não possui dados financeiros cadastrados para consolidação.
      </div>
    );
  }

  const celulaNum = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-[#F7F8FA] p-4 dark:bg-[#12151C] md:p-6 print:bg-white print:p-0 print:text-black">
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">
        Anexo 9 — Cronograma de Desembolso
      </h1>

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

      {!calendarioConfigurado && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 print:hidden">
          Calendário de repasse não configurado nesta Proposta — usando o padrão de 3 parcelas por ano a partir de janeiro.
          Configure na capa da Proposta para refletir o Termo de Parceria.
        </p>
      )}

      {/* Filtros Aplicados (RN0200/RN0250) */}
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

      {/* Filtro de período — client-side, apenas exibição */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#DDE2EA] bg-white px-4 py-3 text-sm dark:border-[#2B303C] dark:bg-[#191D26] print:hidden">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#8A8F98] dark:text-[#767C89]">Exibir a partir de</span>
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="rounded-[6px] border border-[#DDE2EA] bg-white px-2 py-1 text-xs dark:border-[#2B303C] dark:bg-[#12151C]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[#8A8F98] dark:text-[#767C89]">até</span>
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="rounded-[6px] border border-[#DDE2EA] bg-white px-2 py-1 text-xs dark:border-[#2B303C] dark:bg-[#12151C]"
          />
        </label>
        {filtroAtivo && (
          <button
            type="button"
            onClick={() => {
              setDe('');
              setAte('');
            }}
            className="rounded-[6px] border border-[#DDE2EA] px-2 py-1 text-xs text-[#5B6270] hover:bg-[#EEF1F6] dark:border-[#2B303C] dark:text-[#A4AAB6]"
          >
            Limpar
          </button>
        )}
      </div>

      {filtroAtivo && (
        <p className="text-[11px] text-[#8A8F98] dark:text-[#767C89]">
          Filtro de período ativo — os valores de <strong>Desembolso Acumulado</strong> e <strong>% Financeiro Acumulado</strong>{' '}
          referem-se ao cronograma completo, não ao intervalo exibido.
        </p>
      )}

      {/* Faixa de KPIs */}
      <div className="rounded-xl bg-slate-900 p-5 shadow-md md:p-6 print:hidden">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeMoeda />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Valor Global do Termo de Parceria</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{formatarMoeda(kpis.valorGlobal)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeCalendario />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Nº de Parcelas</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{kpis.numParcelas}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-slate-400">
              <IconeCiclo />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400">Anos do Termo de Parceria</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-400">{kpis.anos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela ANEXO 9 */}
      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="max-h-[560px] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs print:min-w-0">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6] print:static print:bg-white print:text-black">
              <tr>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Evento</th>
                <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2.5 font-semibold">Descrição do Evento</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Desembolso Mensal (R$)</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Desembolso Acumulado (R$)</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">% Financeiro Acumulado</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  Valor Acumulado por Ano do Termo de Parceria (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {parcelasVisiveis.map((p, indice) => {
                const proxima = parcelasVisiveis[indice + 1];
                const fimDeAno = !filtroAtivo && (!proxima || anoDe(proxima.data) !== anoDe(p.data));
                const st = fimDeAno ? subtotais.find((s) => s.ano === anoDe(p.data)) : undefined;
                return (
                  <FragmentoParcela key={p.numero}>
                    <tr className="border-b border-gray-100 dark:border-[#2B303C]">
                      <td className="px-3 py-2 tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">Evento T{p.numero}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-[#5B6270] capitalize dark:text-[#A4AAB6]">
                        {formatarDataExtenso(p.data)}
                      </td>
                      <td className="px-3 py-2 text-[#5B6270] dark:text-[#A4AAB6]">{p.descricao}</td>
                      <td className={`${celulaNum} text-[#1A1F29] dark:text-[#EBEDF2]`}>{formatarMoeda(p.desembolso)}</td>
                      <td className={`${celulaNum} text-[#1A1F29] dark:text-[#EBEDF2]`}>
                        {formatarMoeda(p.desembolsoAcumulado)}
                      </td>
                      <td className={`${celulaNum} text-[#1A1F29] dark:text-[#EBEDF2]`}>
                        {p.percentualFinanceiroAcumulado}%
                      </td>
                      <td className={celulaNum} />
                    </tr>
                    {p.subLinhas.map((sub) => (
                      <tr key={sub.rotulo} className="border-b border-gray-100 text-[#5B6270] italic dark:border-[#2B303C] dark:text-[#A4AAB6]">
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5 pl-6">{sub.rotulo}</td>
                        <td className={celulaNum}>{formatarMoeda(sub.valor)}</td>
                        <td className={celulaNum} />
                        <td className={celulaNum} />
                        <td className={celulaNum} />
                      </tr>
                    ))}
                    {st && (
                      <tr className="border-y-2 border-[#2B5FD9]/30 bg-[#E8EEFC] font-semibold dark:border-[#6D93F0]/30 dark:bg-[#1D2A48]">
                        <td className="px-3 py-2 whitespace-nowrap">ANO {st.ano}</td>
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2 uppercase">Total a desembolsar em {st.ano}</td>
                        <td className={celulaNum}>{formatarMoeda(st.totalDoAno)}</td>
                        <td className={celulaNum}>{formatarMoeda(st.desembolsoAcumulado)}</td>
                        <td className={celulaNum}>{st.percentualFinanceiroAcumulado}%</td>
                        <td className={celulaNum}>{formatarMoeda(st.valorAcumuladoPorAnoDoTP)}</td>
                      </tr>
                    )}
                  </FragmentoParcela>
                );
              })}
              {!filtroAtivo && (
                <tr className="border-y-2 border-[#2B5FD9]/50 bg-[#D9E2F3] font-bold dark:border-[#6D93F0]/50 dark:bg-[#243657]">
                  <td className="px-3 py-2.5 whitespace-nowrap">{rotuloAnos}</td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 uppercase">Total a desembolsar no Termo de Parceria</td>
                  <td className={celulaNum}>{formatarMoeda(cronograma.totalGeral)}</td>
                  <td className={celulaNum}>{formatarMoeda(cronograma.totalGeral)}</td>
                  <td className={celulaNum}>100,00%</td>
                  <td className={celulaNum}>{formatarMoeda(cronograma.totalGeral)}</td>
                </tr>
              )}
              {parcelasVisiveis.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[#8A8F98] dark:text-[#767C89]">
                    Nenhuma parcela no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[#8A8F98] dark:text-[#767C89] print:hidden">
        Linhas em azul marcam o fechamento de cada ano civil e o total geral do Termo de Parceria. O resíduo de
        arredondamento é absorvido pela última parcela (RN_CD_002).
      </p>
      <p className="hidden text-center text-[10px] uppercase print:block">Anexo 9 — Cronograma de Desembolso</p>
    </div>
  );
}

function FragmentoParcela({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
