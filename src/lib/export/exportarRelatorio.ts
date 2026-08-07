import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

export type ColunaRelatorio = { chave: string; rotulo: string };
export type LinhaRelatorio = Record<string, string | number>;

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
    sheet.addRow(params.colunas.map((c) => linha[c.chave] ?? ''));
  }

  sheet.columns.forEach((coluna) => {
    coluna.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  dispararDownload(blob, `${params.nomeArquivo}.xlsx`);
}

export function exportarParaPDF(params: {
  nomeArquivo: string;
  titulo: string;
  subtitulo?: string;
  colunas: ColunaRelatorio[];
  linhas: LinhaRelatorio[];
  rodape?: string;
}): void {
  if (typeof window === 'undefined') return;

  const doc = new jsPDF({ orientation: 'landscape' });
  const larguraPagina = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(params.titulo, larguraPagina / 2, 15, { align: 'center' });

  if (params.subtitulo) {
    doc.setFontSize(10);
    doc.text(params.subtitulo, larguraPagina / 2, 21, { align: 'center' });
  }

  autoTable(doc, {
    startY: params.subtitulo ? 27 : 22,
    head: [params.colunas.map((c) => c.rotulo)],
    body: params.linhas.map((linha) => params.colunas.map((c) => String(linha[c.chave] ?? ''))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [43, 95, 217] },
    didDrawPage: (dados) => {
      const alturaPagina = doc.internal.pageSize.getHeight();
      const textoRodape = params.rodape ? `${params.rodape} — Página ${dados.pageNumber}` : `Página ${dados.pageNumber}`;
      doc.setFontSize(8);
      doc.text(textoRodape, larguraPagina / 2, alturaPagina - 8, { align: 'center' });
    },
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
