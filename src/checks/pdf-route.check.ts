import assert from 'assert';
import express from 'express';
import pdfRoutes from '../routes/pdf';
import type { InvoicePdfRequest } from '../services/pdf/invoicePdf';

function makePayload(count: number): InvoicePdfRequest {
  return {
    invoiceTitle: 'Route QA',
    dateMode: 'enabled',
    showKeteranganColumn: true,
    formData: {
      tanggalSurat: 'Manado, 08 Juli 2026',
      nomorInvoice: 'INV/ROUTE/001',
      namaPenerima: 'Customer Route',
      lokasiPenerima: 'Jakarta',
      biayaKirimDoc: 0,
      penandatanganKiri: 'Janti Feine Rundengan',
      penandatanganKanan: 'Customer Route',
    },
    selectedSignatureKiri: null,
    selectedSignatureKanan: null,
    transactions: Array.from({ length: count }, (_, index) => ({
      tanggal: '2026-07-08',
      noResi: `737${String(index + 1).padStart(3, '0')}`,
      pengirim: `Pengirim ${index + 1}`,
      penerima: `Penerima ${index + 1}`,
      coly: 1,
      berat: 12,
      min: 10,
      tarif: 15000,
      total: 180000,
      keterangan: '',
    })),
  };
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/pdf', pdfRoutes);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

(async () => {
  await withServer(async (baseUrl) => {
    const empty = await fetch(`${baseUrl}/api/pdf/invoice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...makePayload(1), transactions: [] }),
    });
    assert.equal(empty.status, 400);

    const invoice = await fetch(`${baseUrl}/api/pdf/invoice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(makePayload(90)),
    });
    const invoicePdf = Buffer.from(await invoice.arrayBuffer());
    assert.equal(invoice.status, 200);
    assert.match(invoice.headers.get('content-type') || '', /^application\/pdf/);
    assert.equal(invoicePdf.subarray(0, 4).toString('utf8'), '%PDF');

    const transaksi = await fetch(`${baseUrl}/api/pdf/transactions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Route Transactions', dateMode: 'enabled', showKeteranganColumn: true, transactions: makePayload(120).transactions }),
    });
    const transaksiPdf = Buffer.from(await transaksi.arrayBuffer());
    assert.equal(transaksi.status, 200);
    assert.match(transaksi.headers.get('content-type') || '', /^application\/pdf/);
    assert.equal(transaksiPdf.subarray(0, 4).toString('utf8'), '%PDF');
  });

  console.log('pdf-route check passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
