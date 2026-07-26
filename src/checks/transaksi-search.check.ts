import assert from 'assert';
import express from 'express';
import transaksiRoutes from '../routes/transaksi';
import { prisma } from '../lib/prisma';

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/transaksi', transaksiRoutes); // no auth middleware: checks the route logic itself
  const server = app.listen(0);
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
    const trashed = await prisma.invoice.create({
      data: {
        title: `chk-trash-${stamp}`,
        deletedAt: new Date(),
        transactions: {
          create: [{ pengirim: 'CHK', penerima: 'CHK', coly: 1, berat: 1, min: 1, tarif: 0, total: 0, noResi: resiTrash }],
        },
      },
    });
    invoiceIds.push(active.id, trashed.id);

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

    console.log('transaksi-search check passed');
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
