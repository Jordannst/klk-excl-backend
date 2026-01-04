import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/transaksi - Fetch latest 50 records (descending ID)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const transaksi = await prisma.transaksi.findMany({
      take: 50,
      orderBy: {
        id: 'desc',
      },
    });
    res.json(transaksi);
  } catch (error) {
    console.error('Error fetching transaksi:', error);
    res.status(500).json({ error: 'Failed to fetch transaksi data' });
  }
});

// GET /api/transaksi/:id - Get single transaction
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaksiId = parseInt(id, 10);

    if (isNaN(transaksiId)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const transaksi = await prisma.transaksi.findUnique({
      where: { id: transaksiId },
    });

    if (!transaksi) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json(transaksi);
  } catch (error) {
    console.error('Error fetching transaksi:', error);
    res.status(500).json({ error: 'Failed to fetch transaksi' });
  }
});

// POST /api/transaksi - Save new transaction data
router.post('/', async (req: Request, res: Response) => {
  try {
    const { tanggal, pengirim, penerima, coly, berat, min, tarif, total, noResi, keterangan, invoiceId } = req.body;

    // Validate noResi is present
    if (!noResi || typeof noResi !== 'string' || noResi.trim() === '') {
      res.status(400).json({ error: 'noResi is required and must be a non-empty string' });
      return;
    }

    // Validate required fields
    if (!tanggal || !pengirim || !penerima || coly === undefined || berat === undefined || total === undefined) {
      res.status(400).json({ error: 'Missing required fields: tanggal, pengirim, penerima, coly, berat, total' });
      return;
    }

    const newTransaksi = await prisma.transaksi.create({
      data: {
        tanggal: new Date(tanggal),
        pengirim,
        penerima,
        coly: Number(coly),
        berat: Number(berat),
        min: Number(min) || 10,
        tarif: Number(tarif) || 0,
        total: Number(total),
        noResi: noResi.trim(),
        keterangan: keterangan || null,
        invoiceId: invoiceId ? Number(invoiceId) : null,
      },
    });

    res.status(201).json(newTransaksi);
  } catch (error) {
    // Handle Prisma unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'noResi already exists. Receipt number must be unique.' });
        return;
      }
    }
    console.error('Error creating transaksi:', error);
    res.status(500).json({ error: 'Failed to create transaksi' });
  }
});

// PUT /api/transaksi/:id - Update transaction
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaksiId = parseInt(id, 10);

    if (isNaN(transaksiId)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Check if transaction exists
    const existing = await prisma.transaksi.findUnique({
      where: { id: transaksiId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const { tanggal, pengirim, penerima, coly, berat, min, tarif, total, noResi, keterangan } = req.body;

    // Build update data with only provided fields
    const updateData: Prisma.TransaksiUpdateInput = {};

    if (tanggal !== undefined) updateData.tanggal = new Date(tanggal);
    if (pengirim !== undefined) updateData.pengirim = pengirim;
    if (penerima !== undefined) updateData.penerima = penerima;
    if (coly !== undefined) updateData.coly = Number(coly);
    if (berat !== undefined) updateData.berat = Number(berat);
    if (min !== undefined) updateData.min = Number(min);
    if (tarif !== undefined) updateData.tarif = Number(tarif);
    if (total !== undefined) updateData.total = Number(total);
    if (noResi !== undefined) updateData.noResi = noResi.trim();
    if (keterangan !== undefined) updateData.keterangan = keterangan || null;

    const updatedTransaksi = await prisma.transaksi.update({
      where: { id: transaksiId },
      data: updateData,
    });

    // If this transaction belongs to an invoice, recalculate invoice total
    if (updatedTransaksi.invoiceId) {
      const invoiceTransactions = await prisma.transaksi.findMany({
        where: { invoiceId: updatedTransaksi.invoiceId },
      });
      const newTotal = invoiceTransactions.reduce((sum, t) => sum + t.total, 0);
      await prisma.invoice.update({
        where: { id: updatedTransaksi.invoiceId },
        data: { total: newTotal },
      });
    }

    res.json(updatedTransaksi);
  } catch (error) {
    // Handle Prisma unique constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'noResi already exists. Receipt number must be unique.' });
        return;
      }
    }
    console.error('Error updating transaksi:', error);
    res.status(500).json({ error: 'Failed to update transaksi' });
  }
});

// DELETE /api/transaksi/:id - Delete transaction
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaksiId = parseInt(id, 10);

    if (isNaN(transaksiId)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Check if transaction exists
    const existing = await prisma.transaksi.findUnique({
      where: { id: transaksiId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const invoiceId = existing.invoiceId;

    // Delete transaction
    await prisma.transaksi.delete({
      where: { id: transaksiId },
    });

    // If this transaction belonged to an invoice, recalculate invoice total and count
    if (invoiceId) {
      const remainingTransactions = await prisma.transaksi.findMany({
        where: { invoiceId },
      });
      
      if (remainingTransactions.length === 0) {
        // Delete empty invoice
        await prisma.invoice.delete({
          where: { id: invoiceId },
        });
      } else {
        const newTotal = remainingTransactions.reduce((sum, t) => sum + t.total, 0);
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { 
            total: newTotal,
            count: remainingTransactions.length,
          },
        });
      }
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaksi:', error);
    res.status(500).json({ error: 'Failed to delete transaksi' });
  }
});

export default router;
