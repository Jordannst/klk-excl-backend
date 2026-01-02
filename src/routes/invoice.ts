import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

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
    }
    const where: WhereClause = {};

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
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
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
    const data = invoices.map((inv) => ({
      id: inv.id,
      title: inv.title,
      createdAt: inv.createdAt,
      total: inv.total,
      count: inv._count.transactions,
    }));

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

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json({
      id: invoice.id,
      title: invoice.title,
      createdAt: invoice.createdAt,
      total: invoice.total,
      count: invoice.transactions.length,
      transactions: invoice.transactions,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST /api/invoice - Create invoice with batch transactions
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, transactions } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    // Validate transactions array
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ error: 'At least one transaction is required' });
      return;
    }

    // Validate each transaction
    for (const t of transactions) {
      if (!t.noResi || typeof t.noResi !== 'string' || t.noResi.trim() === '') {
        res.status(400).json({ error: 'Each transaction must have a valid noResi' });
        return;
      }
      if (!t.tanggal || !t.pengirim || !t.penerima) {
        res.status(400).json({ error: 'Missing required fields: tanggal, pengirim, penerima' });
        return;
      }
    }

    // Check for duplicate noResi in request
    const noResiList = transactions.map((t: { noResi: string }) => t.noResi.trim());
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
      const existingNoResi = existingTransactions.map((t) => t.noResi).join(', ');
      res.status(400).json({ error: `noResi already exists: ${existingNoResi}` });
      return;
    }

    // Calculate total
    const totalAmount = transactions.reduce((sum: number, t: { total: number }) => sum + Number(t.total), 0);

    // Create invoice with transactions in a transaction
    const invoice = await prisma.invoice.create({
      data: {
        title: title.trim(),
        total: totalAmount,
        count: transactions.length,
        transactions: {
          create: transactions.map((t: {
            tanggal: string;
            pengirim: string;
            penerima: string;
            coly: number;
            berat: number;
            min: number;
            tarif: number;
            total: number;
            noResi: string;
          }) => ({
            tanggal: new Date(t.tanggal),
            pengirim: t.pengirim,
            penerima: t.penerima,
            coly: Number(t.coly),
            berat: Number(t.berat),
            min: Number(t.min) || 10,
            tarif: Number(t.tarif) || 0,
            total: Number(t.total),
            noResi: t.noResi.trim(),
          })),
        },
      },
      include: {
        transactions: true,
      },
    });

    res.status(201).json({
      id: invoice.id,
      title: invoice.title,
      createdAt: invoice.createdAt,
      total: invoice.total,
      count: invoice.transactions.length,
      transactions: invoice.transactions,
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// PUT /api/invoice/:id - Update invoice title
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    if (!title || typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { title: title.trim() },
      include: {
        transactions: true,
      },
    });

    res.json({
      id: invoice.id,
      title: invoice.title,
      createdAt: invoice.createdAt,
      total: invoice.total,
      count: invoice.transactions.length,
      transactions: invoice.transactions,
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE /api/invoice/:id - Delete invoice and all its transactions
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoiceId = parseInt(id, 10);

    if (isNaN(invoiceId)) {
      res.status(400).json({ error: 'Invalid invoice ID' });
      return;
    }

    // Check if invoice exists
    const existing = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    // Delete invoice (cascade will delete transactions)
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;

