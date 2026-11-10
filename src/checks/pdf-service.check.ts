import assert from 'assert';
import { formatPdfDate, formatRupiah, safeText } from '../services/pdf/format';
import {
  calculateInvoicePdfColumnWidths,
  generateInvoicePdf,
  layoutInvoicePdf,
  type InvoicePdfRequest,
} from '../services/pdf/invoicePdf';
import {
  PDF_BODY_FONT_SIZE,
  PDF_COLY_COLUMN_WIDTH_MM,
  PDF_COMPANY_FONT_SIZE,
  PDF_KETERANGAN_COLUMN_WIDTH_MM,
  PDF_NO_COLUMN_WIDTH_MM,
  PDF_NO_STT_COLUMN_WIDTH_MM,
  PDF_NO_STT_COLUMN_WIDTH_NORMAL_MM,
  PDF_PENGIRIM_COLUMN_WIDTH_MM,
  PDF_PENERIMA_COLUMN_WIDTH_MM,
  PDF_SMALL_FONT_SIZE,
  PDF_TABLE_HEADER_CELL_PADDING_MM,
  PDF_TABLE_HEADER_FONT_SIZE,
  PDF_TABLE_DENSE_FONT_SIZE,
  PDF_TABLE_FONT_SIZE,
  PDF_TITLE_FONT_SIZE,
} from '../services/pdf/pdfLayout';
import { calculateTransactionPdfColumnWidths, generateTransactionPdf } from '../services/pdf/transactionPdf';

assert.equal(formatRupiah(1250000), '1.250.000');
assert.equal(formatPdfDate('2026-07-08'), '08 Jul 2026');
assert.equal(formatPdfDate(null), '-');
assert.equal(safeText(undefined), '');
assert.equal(safeText('  KLK  '), 'KLK');
assert.ok(PDF_SMALL_FONT_SIZE >= 10, 'small PDF text must stay readable');
assert.ok(PDF_BODY_FONT_SIZE >= 11, 'body PDF text must stay readable');
assert.ok(PDF_COMPANY_FONT_SIZE >= 14, 'invoice company header must stay prominent');
assert.ok(PDF_TITLE_FONT_SIZE >= 16, 'transaction title must stay prominent');
assert.ok(PDF_TABLE_DENSE_FONT_SIZE >= 9, 'dense PDF table font must stay readable');
assert.ok(PDF_TABLE_FONT_SIZE >= 10, 'standard PDF table font must stay readable');
assert.ok(PDF_TABLE_HEADER_FONT_SIZE <= PDF_TABLE_DENSE_FONT_SIZE, 'PDF table header must be compact enough to avoid word breaks');
assert.ok(PDF_TABLE_HEADER_CELL_PADDING_MM <= 1.2, 'PDF table header padding must leave room for short labels');
assert.ok(PDF_NO_COLUMN_WIDTH_MM >= 11, 'No column must fit 3-digit row numbers on one line');
assert.ok(PDF_NO_STT_COLUMN_WIDTH_MM >= 34, 'No Stt column must fit 17-char tracking numbers at the dense font');
assert.ok(PDF_NO_STT_COLUMN_WIDTH_NORMAL_MM >= 38, 'No Stt column must fit 17-char tracking numbers at the normal font');
assert.ok(PDF_PENGIRIM_COLUMN_WIDTH_MM >= 24, 'Pengirim column header must stay on one line');
assert.ok(PDF_PENERIMA_COLUMN_WIDTH_MM >= 24, 'Penerima column header must stay on one line');
assert.ok(PDF_COLY_COLUMN_WIDTH_MM >= 10, 'Coly column header must stay on one line');
assert.ok(PDF_KETERANGAN_COLUMN_WIDTH_MM >= 16, 'Ket column must fit short numeric notes on one line');

for (const showDate of [true, false]) {
  for (const showKet of [true, false]) {
    const widths = calculateInvoicePdfColumnWidths(showDate, showKet);
    const totalWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);
    assert.equal(totalWidth, 191, 'invoice table must reach the narrow right margin on A4 portrait');
  }
}

const sumWidths = (widths: Record<number, number>) =>
  Object.values(widths).reduce((sum, width) => sum + width, 0);

// Overrides apply and the text columns absorb the difference.
const custom = calculateInvoicePdfColumnWidths(true, false, { noResi: 30, berat: 11 });
assert.equal(custom[2], 30);
assert.equal(custom[6], 11);
assert.equal(custom[3], 33);
assert.equal(custom[4], 33);
assert.equal(sumWidths(custom), 191);

// Finite numbers are clamped to 6..60 and rounded to 0.5 mm.
const clamped = calculateInvoicePdfColumnWidths(false, false, { tarif: 500, noResi: -5 });
assert.equal(clamped[7], 60);
assert.equal(clamped[1], 6);
assert.equal(calculateInvoicePdfColumnWidths(true, false, { berat: 9.26 })[6], 9.5);

// Junk values, unknown keys, hidden columns and non-object input are ignored.
const defaultWidths = calculateInvoicePdfColumnWidths(true, false);
for (const junk of [
  { berat: 'abc', min: Number.NaN, tarif: null, bogus: 40 },
  { keterangan: 40 },
  'abc',
  null,
  [30, 30],
]) {
  assert.deepEqual(calculateInvoicePdfColumnWidths(true, false, junk), defaultWidths);
}

