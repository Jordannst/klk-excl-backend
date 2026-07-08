import assert from 'assert';
import { formatPdfDate, formatRupiah, safeText } from '../services/pdf/format';
import { generateInvoicePdf, type InvoicePdfRequest } from '../services/pdf/invoicePdf';

assert.equal(formatRupiah(1250000), '1.250.000');
assert.equal(formatPdfDate('2026-07-08'), '08 Jul 2026');
assert.equal(formatPdfDate(null), '-');
assert.equal(safeText(undefined), '');
assert.equal(safeText('  KLK  '), 'KLK');

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

console.log('pdf-service check passed');
