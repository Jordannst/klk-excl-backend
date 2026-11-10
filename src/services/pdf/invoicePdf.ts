import { jsPDF } from 'jspdf';
import { autoTable, type CellDef, type RowInput, type UserOptions } from 'jspdf-autotable';
import { formatPdfDate, formatRupiah, safeText } from './format';
import {
  addPageIfNeeded,
  drawPageNumbers,
  PDF_BODY_FONT_SIZE,
  PDF_COLY_COLUMN_WIDTH_MM,
  PDF_COMPANY_FONT_SIZE,
  PDF_KETERANGAN_COLUMN_WIDTH_MM,
  PDF_MARGIN_MM,
  PDF_NO_COLUMN_WIDTH_MM,
  PDF_NO_STT_COLUMN_WIDTH_MM,
  PDF_NO_STT_COLUMN_WIDTH_NORMAL_MM,
  PDF_PENGIRIM_COLUMN_WIDTH_MM,
  PDF_SMALL_FONT_SIZE,
  PDF_TABLE_CELL_PADDING_MM,
  PDF_TABLE_DENSE_CELL_PADDING_MM,
  PDF_TABLE_DENSE_FONT_SIZE,
  PDF_TABLE_HEADER_CELL_PADDING_MM,
  PDF_TABLE_HEADER_FONT_SIZE,
  PDF_TABLE_FONT_SIZE,
} from './pdfLayout';

// Vertical offsets (mm) of the closing block, measured from its first line.
type FooterSpacing = {
  transfer: number;
  account: number;
  closing: number;
  regards: number;
  signature: number;
  signatureLine: number;
  role: number;
  name: number;
  cc: number;
  height: number;
};

type InvoiceSpacing = {
  cellPadding: number;
  denseCellPadding: number;
  tableGap: number;
  footer: FooterSpacing;
};

const NORMAL_SPACING: InvoiceSpacing = {
  cellPadding: PDF_TABLE_CELL_PADDING_MM,
  denseCellPadding: PDF_TABLE_DENSE_CELL_PADDING_MM,
  tableGap: 10,
  footer: {
    transfer: 27,
    account: 33,
    closing: 43,
    regards: 52,
    signature: 56,
    signatureLine: 75,
    role: 81,
    name: 87,
    cc: 98,
    height: 100,
  },
};

// Tighter rows and closing block, used only when it keeps the closing block on
// the same page as the table. Font sizes are untouched.
const COMPACT_SPACING: InvoiceSpacing = {
  cellPadding: 1.6,
  denseCellPadding: 1.4,
  tableGap: 6,
  footer: {
    transfer: 24,
    account: 29.5,
    closing: 37,
    regards: 44,
    signature: 46.5,
    signatureLine: 64,
    role: 69.5,
    name: 75,
    cc: 84,
    height: 86,
  },
};

// Rows held back to open the final page when the closing block cannot share a
// page with the table any other way.
const CARRY_ROWS = 3;
const TABLE_START_Y_MM = 116;
const A4_PORTRAIT_WIDTH_MM = 210;
const INVOICE_TABLE_RIGHT_MARGIN_MM = 5;

export type PdfTransaction = {
  id?: number;
  tanggal?: string | null;
  noResi: string;
  pengirim: string;
  penerima: string;
  coly: number;
  berat: number;
  min: number;
  tarif: number;
  total: number;
  keterangan?: string | null;
};

export type InvoicePdfRequest = {
  invoiceTitle?: string;
  dateMode?: 'enabled' | 'blank-column' | 'hidden-column';
  showKeteranganColumn?: boolean;
  formData: {
    tanggalSurat: string;
    nomorInvoice: string;
    namaPenerima: string;
    lokasiPenerima: string;
    biayaKirimDoc: number;
    penandatanganKiri: string;
    penandatanganKanan: string;
  };
  selectedSignatureKiri?: { imageData: string } | null;
  selectedSignatureKanan?: { imageData: string } | null;
  logoBase64?: string;
  columnWidths?: InvoicePdfColumnWidths;
  transactions: PdfTransaction[];
};

