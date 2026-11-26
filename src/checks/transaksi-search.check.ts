import assert from 'assert';
import express from 'express';
import { invoiceDateModes, toPrismaInvoiceDateMode } from '../lib/invoice-date-mode';

async function main() {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl || !URL.canParse(testUrl)) throw new Error('Set TEST_DATABASE_URL to a dedicated local klk_test database');
  const target = new URL(testUrl);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)
    || !/^\/klk_test(?:_[a-z0-9_]+)?$/.test(target.pathname)
    || target.search || target.hash) {
    throw new Error('TEST_DATABASE_URL must name a local klk_test database without URL options');
  }
  process.env.DATABASE_URL = testUrl;
  const { prisma } = await import('../lib/prisma');
  const { default: transaksiRoutes } = await import('../routes/transaksi');
  const { default: invoiceRoutes } = await import('../routes/invoice');
  const app = express();
  app.use(express.json());
  app.use('/api/transaksi', transaksiRoutes); // no auth middleware: checks the route logic itself
  app.use('/api/invoice', invoiceRoutes);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}/api/transaksi`;

  const stamp = Date.now();
  const resiActive = `ZZCHK${stamp}A`;
  const resiTrash = `ZZCHK${stamp}T`;
  const invoiceIds: number[] = [];

  try {
    const active = await prisma.invoice.create({
      data: {
        title: `chk-active-${stamp}`,
        transactions: {
          create: [{ pengirim: 'CHK', penerima: 'CHK', coly: 1, berat: 1, min: 1, tarif: 0, total: 0, noResi: resiActive }],
        },
      },
    });
    invoiceIds.push(active.id);
    const trashed = await prisma.invoice.create({
      data: {
        title: `chk-trash-${stamp}`,
        deletedAt: new Date(),
        transactions: {
          create: [{ pengirim: 'CHK', penerima: 'CHK', coly: 1, berat: 1, min: 1, tarif: 0, total: 0, noResi: resiTrash }],
        },
      },
    });
    invoiceIds.push(trashed.id);

    // Prisma uses schema enum names, while PostgreSQL and the HTTP API use mapped values.
    for (const mode of invoiceDateModes) {
      await prisma.invoice.update({ where: { id: active.id }, data: { dateMode: toPrismaInvoiceDateMode(mode) } });
      const stored = await prisma.$queryRaw<Array<{ mode: string }>>`SELECT "dateMode"::text AS mode FROM "Invoice" WHERE id = ${active.id}`;
      assert.equal(stored[0].mode, mode);
      const response = await fetch(`http://127.0.0.1:${port}/api/invoice/${active.id}`);
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as { dateMode: string }).dateMode, mode);
    }

    // partial, case-insensitive match reaches the search route (not /:id)
    const partial = await fetch(`${base}/search?q=zzchk${stamp}`);
    assert.equal(partial.status, 200, 'search route must win over /:id');
    const partialBody = (await partial.json()) as {
      results: Array<{ noResi: string; invoice: { id: number; title: string; deletedAt: string | null } }>;
    };
    const resis = partialBody.results.map((r) => r.noResi).sort();
    assert.deepEqual(resis, [resiActive, resiTrash].sort(), 'partial match must find both rows');

    const trashHit = partialBody.results.find((r) => r.noResi === resiTrash);
    assert.ok(trashHit && trashHit.invoice.deletedAt !== null, 'trashed hit must carry invoice.deletedAt');
    const activeHit = partialBody.results.find((r) => r.noResi === resiActive);
    assert.ok(
      activeHit && activeHit.invoice.deletedAt === null && activeHit.invoice.id === active.id,
      'active hit must carry its invoice id'
    );

    // full-resi match
    const full = await fetch(`${base}/search?q=${resiActive}`);
    assert.equal(full.status, 200);
    assert.equal(((await full.json()) as { results: unknown[] }).results.length, 1, 'full resi must match exactly one row');

    // no match
    const none = await fetch(`${base}/search?q=ZZNOPE${stamp}`);
    assert.equal(none.status, 200);
    assert.equal(((await none.json()) as { results: unknown[] }).results.length, 0, 'no match must return empty list');

    // short q rejected
    const short = await fetch(`${base}/search?q=ZZ`);
    assert.equal(short.status, 400, 'short query must be rejected');

    const created = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        invoiceId: active.id, noResi: resiTrash, tanggal: '2026-01-01', pengirim: 'CHK', penerima: 'CHK',
        coly: 1, berat: 1, min: 1, tarif: 23, total: 23,
      }),
    });
    assert.equal(created.status, 201, 'a receipt from another invoice must be accepted');
    const updated = await prisma.invoice.findUniqueOrThrow({ where: { id: active.id } });
    assert.equal(updated.count, active.count + 1);
    assert.equal(updated.total, active.total + 23);

    console.log('transaksi-search and invoice date mode checks passed');
  } finally {
    await prisma.transaksi.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.$disconnect();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
