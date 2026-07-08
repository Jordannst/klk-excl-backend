import { jsPDF } from 'jspdf';

export const PDF_MARGIN_MM = 14;

export function drawPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
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
