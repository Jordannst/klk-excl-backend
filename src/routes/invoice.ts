import { Prisma, InvoiceDateMode as PrismaInvoiceDateMode } from '@prisma/client';
import { Router, Request, Response } from 'express';
import {
  fromPrismaInvoiceDateMode,
  normalizeInvoiceDateMode,
  normalizeTransactionDate,
  toPrismaInvoiceDateMode,
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

function parseDateQueryParam(value: string, fieldName: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return parsed;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function parseMinValue(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  return parseRequiredPositiveInt(value, 'min');
}

function parseOptionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }

  return value;
}

function parseBooleanWithDefault(value: unknown, fieldName: string, defaultValue: boolean): boolean {
  const parsed = parseOptionalBoolean(value, fieldName);
  return parsed ?? defaultValue;
}

function toInvoiceResponse(invoice: {
  id: number;
  title: string;
  createdAt: Date;
  total: number;
  dateMode: PrismaInvoiceDateMode;
  showKeteranganColumn: boolean;
  transactions: Array<unknown>;
}) {
  return {
    id: invoice.id,
    title: invoice.title,
    createdAt: invoice.createdAt,
    total: invoice.total,
    count: invoice.transactions.length,
    dateMode: fromPrismaInvoiceDateMode(invoice.dateMode),
    showKeteranganColumn: invoice.showKeteranganColumn,
    transactions: invoice.transactions,
  };
}

function toInvoiceListResponse(invoice: {
  id: number;
  title: string;
  createdAt: Date;
  total: number;
  _count: { transactions: number };
  showKeteranganColumn: boolean;
}) {
  return {
    id: invoice.id,
    title: invoice.title,
    createdAt: invoice.createdAt,
    total: invoice.total,
    count: invoice._count.transactions,
    showKeteranganColumn: invoice.showKeteranganColumn,
  };
}

function hasKeteranganColumnField(value: unknown): value is { showKeteranganColumn?: unknown } {
  return typeof value === 'object' && value !== null && 'showKeteranganColumn' in value;
}

function hasDateModeField(value: unknown): value is { dateMode?: unknown } {
  return typeof value === 'object' && value !== null && 'dateMode' in value;
}