export type InvoicePdfColumnKey =
  | 'tanggal' | 'noResi' | 'coly' | 'berat' | 'min' | 'tarif' | 'total' | 'keterangan';
// Column width in mm; only the columns the user changed.
export type InvoicePdfColumnWidths = Partial<Record<InvoicePdfColumnKey, number>>;

function shouldShowDateColumn(dateMode: InvoicePdfRequest['dateMode']): boolean {
  return dateMode !== 'hidden-column';
}

function drawHeader(doc: jsPDF, logoBase64?: string): void {
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', PDF_MARGIN_MM, 11, 35, 18);
    } catch {
      // Invalid logo image should not block PDF generation.
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(PDF_COMPANY_FONT_SIZE);
  doc.text('PT. Kemilau Lintas Khatulistiwa', 105, 17, { align: 'center' });
  doc.setFontSize(PDF_BODY_FONT_SIZE);
  doc.text('Branch Manado: Permata Klabat Blok E1 No 17 Manado', 105, 24, { align: 'center' });
  doc.text('No. Tlp. : (0431) 7242432 HP : 085395549100', 105, 30, { align: 'center' });
  doc.text('Email : klk.express.mdc@gmail.com', 105, 36, { align: 'center' });
  doc.setLineWidth(0.35);
  doc.line(PDF_MARGIN_MM, 41, 210 - PDF_MARGIN_MM, 41);
}

function drawIntro(doc: jsPDF, payload: InvoicePdfRequest): void {
  const form = payload.formData;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BODY_FONT_SIZE);
  doc.text(safeText(form.tanggalSurat), PDF_MARGIN_MM, 51);
  doc.text(`No. ${safeText(form.nomorInvoice)}`, PDF_MARGIN_MM, 58);
  doc.text('Kepada Yth :', PDF_MARGIN_MM, 72);
  doc.setFont('helvetica', 'bold');
  doc.text(safeText(form.namaPenerima), PDF_MARGIN_MM, 78);
  doc.setFont('helvetica', 'normal');
  doc.text(`Di. ${safeText(form.lokasiPenerima)}`, PDF_MARGIN_MM, 84);
  doc.text('Dengan Hormat,', PDF_MARGIN_MM, 98);
  doc.text(
    'Terlampir Jasa Handling dari PT. Kemilau Lintas Khatulistiwa Manado Dikirim sesuai perhitungan Jasa handling di bawah ini:',
    PDF_MARGIN_MM,
    105,
    { maxWidth: 182 }
  );
}

function tableColumns(showDate: boolean, showKet: boolean): string[] {
  return [
    'No',
    ...(showDate ? ['Hari/Tgl'] : []),
    'No Stt',
    'Pengirim',
    'Penerima',
    'Coly',
    'Kg',
    'Min',
    'Tarif',
    'Jumlah',
    ...(showKet ? ['Ket'] : []),
  ];
}

const COLUMN_HEADERS: Record<InvoicePdfColumnKey, string> = {
  tanggal: 'Hari/Tgl',
  noResi: 'No Stt',
  coly: 'Coly',
  berat: 'Kg',
  min: 'Min',
  tarif: 'Tarif',
  total: 'Jumlah',
  keterangan: 'Ket',
};
const COLUMN_MIN_WIDTH_MM = 6;
const COLUMN_MAX_WIDTH_MM = 60;

