import puppeteer from 'puppeteer';

const ROW_COUNT = 90;

export function buildPdfSpikeHtml(): string {
  const rows = Array.from({ length: ROW_COUNT }, (_, index) => {
    const rowNumber = index + 1;
    const weight = 10 + (index % 9);
    const tariff = 12_500 + (index % 5) * 1_500;
    const total = weight * tariff;

    return `
      <tr>
        <td>${rowNumber}</td>
        <td>STT-${String(rowNumber).padStart(4, '0')}</td>
        <td>Pengirim ${rowNumber}</td>
        <td>Penerima ${rowNumber}</td>
        <td>${weight}</td>
        <td>Rp ${tariff.toLocaleString('id-ID')}</td>
        <td>Rp ${total.toLocaleString('id-ID')}</td>
      </tr>`;
  }).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>PDF Spike</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 4mm; }
    p { margin: 0 0 6mm; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead { display: table-header-group; }
    tfoot { display: table-row-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th, td { border: 1px solid #111827; padding: 6px 5px; line-height: 1.25; }
    th { background: #e5e7eb; font-weight: 700; text-align: center; }
    td:nth-child(1), td:nth-child(5) { text-align: center; }
    td:nth-child(6), td:nth-child(7) { text-align: right; }
    .keep-together { break-inside: avoid; page-break-inside: avoid; }
    .footer { margin-top: 12mm; display: flex; justify-content: space-between; font-size: 10px; }
    .signature { width: 42%; text-align: center; padding-top: 18mm; }
    .signature-line { border-top: 1px solid #111827; padding-top: 2mm; }
  </style>
</head>
<body>
  <section class="keep-together">
    <h1>PDF Spike</h1>
    <p>Dummy invoice table to validate Chromium PDF generation, page breaks, and repeated table headers.</p>
  </section>
  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>No STT</th>
        <th>Pengirim</th>
        <th>Penerima</th>
        <th>Kg</th>
        <th>Tarif</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
    <tfoot>
      <tr class="keep-together">
        <td colspan="6"><strong>TOTAL SPIKE</strong></td>
        <td><strong>Rp 99.999.999</strong></td>
      </tr>
    </tfoot>
  </table>
  <section class="footer keep-together">
    <div class="signature"><div class="signature-line">PT. KLK Mdc</div></div>
    <div class="signature"><div class="signature-line">Diketahui</div></div>
  </section>
</body>
</html>`;
}

export async function generatePdfSpikePdf(): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildPdfSpikeHtml(), { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
