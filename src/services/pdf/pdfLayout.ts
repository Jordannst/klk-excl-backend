import { jsPDF } from 'jspdf';

export const PDF_MARGIN_MM = 14;
export const PDF_TITLE_FONT_SIZE = 16;
export const PDF_COMPANY_FONT_SIZE = 14;
export const PDF_BODY_FONT_SIZE = 11;
export const PDF_SMALL_FONT_SIZE = 10;
export const PDF_TABLE_FONT_SIZE = 10;
export const PDF_TABLE_DENSE_FONT_SIZE = 9;
export const PDF_TABLE_HEADER_FONT_SIZE = 8;
export const PDF_TABLE_CELL_PADDING_MM = 2.2;
export const PDF_TABLE_DENSE_CELL_PADDING_MM = 1.9;
export const PDF_TABLE_HEADER_CELL_PADDING_MM = 0.8;
export const PDF_NO_STT_COLUMN_WIDTH_MM = 23;
export const PDF_PENGIRIM_COLUMN_WIDTH_MM = 24;
export const PDF_PENERIMA_COLUMN_WIDTH_MM = 24;
export const PDF_COLY_COLUMN_WIDTH_MM = 10;
export const PDF_KETERANGAN_COLUMN_WIDTH_MM = 16;

export function drawPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Halaman ${page} / ${pageCount}`, pageWidth - PDF_MARGIN_MM, pageHeight - 7, { align: 'right' });
  }
}

export function addPageIfNeeded(doc: jsPDF, currentY: number, requiredHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredHeight <= pageHeight - PDF_MARGIN_MM) {
    return currentY;
  }

  doc.addPage();
  return PDF_MARGIN_MM;
}