// Source of truth for invoice column widths. frontend/lib/invoice-pdf-columns.ts
// mirrors the defaults, limits and fallback rule for display only: change both.
// `overrides` comes straight from the request body, so anything unusable is ignored.
export function calculateInvoicePdfColumnWidths(
  showDate: boolean,
  showKet: boolean,
  overrides?: unknown
): Record<number, number> {
  const columns = tableColumns(showDate, showKet);
  // showKet also selects the dense font, which needs less width per character.
  const widths: Record<number, number> = {
    0: PDF_NO_COLUMN_WIDTH_MM,
    [columns.indexOf('No Stt')]: showKet
      ? PDF_NO_STT_COLUMN_WIDTH_MM
      : PDF_NO_STT_COLUMN_WIDTH_NORMAL_MM,
    [columns.indexOf('Coly')]: PDF_COLY_COLUMN_WIDTH_MM,
    [columns.indexOf('Kg')]: 8,
    [columns.indexOf('Min')]: 8,
    [columns.indexOf('Tarif')]: 16,
    [columns.indexOf('Jumlah')]: 19,
  };

  if (showDate) widths[columns.indexOf('Hari/Tgl')] = 20;
  if (showKet) widths[columns.indexOf('Ket')] = PDF_KETERANGAN_COLUMN_WIDTH_MM;

  const custom = { ...widths };
  if (typeof overrides === 'object' && overrides !== null && !Array.isArray(overrides)) {
    for (const [key, header] of Object.entries(COLUMN_HEADERS)) {
      const index = columns.indexOf(header);
      const value = (overrides as Record<string, unknown>)[key];
      if (index < 0 || typeof value !== 'number' || !Number.isFinite(value)) continue;
      custom[index] = Math.min(COLUMN_MAX_WIDTH_MM, Math.max(COLUMN_MIN_WIDTH_MM, Math.round(value * 2) / 2));
    }
  }

  // Pengirim and Penerima share whatever the fixed columns leave over.
  const textWidth = (fixed: Record<number, number>) => (
    A4_PORTRAIT_WIDTH_MM - PDF_MARGIN_MM - INVOICE_TABLE_RIGHT_MARGIN_MM
    - Object.values(fixed).reduce((sum, width) => sum + width, 0)
  ) / 2;
  // Overrides that squeeze the text columns too far are dropped as a whole;
  // the defaults always fit.
  const fixed = textWidth(custom) < PDF_PENGIRIM_COLUMN_WIDTH_MM ? widths : custom;
  const textColumnWidth = textWidth(fixed);

  return {
    ...fixed,
    [columns.indexOf('Pengirim')]: textColumnWidth,
    [columns.indexOf('Penerima')]: textColumnWidth,
  };
}

function formatDateCell(row: PdfTransaction, dateMode: InvoicePdfRequest['dateMode']): string {
  if (dateMode === 'blank-column') return '';
  return formatPdfDate(row.tanggal);
}

function tableBody(
  rows: PdfTransaction[],
  dateMode: InvoicePdfRequest['dateMode'],
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
    String(row.min),
    formatRupiah(row.tarif),
    formatRupiah(row.total),
    ...(showKet ? [safeText(row.keterangan)] : []),
  ]);
}

function drawSignatureImage(doc: jsPDF, signature: { imageData: string } | null | undefined, x: number, y: number): void {
  if (!signature?.imageData) return;

  try {
    doc.addImage(signature.imageData, 'PNG', x, y, 40, 16);
  } catch {
    // Invalid signature image should fall back to the drawn signature line.
  }
}

