import assert from 'assert';
import express from 'express';

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const { default: pdfSpikeRoutes } = await import('../routes/pdfSpike');
  const app = express();
  app.use('/api/pdf-spike', pdfSpikeRoutes);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

(async () => {
  delete process.env.PDF_SPIKE_ENABLED;
  delete process.env.PDF_SPIKE_TOKEN;

  await withServer(async (baseUrl) => {
    const disabled = await fetch(`${baseUrl}/api/pdf-spike`);
    assert.equal(disabled.status, 404, 'missing env must disable spike endpoint');
  });

  process.env.PDF_SPIKE_ENABLED = 'true';
  process.env.PDF_SPIKE_TOKEN = 'secret-spike-token';

  await withServer(async (baseUrl) => {
    const wrongToken = await fetch(`${baseUrl}/api/pdf-spike`, {
      headers: { 'x-pdf-spike-token': 'wrong' },
    });
    assert.equal(wrongToken.status, 403, 'wrong token must be forbidden');

    const ok = await fetch(`${baseUrl}/api/pdf-spike`, {
      headers: { 'x-pdf-spike-token': 'secret-spike-token' },
    });
    const pdf = Buffer.from(await ok.arrayBuffer());

    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type') || '', /^application\/pdf/);
    assert.equal(pdf.subarray(0, 4).toString('utf8'), '%PDF');
  });

  console.log('pdf-spike-route check passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
