import assert from 'assert';
import { formatPdfDate, formatRupiah, safeText } from '../services/pdf/format';
import { generateInvoicePdf, type InvoicePdfRequest } from '../services/pdf/invoicePdf';
import {
  PDF_BODY_FONT_SIZE,
  PDF_COLY_COLUMN_WIDTH_MM,
  PDF_COMPANY_FONT_SIZE,
  PDF_KETERANGAN_COLUMN_WIDTH_MM,
  PDF_NO_STT_COLUMN_WIDTH_MM,
  PDF_PENGIRIM_COLUMN_WIDTH_MM,
  PDF_PENERIMA_COLUMN_WIDTH_MM,
  PDF_SMALL_FONT_SIZE,
  PDF_TABLE_HEADER_CELL_PADDING_MM,
  PDF_TABLE_HEADER_FONT_SIZE,
  PDF_TABLE_DENSE_FONT_SIZE,
  PDF_TABLE_FONT_SIZE,
  PDF_TITLE_FONT_SIZE,
} from '../services/pdf/pdfLayout';
import { generateTransactionPdf } from '../services/pdf/transactionPdf';

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
assert.ok(PDF_NO_STT_COLUMN_WIDTH_MM >= 23, 'No Stt column must fit single-line tracking numbers');
assert.ok(PDF_PENGIRIM_COLUMN_WIDTH_MM >= 24, 'Pengirim column header must stay on one line');
assert.ok(PDF_PENERIMA_COLUMN_WIDTH_MM >= 24, 'Penerima column header must stay on one line');
assert.ok(PDF_COLY_COLUMN_WIDTH_MM >= 10, 'Coly column header must stay on one line');
assert.ok(PDF_KETERANGAN_COLUMN_WIDTH_MM >= 16, 'Ket column must fit short numeric notes on one line');

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

const transactionPdf = generateTransactionPdf({
  title: 'Perhitungan Pengiriman Barang QA',
  dateMode: 'enabled',
  showKeteranganColumn: true,
  transactions: makeTransactions(120),
});

assert.equal(transactionPdf.subarray(0, 4).toString('utf8'), '%PDF');
assert.ok(transactionPdf.length > 1000);

console.log('pdf-service check passed');