function drawFooterBlock(
  doc: jsPDF,
  y: number,
  payload: InvoicePdfRequest,
  handlingTotal: number,
  spacing: FooterSpacing
): void {
  const form = payload.formData;
  const biayaKirimDoc = Math.trunc(form.biayaKirimDoc || 0);
  const totalTagihan = handlingTotal + biayaKirimDoc;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_BODY_FONT_SIZE);
  doc.text('1. Biaya handling', PDF_MARGIN_MM, y);
  doc.text(`Rp ${formatRupiah(handlingTotal)}`, 86, y, { align: 'right' });
  doc.text('2. Biaya Kirim Doc', PDF_MARGIN_MM, y + 6);
  doc.text(`Rp ${formatRupiah(biayaKirimDoc)}`, 86, y + 6, { align: 'right' });
  doc.line(PDF_MARGIN_MM, y + 9, 89, y + 9);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL TAGIHAN', PDF_MARGIN_MM, y + 15);
  doc.text(`Rp ${formatRupiah(totalTagihan)}`, 86, y + 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(PDF_SMALL_FONT_SIZE);
  doc.text('Jumlah tagihan bisa ditransfer melalui :', PDF_MARGIN_MM, y + spacing.transfer);
  doc.setFont('helvetica', 'bold');
  doc.text('Rek mandiri, 1500010112710 a/n. Janti Feine Rundengan', PDF_MARGIN_MM, y + spacing.account);
  doc.setFont('helvetica', 'normal');
  doc.text('Demikian di sampaikan, Atas perhatian dan kerjasama yang baik, Kami ucapkan Terima Kasih', PDF_MARGIN_MM, y + spacing.closing, { maxWidth: 182 });
  doc.text('Hormat Kami,', PDF_MARGIN_MM, y + spacing.regards);

  drawSignatureImage(doc, payload.selectedSignatureKiri, 45, y + spacing.signature);
  drawSignatureImage(doc, payload.selectedSignatureKanan, 129, y + spacing.signature);
  doc.line(40, y + spacing.signatureLine, 90, y + spacing.signatureLine);
  doc.line(124, y + spacing.signatureLine, 174, y + spacing.signatureLine);
  doc.text('PT. KLK Mdc', 65, y + spacing.role, { align: 'center' });
  doc.text('Diketahui,', 149, y + spacing.role, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(safeText(form.penandatanganKiri), 65, y + spacing.name, { align: 'center' });
  doc.text(safeText(form.penandatanganKanan), 149, y + spacing.name, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Cc. Klk mdc', PDF_MARGIN_MM, y + spacing.cc);
}

export type InvoicePdfLayout = {
  pdf: Buffer;
  mode: 'normal' | 'compact' | 'carry';
  pageCount: number;
  bodyRowsOnLastPage: number;
};

export function generateInvoicePdf(payload: InvoicePdfRequest): Buffer {
  return layoutInvoicePdf(payload).pdf;
}

export function layoutInvoicePdf(payload: InvoicePdfRequest): InvoicePdfLayout {
  if (!Array.isArray(payload.transactions) || payload.transactions.length === 0) {
    throw new Error('At least one transaction is required');
  }

  const rowCount = payload.transactions.length;
  const carryRows = Math.min(CARRY_ROWS, rowCount - 1);
  const minRowsOnLastPage = Math.min(CARRY_ROWS, rowCount);
  const attempts: Array<{ mode: InvoicePdfLayout['mode']; spacing: InvoiceSpacing; carryRows: number }> = [
    { mode: 'normal', spacing: NORMAL_SPACING, carryRows: 0 },
    { mode: 'compact', spacing: COMPACT_SPACING, carryRows: 0 },
    ...(carryRows > 0 ? [{ mode: 'carry' as const, spacing: NORMAL_SPACING, carryRows }] : []),
  ];

  // Take the first layout whose last page shows enough table rows above the
  // closing block, so the signatures never sit on a page of their own.
  let layout: InvoicePdfLayout | undefined;
  for (const attempt of attempts) {
    layout = { ...renderInvoicePdf(payload, attempt.spacing, attempt.carryRows), mode: attempt.mode };
    if (layout.bodyRowsOnLastPage >= minRowsOnLastPage) break;
  }

  return layout as InvoicePdfLayout;
}

function renderInvoicePdf(
  payload: InvoicePdfRequest,
  spacing: InvoiceSpacing,
  carryRows: number
): Omit<InvoicePdfLayout, 'mode'> {
  const bodyRowsByPage = new Map<number, number>();
  const showDate = shouldShowDateColumn(payload.dateMode);
  const showKet = payload.showKeteranganColumn !== false;
  const columns = tableColumns(showDate, showKet);
  const columnWidths = calculateInvoicePdfColumnWidths(showDate, showKet, payload.columnWidths);
  const handlingTotal = payload.transactions.reduce((sum, row) => sum + Math.trunc(row.total || 0), 0);
  // TOTAL value spans Tarif+Jumlah so amounts like "Rp 12.345.000" stay on one line.
  const totalColSpan = columns.length - (showKet ? 3 : 2);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawHeader(doc, payload.logoBase64);
  drawIntro(doc, payload);

  const body = tableBody(payload.transactions, payload.dateMode, showDate, showKet);
  const foot: RowInput[] = [[
    { content: 'TOTAL', colSpan: totalColSpan, styles: { halign: 'right', fontStyle: 'bold' } } as CellDef,
    { content: `Rp ${formatRupiah(handlingTotal)}`, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } } as CellDef,
    ...(showKet ? [''] : []),
  ]];

  const tableOptions: UserOptions = {
    head: [columns],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    margin: {
      top: PDF_MARGIN_MM,
      right: INVOICE_TABLE_RIGHT_MARGIN_MM,
      bottom: 18,
      left: PDF_MARGIN_MM,
    },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: showKet ? PDF_TABLE_DENSE_FONT_SIZE : PDF_TABLE_FONT_SIZE,
      cellPadding: showKet ? spacing.denseCellPadding : spacing.cellPadding,
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
      0: { halign: 'center', cellWidth: columnWidths[0] },
      ...(showDate ? { 1: { cellWidth: columnWidths[1] } } : {}),
      [columns.indexOf('No Stt')]: { cellWidth: columnWidths[columns.indexOf('No Stt')] },
      [columns.indexOf('Pengirim')]: { cellWidth: columnWidths[columns.indexOf('Pengirim')] },
      [columns.indexOf('Penerima')]: { cellWidth: columnWidths[columns.indexOf('Penerima')] },
      [columns.indexOf('Coly')]: { halign: 'center', cellWidth: columnWidths[columns.indexOf('Coly')] },
      [columns.indexOf('Kg')]: { halign: 'center', cellWidth: columnWidths[columns.indexOf('Kg')] },
      [columns.indexOf('Min')]: { halign: 'center', cellWidth: columnWidths[columns.indexOf('Min')] },
      [columns.indexOf('Tarif')]: { halign: 'right', cellWidth: columnWidths[columns.indexOf('Tarif')] },
      [columns.indexOf('Jumlah')]: { halign: 'right', cellWidth: columnWidths[columns.indexOf('Jumlah')] },
      ...(showKet ? { [columns.indexOf('Ket')]: { cellWidth: columnWidths[columns.indexOf('Ket')] } } : {}),
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 0) return;
      const page = doc.getCurrentPageInfo().pageNumber;
      bodyRowsByPage.set(page, (bodyRowsByPage.get(page) ?? 0) + 1);
    },
  };

  if (carryRows > 0) {
    autoTable(doc, { ...tableOptions, startY: TABLE_START_Y_MM, body: body.slice(0, -carryRows) });
    doc.addPage();
    autoTable(doc, { ...tableOptions, startY: PDF_MARGIN_MM, body: body.slice(-carryRows), foot });
  } else {
    autoTable(doc, { ...tableOptions, startY: TABLE_START_Y_MM, body, foot });
  }

  const table = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  const footerY = addPageIfNeeded(
    doc,
    (table?.finalY ?? TABLE_START_Y_MM) + spacing.tableGap,
    spacing.footer.height
  );
  drawFooterBlock(doc, footerY, payload, handlingTotal, spacing.footer);
  drawPageNumbers(doc);

  const pageCount = doc.getNumberOfPages();
  return {
    pdf: Buffer.from(doc.output('arraybuffer')),
    pageCount,
    bodyRowsOnLastPage: bodyRowsByPage.get(pageCount) ?? 0,
  };
}
