'use client';

import { useState, useTransition } from 'react';
import { exportarParaPDF, exportarParaXLSX } from '@/lib/export/exportarRelatorio';
import type { LinhaCronogramaSerializada } from '../../propostas/cronogramaTipos';
import { registrarExportacaoCronogramaAction } from './actions';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function formatarMoeda(valor: string | number): string {
  return formatadorMoeda.format(Number(valor));
}

const formatadorMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
function formatarCompetencia(iso: string): string {
  const texto = formatadorMes.format(new Date(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const colunas = [
  { chave: 'evento', rotulo: 'Evento' },
  { chave: 'data', rotulo: 'Data' },
  { chave: 'descricao', rotulo: 'Descrição do Evento' },
  { chave: 'desembolsoMensal', rotulo: 'Desembolso Mensal (R$)' },
  { chave: 'desembolsoAcumulado', rotulo: 'Desembolso Acumulado (R$)' },
  { chave: 'percentualAcumulado', rotulo: '% Financeiro Acumulado (%)' },
  { chave: 'repasse12Meses', rotulo: 'Valor Repassado a cada 12 meses de execução (R$)' },
];

/**
 * US-138 (relatório formal de Cronograma de Desembolso) — variante da aba
 * US-122 (CronogramaDesembolsoPanel.tsx) com Linha de Totais Finais (Cenário
 * 5) e exportação auditada: a Server Action grava HistoricoOperacao ANTES de
 * o arquivo ser gerado; se a auditoria falhar, o download é bloqueado
 * (Cenário 8) — diferença deliberada frente à aba US-122, que não audita.
 */
export function RelatorioCronogramaDesembolsoPanel({
  codigoProposta,
  nomeProposta,
  termoAditivoLabel,
  termoAditivoId,
  anoExercicio,
  linhas,
}: {
  propostaId: string;
  codigoProposta: string;
  nomeProposta: string;
  termoAditivoLabel: string | null;
  termoAditivoId: string | null;
  anoExercicio: number | null;
  linhas: LinhaCronogramaSerializada[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const linhasFormatadas = linhas.map((l) => ({
    evento: `Mês ${l.mes}`,
    data: formatarCompetencia(l.competencia),
    descricao: `Competência ${formatarCompetencia(l.competencia)}`,
    desembolsoMensal: formatarMoeda(l.desembolsoMensal),
    desembolsoAcumulado: formatarMoeda(l.desembolsoAcumulado),
    percentualAcumulado: `${l.percentualFinanceiroAcumulado}%`,
    repasse12Meses: l.valorRepassado12Meses !== null ? formatarMoeda(l.valorRepassado12Meses) : '–',
  }));

  // Cenário 5 — Linha de Totais Finais: soma vertical do Desembolso Mensal,
  // Desembolso Acumulado final (= custo total do cronograma no recorte
  // filtrado) e 100,00% em % Financeiro Acumulado quando o recorte cobre até
  // o último mês da vigência (senão, reflete o % real do trecho filtrado).
  const totalMensal = linhas.reduce((acc, l) => acc + Number(l.desembolsoMensal), 0);
  const ultimaLinha = linhas[linhas.length - 1];

  async function gravarAuditoriaEEntao(formato: 'PDF' | 'XLSX' | 'IMPRESSAO', depois: () => void) {
    setErro(null);
    startTransition(async () => {
      const resultado = await registrarExportacaoCronogramaAction({
        propostaCodigo: codigoProposta,
        propostaNome: nomeProposta,
        formato,
        termoAditivoId,
        anoExercicio,
      });
      if (!resultado.sucesso) {
        setErro(resultado.mensagem);
        return;
      }
      depois();
    });
  }

  function imprimir() {
    gravarAuditoriaEEntao('IMPRESSAO', () => window.print());
  }

  function exportarXLSX() {
    gravarAuditoriaEEntao('XLSX', () => {
      exportarParaXLSX({
        nomeArquivo: `relatorio-cronograma-desembolso-${codigoProposta}`,
        titulo: `CRONOGRAMA DE DESEMBOLSO — ${nomeProposta}`,
        colunas,
        linhas: linhasFormatadas,
      }).catch(() => setErro('Não foi possível gerar o arquivo XLSX.'));
    });
  }

  function exportarPDF() {
    gravarAuditoriaEEntao('PDF', () => {
      try {
        exportarParaPDF({
          nomeArquivo: `relatorio-cronograma-desembolso-${codigoProposta}`,
          titulo: 'CRONOGRAMA DE DESEMBOLSO',
          subtitulo: `${nomeProposta} — Termo Aditivo: ${termoAditivoLabel ?? 'Todos'}${anoExercicio ? ` — Exercício ${anoExercicio}` : ''}`,
          colunas,
          linhas: linhasFormatadas,
          rodape: 'CRONOGRAMA DE DESEMBOLSO',
        });
      } catch {
        setErro('Não foi possível gerar o arquivo PDF.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 dark:bg-[#191D26] md:p-6 print:bg-white print:p-0 print:text-black">
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">Cronograma de Desembolso</h1>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">Cronograma de Desembolso — Relatório</h2>
          <p className="mt-0.5 text-sm text-[#5B6270] dark:text-[#A4AAB6]">
            <span className="font-mono text-xs text-[#8A8F98] dark:text-[#767C89]">{codigoProposta}</span> {nomeProposta}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={imprimir}
            disabled={pending}
            className="rounded-[7px] border border-[#DDE2EA] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6270] shadow-sm hover:bg-[#EEF1F6] disabled:opacity-50 dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6]"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={exportarXLSX}
            disabled={pending}
            className="rounded-[7px] border border-[#DDE2EA] bg-white px-3 py-1.5 text-xs font-medium text-[#5B6270] shadow-sm hover:bg-[#EEF1F6] disabled:opacity-50 dark:border-[#2B303C] dark:bg-[#191D26] dark:text-[#A4AAB6]"
          >
            {pending ? 'Gerando...' : 'XLSX'}
          </button>
          <button
            type="button"
            onClick={exportarPDF}
            disabled={pending}
            className="rounded-[7px] bg-[#2B5FD9] px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50 dark:bg-[#6D93F0] dark:text-[#12151C]"
          >
            PDF
          </button>
        </div>
      </div>

      {erro && <p className="text-xs text-[#C43D3D] dark:text-[#E0716B] print:hidden">{erro}</p>}

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg border border-[#DDE2EA] bg-white px-4 py-3 text-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:border-b print:border-black print:px-0 print:py-2">
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Termo de Parceria:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">
            {codigoProposta} — {nomeProposta}
          </span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Termo Aditivo:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{termoAditivoLabel ?? 'Todos'}</span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Exercício:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{anoExercicio ?? 'Toda a vigência'}</span>
        </span>
      </div>

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
                    <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {l.percentualFinanceiroAcumulado}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                      {l.valorRepassado12Meses !== null ? formatarMoeda(l.valorRepassado12Meses) : <span className="text-[#8A8F98] dark:text-[#767C89]">–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Cenário 5 — Linha de Totais Finais, exclusiva do relatório US-138 (a aba
                US-122 não tem essa linha). */}
            <tfoot>
              <tr className="border-t-2 border-[#1A1F29] bg-slate-100 font-semibold dark:border-[#EBEDF2] dark:bg-[#1F2430]">
                <td className="px-3 py-2.5 text-[#1A1F29] dark:text-[#EBEDF2]" colSpan={3}>
                  Totais
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">{formatarMoeda(totalMensal)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                  {ultimaLinha ? formatarMoeda(ultimaLinha.desembolsoAcumulado) : formatarMoeda(0)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">
                  {ultimaLinha ? `${ultimaLinha.percentualFinanceiroAcumulado}%` : '0,00%'}
                </td>
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-[#8A8F98] dark:text-[#767C89] print:hidden">
        Linhas destacadas em azul marcam o fechamento de cada ciclo de 12 meses. Relatório gerado em {new Date().toLocaleString('pt-BR')}.
      </p>
      <p className="hidden text-center text-[10px] uppercase print:block">
        Cronograma de Desembolso — gerado em {new Date().toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
