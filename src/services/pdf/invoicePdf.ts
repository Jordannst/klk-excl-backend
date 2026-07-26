import { jsPDF } from 'jspdf';
import { autoTable, type CellDef, type RowInput } from 'jspdf-autotable';
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
  PDF_SMALL_FONT_SIZE,
  PDF_TABLE_CELL_PADDING_MM,
  PDF_TABLE_DENSE_CELL_PADDING_MM,
  PDF_TABLE_DENSE_FONT_SIZE,
  PDF_TABLE_HEADER_CELL_PADDING_MM,
  PDF_TABLE_HEADER_FONT_SIZE,
  PDF_TABLE_FONT_SIZE,
} from './pdfLayout';

const FOOTER_BLOCK_HEIGHT_MM = 100;
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
  transactions: PdfTransaction[];
};

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

export function calculateInvoicePdfColumnWidths(
  showDate: boolean,
  showKet: boolean
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

  const fixedWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);
  const textColumnWidth = (
    A4_PORTRAIT_WIDTH_MM - PDF_MARGIN_MM - INVOICE_TABLE_RIGHT_MARGIN_MM - fixedWidth
  ) / 2;
  widths[columns.indexOf('Pengirim')] = textColumnWidth;
  widths[columns.indexOf('Penerima')] = textColumnWidth;

  return widths;
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

function drawFooterBlock(doc: jsPDF, startY: number, payload: InvoicePdfRequest, handlingTotal: number): void {
  const y = addPageIfNeeded(doc, startY, FOOTER_BLOCK_HEIGHT_MM);
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
  doc.text('Jumlah tagihan bisa ditransfer melalui :', PDF_MARGIN_MM, y + 27);
  doc.setFont('helvetica', 'bold');
  doc.text('Rek mandiri, 1500010112710 a/n. Janti Feine Rundengan', PDF_MARGIN_MM, y + 33);
  doc.setFont('helvetica', 'normal');
  doc.text('Demikian di sampaikan, Atas perhatian dan kerjasama yang baik, Kami ucapkan Terima Kasih', PDF_MARGIN_MM, y + 43, { maxWidth: 182 });
  doc.text('Hormat Kami,', PDF_MARGIN_MM, y + 52);

  drawSignatureImage(doc, payload.selectedSignatureKiri, 45, y + 56);
  drawSignatureImage(doc, payload.selectedSignatureKanan, 129, y + 56);
  doc.line(40, y + 75, 90, y + 75);
  doc.line(124, y + 75, 174, y + 75);
  doc.text('PT. KLK Mdc', 65, y + 81, { align: 'center' });
  doc.text('Diketahui,', 149, y + 81, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(safeText(form.penandatanganKiri), 65, y + 87, { align: 'center' });
  doc.text(safeText(form.penandatanganKanan), 149, y + 87, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Cc. Klk mdc', PDF_MARGIN_MM, y + 98);
}

export function generateInvoicePdf(payload: InvoicePdfRequest): Buffer {
  if (!Array.isArray(payload.transactions) || payload.transactions.length === 0) {
    throw new Error('At least one transaction is required');
  }

  const showDate = shouldShowDateColumn(payload.dateMode);
  const showKet = payload.showKeteranganColumn !== false;
  const columns = tableColumns(showDate, showKet);
  const columnWidths = calculateInvoicePdfColumnWidths(showDate, showKet);
  const handlingTotal = payload.transactions.reduce((sum, row) => sum + Math.trunc(row.total || 0), 0);
  // TOTAL value spans Tarif+Jumlah so amounts like "Rp 12.345.000" stay on one line.
  const totalColSpan = columns.length - (showKet ? 3 : 2);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  drawHeader(doc, payload.logoBase64);
  drawIntro(doc, payload);

  autoTable(doc, {
    startY: 116,
    head: [columns],
    body: tableBody(payload.transactions, payload.dateMode, showDate, showKet),
    foot: [[
      { content: 'TOTAL', colSpan: totalColSpan, styles: { halign: 'right', fontStyle: 'bold' } } as CellDef,
      { content: `Rp ${formatRupiah(handlingTotal)}`, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } } as CellDef,
      ...(showKet ? [''] : []),
    ]],
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
  });

  const table = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  drawFooterBlock(doc, (table?.finalY ?? 116) + 10, payload, handlingTotal);
  drawPageNumbers(doc);

  return Buffer.from(doc.output('arraybuffer'));
}
