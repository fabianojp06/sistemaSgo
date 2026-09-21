'use client';

import { useMemo, useState, useTransition } from 'react';
import { exportarParaPDF, exportarParaXLSX, type ColunaRelatorio, type LinhaRelatorio } from '@/lib/export/exportarRelatorio';
import type { Anexo6Serializado, LinhaAnexo6Serializada } from './anexo6Tipos';
import { registrarExportacaoAnexo6Action } from './actions';

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function formatarValor(valor: string): string {
  return formatadorMoeda.format(Number(valor));
}

function formatarPercentual(percentual: string | null): string {
  return percentual === null ? '-' : `${formatadorMoeda.format(Number(percentual))}%`;
}

/** Cargos por página no PDF (A4 paisagem). O anexo de referência usa 12; 10
 *  mantém a coluna legível depois de repetir Rubrica/%/Total em cada bloco. */
const CARGOS_POR_PAGINA_PDF = 10;

/** Campos do cabeçalho do anexo que o SGO ainda não modela (ver análise do PDF). */
const NAO_MODELADO = 'Não informado no SGO';

export function RelatorioAnexo6Panel({
  codigoProposta,
  nomeProposta,
  anexo,
}: {
  codigoProposta: string;
  nomeProposta: string;
  anexo: Anexo6Serializado;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const colunasExport: ColunaRelatorio[] = useMemo(
    () => [
      { chave: 'rubrica', rotulo: 'Rubrica' },
      { chave: 'percentual', rotulo: 'Percentual (%)' },
      { chave: 'total', rotulo: 'Total (R$)' },
      ...anexo.colunas.map((c, indice) => ({ chave: `c${indice}`, rotulo: c.nome })),
    ],
    [anexo.colunas],
  );

  const linhasExport: LinhaRelatorio[] = useMemo(() => {
    const porCargo = (valores: string[]): Record<string, string> =>
      Object.fromEntries(valores.map((valor, indice) => [`c${indice}`, formatarValor(valor)]));

    const cabecalho: LinhaRelatorio[] = [
      {
        rubrica: 'II  Número de empregados no cargo/função',
        percentual: '-',
        total: String(anexo.quantidadeTotalEmpregados),
        ...Object.fromEntries(anexo.colunas.map((c, indice) => [`c${indice}`, String(c.quantidadeEmpregados)])),
        estiloLinha: 'subtotal',
      },
      { rubrica: 'III  Salário Normativo da Categoria Profissional', percentual: '-', total: 'Não Aplicável', estiloLinha: 'subitem' },
      { rubrica: 'IV  Categoria profissional', percentual: '-', total: NAO_MODELADO, estiloLinha: 'subitem' },
      { rubrica: 'V  Data base da categoria', percentual: '-', total: NAO_MODELADO, estiloLinha: 'subitem' },
    ];

    const corpo = anexo.blocos.flatMap((bloco): LinhaRelatorio[] => [
      { rubrica: bloco.titulo, percentual: '', total: '', estiloLinha: 'subtotal' },
      ...bloco.linhas.map(
        (linha): LinhaRelatorio => ({
          rubrica: linha.codigo ? `${linha.codigo}  ${linha.rotulo}` : linha.rotulo,
          percentual: formatarPercentual(linha.percentual),
          total: formatarValor(linha.total),
          ...porCargo(linha.valores),
          estiloLinha: linha.nivel === 'rubrica' ? 'normal' : linha.nivel === 'total' ? 'total' : 'subtotal',
        }),
      ),
    ]);

    return [...cabecalho, ...corpo];
  }, [anexo]);

  async function gravarAuditoriaEEntao(formato: 'PDF' | 'XLSX' | 'IMPRESSAO', depois: () => void) {
    setErro(null);
    startTransition(async () => {
      const resultado = await registrarExportacaoAnexo6Action({
        propostaCodigo: codigoProposta,
        propostaNome: nomeProposta,
        formato,
        quantidadeCargos: anexo.colunas.length,
        quantidadeEmpregados: anexo.quantidadeTotalEmpregados,
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
        nomeArquivo: `anexo6-custo-empregados-${codigoProposta}`,
        titulo: `ANEXO 6 — COMPOSIÇÃO DOS CUSTOS DE REMUNERAÇÃO E BENEFÍCIOS (EMPREGADOS) — ${nomeProposta}`,
        colunas: colunasExport,
        linhas: linhasExport,
      }).catch(() => setErro('Não foi possível gerar o arquivo XLSX.'));
    });
  }

  function exportarPDF() {
    gravarAuditoriaEEntao('PDF', () => {
      try {
        exportarParaPDF({
          nomeArquivo: `anexo6-custo-empregados-${codigoProposta}`,
          titulo: 'ANEXO 6 — COMPOSIÇÃO DOS CUSTOS DE REMUNERAÇÃO E BENEFÍCIOS (EMPREGADOS)',
          subtitulo: `${codigoProposta} — ${nomeProposta}`,
          colunas: colunasExport,
          linhas: linhasExport,
          rodape: 'ANEXO 6 — Composição de Custo de Empregados',
          colunasFixas: 3,
          colunasPorBloco: CARGOS_POR_PAGINA_PDF,
        });
      } catch {
        setErro('Não foi possível gerar o arquivo PDF.');
      }
    });
  }

  const classeLinha = (nivel: LinhaAnexo6Serializada['nivel']): string => {
    if (nivel === 'total') return 'border-y-2 border-[#1A1F29] bg-slate-100 font-semibold dark:border-[#EBEDF2] dark:bg-[#1F2430]';
    if (nivel === 'subtotal') return 'border-y border-[#2B5FD9]/30 bg-[#E8EEFC] font-semibold dark:border-[#6D93F0]/30 dark:bg-[#1D2A48]';
    return 'border-b border-gray-100 dark:border-[#2B303C]';
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-4 dark:bg-[#191D26] md:p-6 print:bg-white print:p-0 print:text-black">
      <h1 className="hidden text-center text-lg font-bold tracking-wide uppercase print:block">
        ANEXO 6 — Composição dos Custos de Remuneração e Benefícios (Empregados)
      </h1>

      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-[#1A1F29] dark:text-[#EBEDF2]">
            ANEXO 6 — Composição dos Custos de Remuneração e Benefícios (Empregados)
          </h2>
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

      {/* Cabeçalho I a V do anexo. III/IV/V não têm origem no SGO hoje — saem
          declarados como tal em vez de inventar valor. */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 rounded-lg border border-[#DDE2EA] bg-white px-4 py-3 text-sm dark:border-[#2B303C] dark:bg-[#191D26] print:rounded-none print:border-0 print:border-b print:border-black print:px-0 print:py-2">
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Cargos/funções:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{anexo.colunas.length}</span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">Total de empregados:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{anexo.quantidadeTotalEmpregados}</span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">III — Salário Normativo da Categoria:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">Não Aplicável</span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">IV — Categoria profissional:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{NAO_MODELADO}</span>
        </span>
        <span>
          <span className="text-[#8A8F98] dark:text-[#767C89]">V — Data base:</span>{' '}
          <span className="font-medium text-[#1A1F29] dark:text-[#EBEDF2]">{NAO_MODELADO}</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm dark:border-[#2B303C] dark:bg-[#191D26] print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="max-h-[620px] overflow-auto print:max-h-none print:overflow-visible">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-50 text-slate-600 dark:bg-[#1F2430] dark:text-[#A4AAB6] print:static print:bg-white print:text-black">
              <tr>
                <th className="sticky left-0 z-30 min-w-[320px] bg-slate-50 px-3 py-2.5 font-semibold dark:bg-[#1F2430] print:static">
                  I — Tipo de serviço (mesmo serviço com características distintas)
                </th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Percentual (%)</th>
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Total (R$)</th>
                {anexo.colunas.map((coluna) => (
                  <th key={coluna.id} className="min-w-[128px] px-3 py-2.5 text-right font-semibold">
                    {coluna.nome}
                  </th>
                ))}
              </tr>
              <tr className="bg-slate-100 dark:bg-[#242A36]">
                <th className="sticky left-0 z-30 bg-slate-100 px-3 py-2 font-medium dark:bg-[#242A36] print:static">
                  II — Número de empregados no cargo/função
                </th>
                <th className="px-3 py-2 text-right font-medium">-</th>
                <th className="px-3 py-2 text-right font-medium tabular-nums">{anexo.quantidadeTotalEmpregados}</th>
                {anexo.colunas.map((coluna) => (
                  <th key={coluna.id} className="px-3 py-2 text-right font-medium tabular-nums">
                    {coluna.quantidadeEmpregados}
                  </th>
                ))}
              </tr>
            </thead>

            {anexo.blocos.map((bloco) => (
              <tbody key={bloco.codigo}>
                <tr className="bg-[#EEF1F6] dark:bg-[#20242E]">
                  <td
                    className="sticky left-0 z-10 bg-[#EEF1F6] px-3 py-2 text-[11px] font-bold tracking-wide text-[#1A1F29] uppercase dark:bg-[#20242E] dark:text-[#EBEDF2] print:static"
                    colSpan={1}
                  >
                    {bloco.titulo}
                  </td>
                  <td className="px-3 py-2" colSpan={2 + anexo.colunas.length} />
                </tr>
                {bloco.linhas.map((linha, indice) => (
                  <tr key={`${bloco.codigo}-${linha.codigo}-${indice}`} className={classeLinha(linha.nivel)}>
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-[#1A1F29] dark:text-[#EBEDF2] print:static">
                      {linha.codigo && <span className="mr-2 font-mono text-[10px] text-[#8A8F98] dark:text-[#767C89]">{linha.codigo}</span>}
                      {linha.rotulo}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#5B6270] dark:text-[#A4AAB6]">
                      {formatarPercentual(linha.percentual)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]">{formatarValor(linha.total)}</td>
                    {linha.valores.map((valor, indiceCargo) => (
                      <td
                        key={anexo.colunas[indiceCargo].id}
                        className="px-3 py-2 text-right tabular-nums text-[#1A1F29] dark:text-[#EBEDF2]"
                      >
                        {formatarValor(valor)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[#8A8F98] dark:text-[#767C89] print:hidden">
        * Salário-Base conforme cadastro do Cargo. A coluna <strong>Total</strong> é a soma simples das colunas de Cargo (valor por
        empregado), sem multiplicar pelo número de empregados — igual ao anexo de referência. Percentuais dos Módulos 2, 3 e 6 são
        fixos (IN 05/2017). Relatório gerado em {new Date().toLocaleString('pt-BR')}.
      </p>
      <p className="hidden text-center text-[10px] uppercase print:block">
        ANEXO 6 — Composição de Custo de Empregados — gerado em {new Date().toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
