import assert from 'assert';
import { generatePdfSpikePdf } from '../services/pdfSpikeHtml';

(async () => {
  const pdf = await generatePdfSpikePdf();

  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 10_000, `expected non-trivial PDF, got ${pdf.length} bytes`);
  assert.equal(pdf.subarray(0, 4).toString('utf8'), '%PDF');

  console.log(`pdf-spike-generate check passed (${pdf.length} bytes)`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
