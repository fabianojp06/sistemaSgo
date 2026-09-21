import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export type ColunaRelatorio = { chave: string; rotulo: string };

/** US-142/ADR-049 — hierarquia visual opcional da linha na exportação.
 * Ausência = 'normal' (comportamento pré-existente, US-123 inalterada). */
export type EstiloLinhaRelatorio = 'normal' | 'subitem' | 'subtotal' | 'total';

export type LinhaRelatorio = Record<string, string | number> & {
  estiloLinha?: EstiloLinhaRelatorio;
};

/**
 * ADR-037 — utilitário de infraestrutura genérico para exportação de
 * relatórios tabulares. Não sabe nada de domínio orçamentário — só desenha
 * tabela a partir de colunas+linhas já formatadas (string/number prontos
 * para exibição). Geração 100% client-side (sem Server Action, sem
 * Puppeteer): reaproveita os dados que o Server Component já calculou e o
 * Client Component já tem em memória. Só funciona no browser.
 */
export async function exportarParaXLSX(params: {
  nomeArquivo: string;
  titulo: string;
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Relatório');

  const tituloRow = sheet.addRow([params.titulo]);
  tituloRow.font = { bold: true, size: 14 };
  sheet.mergeCells(1, 1, 1, params.colunas.length);
  sheet.addRow([]);

  const cabecalhoRow = sheet.addRow(params.colunas.map((c) => c.rotulo));
  cabecalhoRow.font = { bold: true };

  for (const linha of params.linhas) {
    const row = sheet.addRow(params.colunas.map((c) => linha[c.chave] ?? ''));
    const estilo = linha.estiloLinha ?? 'normal';
    if (estilo === 'subtotal' || estilo === 'total') {
      row.font = { bold: true };
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: estilo === 'total' ? 'FFD9E2F3' : 'FFEEF1F6' },
      };
    } else if (estilo === 'subitem') {
      row.font = { italic: true, color: { argb: 'FF5B6270' } };
    }
  }

  sheet.columns.forEach((coluna) => {
    coluna.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  dispararDownload(blob, `${params.nomeArquivo}.xlsx`);
}

/**
 * Divide as colunas em blocos que cabem na página, repetindo as colunas fixas
 * (rótulo da linha, percentual…) no começo de cada bloco. Sem
 * `colunasPorBloco`, devolve um bloco só — comportamento pré-existente.
 */
function dividirColunasEmBlocos(
  colunas: ColunaRelatorio[],
  colunasFixas: number,
  colunasPorBloco?: number,
): ColunaRelatorio[][] {
  if (!colunasPorBloco || colunasPorBloco <= 0) return [colunas];

  const fixas = colunas.slice(0, colunasFixas);
  const variaveis = colunas.slice(colunasFixas);
  if (variaveis.length <= colunasPorBloco) return [colunas];

  const blocos: ColunaRelatorio[][] = [];
  for (let inicio = 0; inicio < variaveis.length; inicio += colunasPorBloco) {
    blocos.push([...fixas, ...variaveis.slice(inicio, inicio + colunasPorBloco)]);
  }
  return blocos;
}

export function exportarParaPDF(params: {
  nomeArquivo: string;
  titulo: string;
  subtitulo?: string;
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
  rodape?: string;
  /** Colunas iniciais repetidas em cada bloco de páginas (padrão: 1). */
  colunasFixas?: number;
  /** Máximo de colunas variáveis por bloco. Omitido = tudo numa tabela só —
   *  é o comportamento usado pelos relatórios de poucas colunas. */
  colunasPorBloco?: number;
}): void {
  if (typeof window === 'undefined') return;

  const doc = new jsPDF({ orientation: 'landscape' });
  const larguraPagina = doc.internal.pageSize.getWidth();
  const blocos = dividirColunasEmBlocos(params.colunas, params.colunasFixas ?? 1, params.colunasPorBloco);

  blocos.forEach((colunasDoBloco, indiceBloco) => {
    if (indiceBloco > 0) doc.addPage();

    doc.setFontSize(14);
    doc.text(params.titulo, larguraPagina / 2, 15, { align: 'center' });

    const sufixoBloco = blocos.length > 1 ? ` (colunas ${indiceBloco + 1} de ${blocos.length})` : '';
    const subtitulo = params.subtitulo ? `${params.subtitulo}${sufixoBloco}` : sufixoBloco.trim();
    if (subtitulo) {
      doc.setFontSize(10);
      doc.text(subtitulo, larguraPagina / 2, 21, { align: 'center' });
    }

    autoTable(doc, {
      startY: subtitulo ? 27 : 22,
      head: [colunasDoBloco.map((c) => c.rotulo)],
      body: params.linhas.map((linha) => colunasDoBloco.map((c) => String(linha[c.chave] ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [43, 95, 217] },
      didParseCell: (dados) => {
        if (dados.section !== 'body') return;
        const estilo = params.linhas[dados.row.index]?.estiloLinha ?? 'normal';
        if (estilo === 'subtotal' || estilo === 'total') {
          dados.cell.styles.fontStyle = 'bold';
          dados.cell.styles.fillColor = estilo === 'total' ? [217, 226, 243] : [238, 241, 246];
        } else if (estilo === 'subitem') {
          dados.cell.styles.fontStyle = 'italic';
          dados.cell.styles.textColor = [91, 98, 112];
        }
      },
      didDrawPage: () => {
        const alturaPagina = doc.internal.pageSize.getHeight();
        // `dados.pageNumber` do autoTable reinicia em 1 a cada chamada — com a
        // paginação por blocos de colunas o rodapé sairia "1, 2, 1, 2...".
        // O número do documento vem do próprio jsPDF.
        const numeroPagina = doc.getCurrentPageInfo().pageNumber;
        const textoRodape = params.rodape ? `${params.rodape} — Página ${numeroPagina}` : `Página ${numeroPagina}`;
        doc.setFontSize(8);
        doc.text(textoRodape, larguraPagina / 2, alturaPagina - 8, { align: 'center' });
      },
    });
  });

  doc.save(`${params.nomeArquivo}.pdf`);
}

function dispararDownload(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
