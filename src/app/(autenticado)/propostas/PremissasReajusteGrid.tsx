'use client';

import { useMemo, useState } from 'react';
import { exportarParaPDF, exportarParaXLSX } from '@/lib/export/exportarRelatorio';
import type { LinhaPremissaSerializada } from './premissasReajusteTipos';

const formatadorPct = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const formatadorMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' });

function formatarCelula(celula: LinhaPremissaSerializada['celulas'][number]): string {
  if (celula.tag === 'REALIZADO') return 'Realizado';
  if (celula.tag === 'PROJETADO') return `${formatadorPct.format(Number(celula.aliquotaPct))}%`;
  return '—';
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
function IconeDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LABEL_BLOCO: Record<'CONTRATOS' | 'PARCERIA_ACT', string> = {
  CONTRATOS: 'dos Contratos',
  PARCERIA_ACT: 'da Parceria (ACT)',
};

/**
 * US-128/UC04.02 [ADR-040] — grade de Premissas / Aplicações de Reajuste.
 * Somente leitura [ORIGEM BLINDADA] — nenhuma célula é editável, por design (Cenário 7:
 * não há input algum na grid, o bloqueio é passivo, sem mensagem de erro).
 */
export function PremissasReajusteGrid({
  nomeProposta,
  codigoProposta,
  versaoNumero,
  linhas,
}: {
  nomeProposta: string;
  codigoProposta: string;
  versaoNumero: number;
  linhas: LinhaPremissaSerializada[];
}) {
  const [exibirContasZeradas, setExibirContasZeradas] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const competencias = linhas[0]?.celulas.map((c) => c.competencia) ?? [];

  const linhasVisiveis = useMemo(
    () => linhas.filter((l) => exibirContasZeradas || l.temIndice),
    [linhas, exibirContasZeradas],
  );

  const blocos: ('CONTRATOS' | 'PARCERIA_ACT')[] = ['CONTRATOS', 'PARCERIA_ACT'];

  function linhasExport() {
    return linhasVisiveis.flatMap((linha) =>
      linha.blocos.map((bloco) => ({
        bloco: LABEL_BLOCO[bloco],
        conta: linha.contaLabel,
        ...Object.fromEntries(
          linha.celulas.map((c, i) => [`mes_${i}`, linha.temIndice ? formatarCelula(c) : '0,00%']),
        ),
      })),
    );
  }

  function colunasExport() {
    return [
      { chave: 'bloco', rotulo: 'Bloco' },
      { chave: 'conta', rotulo: 'Conta Analítica' },
      ...competencias.map((comp, i) => ({ chave: `mes_${i}`, rotulo: formatadorMes.format(new Date(comp)) })),
    ];
  }

  function imprimir() {
    window.print();
  }

  function exportarXLSX() {
    setErro(null);
    exportarParaXLSX({
      nomeArquivo: `premissas-reajuste-${codigoProposta}`,
      titulo: 'PREMISSAS / APLICAÇÕES DE REAJUSTE (%)',
      colunas: colunasExport(),
      linhas: linhasExport(),
    }).catch(() => setErro('Não foi possível gerar o arquivo XLSX.'));
  }

  function exportarPDF() {
    setErro(null);
    try {
      exportarParaPDF({
        nomeArquivo: `premissas-reajuste-${codigoProposta}`,
        titulo: 'PREMISSAS / APLICAÇÕES DE REAJUSTE (%)',
        subtitulo: `${nomeProposta} — Versão ${versaoNumero}`,
        colunas: colunasExport(),
        linhas: linhasExport(),
        rodape: 'PREMISSAS / APLICAÇÕES REAJUSTES (%)',
      });
    } catch {
      setErro('Não foi possível gerar o arquivo PDF.');
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 md:p-6 print:bg-white print:p-0 print:text-black">
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">
        Premissas / Aplicações de Reajuste (%)
      </h1>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Premissas / Aplicações de Reajuste</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            <span className="font-mono text-xs text-gray-400">{codigoProposta}</span> {nomeProposta} — Versão {versaoNumero}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={exibirContasZeradas} onChange={(e) => setExibirContasZeradas(e.target.checked)} />
            Exibir Contas Zeradas
          </label>
          <button type="button" onClick={imprimir} className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50">
            <IconeImpressora />
            Imprimir
          </button>
          <button type="button" onClick={exportarXLSX} disabled={linhasVisiveis.length === 0} className="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-50">
            <IconeDownload />
            XLSX
          </button>
          <button type="button" onClick={exportarPDF} disabled={linhasVisiveis.length === 0} className="flex items-center gap-1.5 rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:brightness-110 disabled:opacity-50">
            <IconeDownload />
            PDF
          </button>
        </div>
      </div>

      {erro && <p className="text-xs text-red-600 print:hidden">{erro}</p>}

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm print:rounded-none print:border-0 print:border-b print:border-black print:px-0 print:py-2">
        <span className="text-gray-400">Termo de Parceria:</span>{' '}
        <span className="font-medium text-slate-800">
          {codigoProposta} — {nomeProposta}
        </span>{' '}
        <span className="text-gray-400">Versão do TP:</span> <span className="font-medium text-slate-800">{versaoNumero}</span>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Nenhuma premissa de reajuste cadastrada para a proposta e versão selecionadas.
        </p>
      ) : (
        blocos.map((bloco) => {
          const linhasDoBloco = linhasVisiveis.filter((l) => l.blocos.includes(bloco));
          if (linhasDoBloco.length === 0) return null;
          return (
            <div key={bloco} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
              <div className="border-b bg-slate-50 px-4 py-2.5 print:border-black">
                <h3 className="text-sm font-semibold text-slate-800">Premissas {LABEL_BLOCO[bloco]}</h3>
              </div>
              <div className="max-h-[480px] overflow-auto print:max-h-none print:overflow-visible">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs print:min-w-0">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 print:static print:bg-white print:text-black">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Conta Analítica</th>
                      {competencias.map((comp) => (
                        <th key={comp} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                          {formatadorMes.format(new Date(comp))}/{new Date(comp).getUTCFullYear()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasDoBloco.map((linha, indice) => (
                      <tr key={linha.contaId} className={`border-b border-gray-100 ${indice % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                        <td className="px-3 py-2 text-slate-700">{linha.contaLabel}</td>
                        {linha.celulas.map((celula, i) => (
                          <td key={i} className="px-3 py-2 text-right tabular-nums text-slate-700">
                            {linha.temIndice ? formatarCelula(celula) : '0,00%'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      <p className="hidden text-center text-[10px] uppercase print:block">Premissas / Aplicações Reajustes (%)</p>
    </div>
  );
}