// GET /api/invoice - List all invoices (newest first) with pagination, search, and date filter
router.get('/', async (req: Request, res: Response) => {
  try {
    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    // Parse search param
    const search = (req.query.search as string) || '';

    // Parse date filter params
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build where clause
    interface WhereClause {
      title?: { contains: string; mode: 'insensitive' };
      createdAt?: { gte?: Date; lte?: Date };
      deletedAt?: null | { not: null };
    }
    const where: WhereClause = {
      deletedAt: null, // Only show active invoices (not soft-deleted)
    };

    // Add search filter
    if (search.trim()) {
      where.title = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    // Add date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      try {
        if (startDate) {
          where.createdAt.gte = parseDateQueryParam(startDate, 'startDate');
        }
        if (endDate) {
          const end = parseDateQueryParam(endDate, 'endDate');
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid date filter' });
        return;
      }
    }

    // Get total count with filters
    const total = await prisma.invoice.count({ where });

    // Get paginated invoices with filters
    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    // Map to include count properly
    const data = invoices.map((inv) => toInvoiceListResponse(inv));

    // Return paginated response
    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET /api/invoice/:id - Get invoice detail with transactions
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        transactions: {
          orderBy: { id: 'asc' },
        },
      },
    });

    // Check if invoice exists and is not soft-deleted
    if (!invoice || invoice.deletedAt !== null) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(toInvoiceResponse(invoice));
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoice - Create invoice with batch transactions
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, transactions } = req.body;

    let showKeteranganColumn: boolean;
    try {
      showKeteranganColumn = parseBooleanWithDefault(req.body.showKeteranganColumn, 'showKeteranganColumn', true);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid showKeteranganColumn value' });
      return;
    }

    // Validate title
    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    let dateMode: ReturnType<typeof normalizeInvoiceDateMode>;
    try {
      dateMode = normalizeInvoiceDateMode(req.body.dateMode);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid invoice date mode' });
      return;
    }

    // Validate transactions array
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ error: 'At least one transaction is required' });
      return;
    }

    type InvoiceTransactionInput = {
      tanggal?: string | null;
      pengirim: string;
      penerima: string;
      coly: number;
      berat: number;
      min: number;
      tarif: number;
      total: number;
      noResi: string;
      keterangan?: string | null;
    };

    const parsedTransactions: Array<{
      tanggal: Date | null;
      pengirim: string;
      penerima: string;
      coly: number;
      berat: number;
      min: number;
      tarif: number;
      total: number;
      noResi: string;
      keterangan: string | null;
    }> = [];

    // Validate each transaction
    for (const transaction of transactions as InvoiceTransactionInput[]) {
      if (!transaction.noResi || typeof transaction.noResi !== 'string' || transaction.noResi.trim() === '') {
        res.status(400).json({ error: 'Each transaction must have a valid noResi' });
        return;
      }

      if (!isNonEmptyString(transaction.pengirim) || !isNonEmptyString(transaction.penerima)) {
        res.status(400).json({ error: 'Missing required fields: pengirim, penerima' });
        return;
      }

      let normalizedTanggal: Date | null;
      try {
        normalizedTanggal = normalizeTransactionDate(transaction.tanggal, dateMode);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid tanggal value' });
        return;
      }

      let parsedColy: number;
      let parsedBerat: number;
      let parsedMin: number;
      let parsedTarif: number;
      let parsedTotal: number;

      try {
        parsedColy = parseRequiredPositiveInt(transaction.coly, 'coly');
        parsedBerat = parseRequiredPositiveInt(transaction.berat, 'berat');
        parsedMin = parseMinValue(transaction.min);
        parsedTarif = transaction.tarif === undefined || transaction.tarif === null
          ? 0
          : parseRequiredNonNegativeInt(transaction.tarif, 'tarif');
        parsedTotal = parseRequiredNonNegativeInt(transaction.total, 'total');
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid numeric transaction value' });
        return;
      }

      parsedTransactions.push({
        tanggal: normalizedTanggal,
        pengirim: transaction.pengirim,
        penerima: transaction.penerima,
        coly: parsedColy,
        berat: parsedBerat,
        min: parsedMin,
        tarif: parsedTarif,
        total: parsedTotal,
        noResi: transaction.noResi.trim(),
        keterangan: transaction.keterangan || null,
      });
    }

    // Check for duplicate noResi in request
    const noResiList = parsedTransactions.map((transaction) => transaction.noResi);
    const uniqueNoResi = new Set(noResiList);
    if (uniqueNoResi.size !== noResiList.length) {
      res.status(400).json({ error: 'Duplicate noResi found in transactions' });
      return;
    }

    // Check for existing noResi in database
    const existingTransactions = await prisma.transaksi.findMany({
      where: {
        noResi: { in: noResiList },
      },
      select: { noResi: true },
    });

    if (existingTransactions.length > 0) {
      const existingNoResi = existingTransactions.map((transaction) => transaction.noResi).join(', ');
      res.status(400).json({ error: `noResi already exists: ${existingNoResi}` });
      return;
    }

    // Calculate total
    const totalAmount = parsedTransactions.reduce((sum, transaction) => sum + transaction.total, 0);

    // Create invoice with transactions in a transaction
    const invoice = await prisma.invoice.create({
      data: {
        title: title.trim(),
        total: totalAmount,
        count: parsedTransactions.length,
        dateMode: toPrismaInvoiceDateMode(dateMode),
        showKeteranganColumn,
        transactions: {
          create: parsedTransactions,
        },
      },
      include: {
        transactions: true,
      },
    });

    res.status(201).json(toInvoiceResponse(invoice));
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoice/:id - Update invoice title and date mode
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    if (title === undefined && !hasDateModeField(req.body) && !hasKeteranganColumnField(req.body)) {
      res.status(400).json({ error: 'At least one updatable field is required' });
      return;
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        transactions: {
          select: { tanggal: true },
        },
      },
    });

    if (!existingInvoice || existingInvoice.deletedAt !== null) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const updateData: Prisma.InvoiceUpdateInput = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      updateData.title = title.trim();
    }

    if (hasDateModeField(req.body)) {
      let normalizedDateMode: ReturnType<typeof normalizeInvoiceDateMode>;
      try {
        normalizedDateMode = normalizeInvoiceDateMode(req.body.dateMode);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid invoice date mode' });
        return;
      }

      if (
        normalizedDateMode === 'enabled' &&
        existingInvoice.transactions.some((transaction) => transaction.tanggal === null)
      ) {
        res.status(400).json({
          error: 'tanggal is required for all transactions when date mode is enabled',
        });
        return;
      }

      updateData.dateMode = toPrismaInvoiceDateMode(normalizedDateMode);
    }

    if (hasKeteranganColumnField(req.body)) {
      let normalizedShowKeteranganColumn: boolean | undefined;
      try {
        normalizedShowKeteranganColumn = parseOptionalBoolean(req.body.showKeteranganColumn, 'showKeteranganColumn');
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid showKeteranganColumn value' });
        return;
      }

      if (normalizedShowKeteranganColumn !== undefined) {
        updateData.showKeteranganColumn = normalizedShowKeteranganColumn;
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updateData,
      include: {
        transactions: true,
      },
    });

    res.json(toInvoiceResponse(invoice));
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE /api/invoice/:id - Soft delete invoice (move to trash)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    // Check if invoice exists and is not already deleted
    const existing = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (existing.deletedAt !== null) {
      res.status(400).json({ error: 'Invoice is already in trash' });
      return;
    }

    // Soft delete: set deletedAt timestamp
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { deletedAt: new Date() },
    });

    res.json({ message: 'Invoice moved to trash successfully' });
  } catch (error) {
    console.error('Error soft deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// =============================================================================
// TRASH ENDPOINTS
// =============================================================================

// GET /api/invoice/trash - Get all soft-deleted invoices
router.get('/trash/list', async (req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        deletedAt: { not: null },
      },
      orderBy: {
        deletedAt: 'desc', // Most recently deleted first
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    const data = invoices.map((inv) => ({
      id: inv.id,
      title: inv.title,
      createdAt: inv.createdAt,
      deletedAt: inv.deletedAt,
      total: inv.total,
      count: inv._count.transactions,
    }));

    res.json({ data });
  } catch (error) {
    console.error('Error fetching trash:', error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

// POST /api/invoice/:id/restore - Restore invoice from trash
router.post('/:id/restore', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    // Check if invoice exists and is soft-deleted
    const existing = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (existing.deletedAt === null) {
      res.status(400).json({ error: 'Invoice is not in trash' });
      return;
    }

    // Restore: clear deletedAt
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { deletedAt: null },
    });

    res.json({ message: 'Invoice restored successfully' });
  } catch (error) {
    console.error('Error restoring invoice:', error);
    res.status(500).json({ error: 'Failed to restore invoice' });
  }
});

// DELETE /api/invoice/:id/permanent - Permanently delete invoice from trash
router.delete('/:id/permanent', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    // Check if invoice exists and is soft-deleted
    const existing = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    if (existing.deletedAt === null) {
      res.status(400).json({ error: 'Invoice must be in trash before permanent deletion. Move to trash first.' });
      return;
    }

    // Permanent delete (cascade will delete transactions)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    res.json({ message: 'Invoice permanently deleted' });
  } catch (error) {
    console.error('Error permanently deleting invoice:', error);
    res.status(500).json({ error: 'Failed to permanently delete invoice' });
  }
});

export default router;