// Overrides that squeeze Pengirim/Penerima below 24 mm fall back to defaults.
assert.deepEqual(
  calculateInvoicePdfColumnWidths(true, true, { berat: 20 }),
  calculateInvoicePdfColumnWidths(true, true)
);

for (const showDate of [true, false]) {
  for (const showKet of [true, false]) {
    const widths = calculateTransactionPdfColumnWidths(showDate, showKet);
    const totalWidth = Object.values(widths).reduce((sum, width) => sum + width, 0);
    assert.equal(totalWidth, 278, 'transaction table must reach the narrow right margin on A4 landscape');
  }
}

function makeTransactions(count: number): InvoicePdfRequest['transactions'] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    tanggal: '2026-07-08',
    noResi: `737${String(index + 1).padStart(3, '0')}`,
    pengirim: `Pengirim ${index + 1}`,
    penerima: `Penerima ${index + 1}`,
    coly: 1,
    berat: 12 + (index % 5),
    min: 10,
    tarif: 15000,
    total: (12 + (index % 5)) * 15000,
    keterangan: index % 3 === 0 ? 'Dokumen' : '',
  }));
}

const invoicePayload: InvoicePdfRequest = {
  invoiceTitle: 'Invoice QA',
  dateMode: 'enabled',
  showKeteranganColumn: true,
  formData: {
    tanggalSurat: 'Manado, 08 Juli 2026',
    nomorInvoice: 'INV/QA/001',
    namaPenerima: 'Customer QA',
    lokasiPenerima: 'Jakarta',
    biayaKirimDoc: 25000,
    penandatanganKiri: 'Janti Feine Rundengan',
    penandatanganKanan: 'Customer QA',
  },
  selectedSignatureKiri: null,
  selectedSignatureKanan: null,
  transactions: makeTransactions(90),
};

const invoicePdf = generateInvoicePdf(invoicePayload);
assert.equal(invoicePdf.subarray(0, 4).toString('utf8'), '%PDF');
assert.ok(invoicePdf.length > 1000);

const customWidthPdf = generateInvoicePdf({ ...invoicePayload, columnWidths: { noResi: 32, berat: 9 } });
assert.equal(customWidthPdf.subarray(0, 4).toString('utf8'), '%PDF');

const blankDateModePdf = generateInvoicePdf({ ...invoicePayload, dateMode: 'blank-column' });
assert.equal(blankDateModePdf.subarray(0, 4).toString('utf8'), '%PDF');

const hiddenDateModePdf = generateInvoicePdf({ ...invoicePayload, dateMode: 'hidden-column' });
assert.equal(hiddenDateModePdf.subarray(0, 4).toString('utf8'), '%PDF');

const noKeteranganPdf = generateInvoicePdf({ ...invoicePayload, showKeteranganColumn: false });
assert.equal(noKeteranganPdf.subarray(0, 4).toString('utf8'), '%PDF');

const invalidSignaturePdf = generateInvoicePdf({
  ...invoicePayload,
  selectedSignatureKiri: { imageData: 'not-a-valid-png' },
  logoBase64: 'not-a-valid-png',
});
assert.equal(invalidSignaturePdf.subarray(0, 4).toString('utf8'), '%PDF');

// The closing block (totals, bank info, signatures) must never sit alone on the
// last page: up to three table rows always share that page with it.
for (const showKeteranganColumn of [true, false]) {
  for (let count = 1; count <= 60; count += 1) {
    const layout = layoutInvoicePdf({
      ...invoicePayload,
      showKeteranganColumn,
      transactions: makeTransactions(count),
    });
    assert.ok(
      layout.bodyRowsOnLastPage >= Math.min(3, count),
      `closing block has too few rows above it (${count} rows, ket=${showKeteranganColumn})`
    );
  }
}

// An invoice whose closing block already fits keeps the normal spacing.
assert.equal(layoutInvoicePdf({ ...invoicePayload, transactions: makeTransactions(3) }).mode, 'normal');

// A short invoice tightens its spacing to stay on one page.
const compactLayout = layoutInvoicePdf({ ...invoicePayload, transactions: makeTransactions(8) });
assert.equal(compactLayout.mode, 'compact');
assert.equal(compactLayout.pageCount, 1);

// An invoice that cannot fit carries its last rows along with the closing block.
const carryLayout = layoutInvoicePdf({ ...invoicePayload, transactions: makeTransactions(18) });
assert.equal(carryLayout.mode, 'carry');
assert.equal(carryLayout.pageCount, 2);
assert.equal(carryLayout.bodyRowsOnLastPage, 3);

const transactionPdf = generateTransactionPdf({
  title: 'Perhitungan Pengiriman Barang QA',
  dateMode: 'enabled',
  showKeteranganColumn: true,
  transactions: makeTransactions(120),
});

assert.equal(transactionPdf.subarray(0, 4).toString('utf8'), '%PDF');
assert.ok(transactionPdf.length > 1000);

console.log('pdf-service check passed');
