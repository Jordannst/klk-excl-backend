import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import {
  fromPrismaInvoiceDateMode,
  normalizeTransactionDate,
  type InvoiceDateMode,
} from '../lib/invoice-date-mode';
import { prisma } from '../lib/prisma';

const router = Router();

function parseRequiredInt(value: unknown, fieldName: string): number {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} must be a valid integer`);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`${fieldName} must be a valid integer`);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be a valid integer`);
  }

  return parsed;
}

function parseRequiredNonNegativeInt(value: unknown, fieldName: string): number {
  const parsed = parseRequiredInt(value, fieldName);

  if (parsed < 0) {
    throw new Error(`${fieldName} must be greater than or equal to 0`);
  }

  return parsed;
}

function parseRequiredPositiveInt(value: unknown, fieldName: string): number {
  const parsed = parseRequiredInt(value, fieldName);

  if (parsed <= 0) {
    throw new Error(`${fieldName} must be greater than 0`);
  }

  return parsed;
}

function parseOptionalInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredInt(value, fieldName);
}

function parseOptionalNonNegativeInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredNonNegativeInt(value, fieldName);
}

function parseOptionalPositiveInt(value: unknown, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredPositiveInt(value, fieldName);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function parseMinValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 10;
  }

  return parseRequiredPositiveInt(value, 'min');
}

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
    if (!isNonEmptyString(pengirim) || !isNonEmptyString(penerima) || coly === undefined || berat === undefined || total === undefined) {
      res.status(400).json({ error: 'Missing required fields: pengirim, penerima, coly, berat, total' });
      return;
    }

    let normalizedInvoiceId: number | null = null;
    if (invoiceId !== undefined && invoiceId !== null && invoiceId !== '') {
      normalizedInvoiceId = Number(invoiceId);

      if (!Number.isInteger(normalizedInvoiceId) || normalizedInvoiceId <= 0) {
        res.status(400).json({ error: 'invoiceId must be a valid positive integer' });
        return;
      }
    }

    let invoiceDateMode: InvoiceDateMode = 'enabled';

    if (normalizedInvoiceId) {
      const existingInvoice = await prisma.invoice.findUnique({
        where: { id: normalizedInvoiceId },
        select: {
          id: true,
          dateMode: true,
          deletedAt: true,
        },
      });

      if (!existingInvoice || existingInvoice.deletedAt !== null) {
        res.status(404).json({ error: 'Invoice not found' });
        return;
      }

      invoiceDateMode = fromPrismaInvoiceDateMode(existingInvoice.dateMode);
    }

    let normalizedTanggal: Date | null;
    let parsedColy: number;
    let parsedBerat: number;
    let parsedMin: number;
    let parsedTarif: number;
    let parsedTotal: number;
    try {
      normalizedTanggal = normalizeTransactionDate(tanggal, invoiceDateMode);
      parsedColy = parseRequiredPositiveInt(coly, 'coly');
      parsedBerat = parseRequiredPositiveInt(berat, 'berat');
      parsedMin = parseMinValue(min);
      parsedTarif = tarif === undefined || tarif === null || tarif === '' ? 0 : parseRequiredNonNegativeInt(tarif, 'tarif');
      parsedTotal = parseRequiredNonNegativeInt(total, 'total');
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid transaction payload' });
      return;
    }

    const newTransaksi = await prisma.$transaction(async (tx) => {
      const createdTransaksi = await tx.transaksi.create({
        data: {
          tanggal: normalizedTanggal,
          pengirim,
          penerima,
          coly: parsedColy,
          berat: parsedBerat,
          min: parsedMin,
          tarif: parsedTarif,
          total: parsedTotal,
          noResi: noResi.trim(),
          keterangan: keterangan || null,
          invoiceId: normalizedInvoiceId,
        },
      });

      if (normalizedInvoiceId) {
        await tx.invoice.update({
          where: { id: normalizedInvoiceId },
          data: {
            total: {
              increment: createdTransaksi.total,
            },
            count: {
              increment: 1,
            },
          },
        });
      }

      return createdTransaksi;
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
      include: {
        invoice: {
          select: { dateMode: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    const { tanggal, pengirim, penerima, coly, berat, min, tarif, total, noResi, keterangan } = req.body;

    // Build update data with only provided fields
    const updateData: Prisma.TransaksiUpdateInput = {};

    if (tanggal !== undefined) {
      try {
        const invoiceDateMode = existing.invoice
          ? fromPrismaInvoiceDateMode(existing.invoice.dateMode)
          : 'enabled';
        updateData.tanggal = normalizeTransactionDate(tanggal, invoiceDateMode);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid tanggal value' });
        return;
      }
    }
    if (pengirim !== undefined) {
      if (!isNonEmptyString(pengirim)) {
        res.status(400).json({ error: 'pengirim must be a non-empty string' });
        return;
      }
      updateData.pengirim = pengirim.trim();
    }
    if (penerima !== undefined) {
      if (!isNonEmptyString(penerima)) {
        res.status(400).json({ error: 'penerima must be a non-empty string' });
        return;
      }
      updateData.penerima = penerima.trim();
    }

    try {
      const parsedColy = parseOptionalPositiveInt(coly, 'coly');
      const parsedBerat = parseOptionalPositiveInt(berat, 'berat');
      const parsedMin = min !== undefined ? parseMinValue(min) : undefined;
      const parsedTarif = parseOptionalNonNegativeInt(tarif, 'tarif');
      const parsedTotal = parseOptionalNonNegativeInt(total, 'total');

      if (parsedColy !== undefined) updateData.coly = parsedColy;
      if (parsedBerat !== undefined) updateData.berat = parsedBerat;
      if (parsedMin !== undefined) updateData.min = parsedMin;
      if (parsedTarif !== undefined) updateData.tarif = parsedTarif;
      if (parsedTotal !== undefined) updateData.total = parsedTotal;
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid numeric value' });
      return;
    }
    if (noResi !== undefined) {
      if (typeof noResi !== 'string' || noResi.trim() === '') {
        res.status(400).json({ error: 'noResi is required and must be a non-empty string' });
        return;
      }
      updateData.noResi = noResi.trim();
    }
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
