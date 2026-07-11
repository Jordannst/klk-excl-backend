import { jsPDF } from 'jspdf';
import { autoTable, type CellDef, type RowInput } from 'jspdf-autotable';
import { formatPdfDate, formatRupiah, safeText } from './format';
import {
  PDF_COLY_COLUMN_WIDTH_MM,
  PDF_KETERANGAN_COLUMN_WIDTH_MM,
  drawPageNumbers,
  PDF_MARGIN_MM,
  PDF_NO_STT_COLUMN_WIDTH_MM,
  PDF_PENGIRIM_COLUMN_WIDTH_MM,
  PDF_PENERIMA_COLUMN_WIDTH_MM,
  PDF_SMALL_FONT_SIZE,
  PDF_TABLE_CELL_PADDING_MM,
  PDF_TABLE_DENSE_CELL_PADDING_MM,
  PDF_TABLE_DENSE_FONT_SIZE,
  PDF_TABLE_HEADER_CELL_PADDING_MM,
  PDF_TABLE_HEADER_FONT_SIZE,
  PDF_TABLE_FONT_SIZE,
  PDF_TITLE_FONT_SIZE,
} from './pdfLayout';
import type { PdfTransaction } from './invoicePdf';

export type TransactionPdfRequest = {
  title?: string;
  dateMode?: 'enabled' | 'blank-column' | 'hidden-column';
  showKeteranganColumn?: boolean;
  transactions: PdfTransaction[];
};

function shouldShowDateColumn(dateMode: TransactionPdfRequest['dateMode']): boolean {
  return dateMode !== 'hidden-column';
}

function columns(showDate: boolean, showKet: boolean): string[] {
  return [
    'No',
    ...(showDate ? ['Hari/Tgl'] : []),
    'No Stt',
    'Pengirim',
    'Penerima',
    'C',
    'Kg',
    'Min',
    'Tarif',
    'Jumlah',
    ...(showKet ? ['Ket'] : []),
  ];
}

function formatDateCell(row: PdfTransaction, dateMode: TransactionPdfRequest['dateMode']): string {
  if (dateMode === 'blank-column') return '';
  return formatPdfDate(row.tanggal);
}

function body(
  rows: PdfTransaction[],
  dateMode: TransactionPdfRequest['dateMode'],
  showDate: boolean,
  showKet: boolean
): RowInput[] {
  return rows.map((row, index) => [
    String(index + 1),
    ...(showDate ? [formatDateCell(row, dateMode)] : []),
    safeText(row.noResi),
    safeText(row.pengirim),
    safeText(row.penerima),
    String(row.coly),
    String(row.berat),
    String(row.min || ''),
    formatRupiah(row.tarif),
    formatRupiah(row.total),
    ...(showKet ? [safeText(row.keterangan)] : []),
  ]);
}

export function generateTransactionPdf(payload: TransactionPdfRequest): Buffer {
  if (!Array.isArray(payload.transactions) || payload.transactions.length === 0) {
    throw new Error('At least one transaction is required');
  }

  const showDate = shouldShowDateColumn(payload.dateMode);
  const showKet = payload.showKeteranganColumn !== false;
  const tableColumns = columns(showDate, showKet);
  const total = payload.transactions.reduce((sum, row) => sum + Math.trunc(row.total || 0), 0);
  const totalColSpan = tableColumns.length - (showKet ? 2 : 1);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_TITLE_FONT_SIZE);
  doc.text(safeText(payload.title) || 'Perhitungan Pengiriman Barang', 148.5, 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_SMALL_FONT_SIZE);
  doc.text(`Tanggal: ${formatPdfDate(new Date())}`, PDF_MARGIN_MM, 24);

  autoTable(doc, {
    startY: 30,
    head: [tableColumns],
    body: body(payload.transactions, payload.dateMode, showDate, showKet),
    foot: [[
      { content: 'TOTAL', colSpan: totalColSpan, styles: { halign: 'right', fontStyle: 'bold' } } as CellDef,
      { content: formatRupiah(total), styles: { halign: 'right', fontStyle: 'bold' } } as CellDef,
      ...(showKet ? [''] : []),
    ]],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    margin: { top: PDF_MARGIN_MM, right: PDF_MARGIN_MM, bottom: 16, left: PDF_MARGIN_MM },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: showKet ? PDF_TABLE_DENSE_FONT_SIZE : PDF_TABLE_FONT_SIZE,
      cellPadding: showKet ? PDF_TABLE_DENSE_CELL_PADDING_MM : PDF_TABLE_CELL_PADDING_MM,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: PDF_TABLE_HEADER_FONT_SIZE,
      cellPadding: PDF_TABLE_HEADER_CELL_PADDING_MM,
    },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      ...(showDate ? { 1: { cellWidth: 20 } } : {}),
      [tableColumns.indexOf('No Stt')]: { cellWidth: PDF_NO_STT_COLUMN_WIDTH_MM },
      [tableColumns.indexOf('Pengirim')]: { cellWidth: PDF_PENGIRIM_COLUMN_WIDTH_MM },
      [tableColumns.indexOf('Penerima')]: { cellWidth: PDF_PENERIMA_COLUMN_WIDTH_MM },
      [tableColumns.indexOf('C')]: { halign: 'center', cellWidth: PDF_COLY_COLUMN_WIDTH_MM },
      [tableColumns.indexOf('Kg')]: { halign: 'center', cellWidth: 8 },
      [tableColumns.indexOf('Min')]: { halign: 'center', cellWidth: 8 },
      [tableColumns.indexOf('Tarif')]: { halign: 'right', cellWidth: 17 },
      [tableColumns.indexOf('Jumlah')]: { halign: 'right', cellWidth: 21 },
      ...(showKet ? { [tableColumns.indexOf('Ket')]: { cellWidth: PDF_KETERANGAN_COLUMN_WIDTH_MM } } : {}),
    },
  });

  drawPageNumbers(doc);
  return Buffer.from(doc.output('arraybuffer'));
}
