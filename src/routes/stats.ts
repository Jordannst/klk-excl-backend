import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

interface DbSizeResult {
  size: bigint;
}

/**
 * GET /api/stats
 * Get database statistics including storage usage
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    // Get database size using PostgreSQL function
    const dbSizeResult = await prisma.$queryRaw<DbSizeResult[]>`
      SELECT pg_database_size(current_database()) as size
    `;
    
    const dbSizeBytes = Number(dbSizeResult[0]?.size || 0);
    const dbSizeMB = dbSizeBytes / (1024 * 1024);
    
    // Get invoice count
    const invoiceCount = await prisma.invoice.count();
    
    // Storage limit (Supabase free tier)
    const storageLimitMB = 500;
    const usagePercent = (dbSizeMB / storageLimitMB) * 100;

    res.json({
      database: {
        sizeBytes: dbSizeBytes,
        sizeMB: Math.round(dbSizeMB * 100) / 100,
        limitMB: storageLimitMB,
        usagePercent: Math.round(usagePercent * 100) / 100,
      },
      counts: {
        invoices: invoiceCount,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
