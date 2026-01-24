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
    
    // Get counts
    const [invoiceCount, transactionCount, signatureCount] = await Promise.all([
      prisma.invoice.count({ where: { deletedAt: null } }), // Only active invoices
      prisma.transaksi.count(),
      prisma.signature.count(),
    ]);

    // Estimate signature storage (base64 images are typically 1.33x larger than binary)
    // Average signature PNG is around 5-15KB, base64 adds ~33% overhead
    const signatures = await prisma.signature.findMany({
      select: { imageData: true },
    });
    const signatureStorageBytes = signatures.reduce((sum, sig) => {
      return sum + (sig.imageData?.length || 0);
    }, 0);
    const signatureStorageKB = signatureStorageBytes / 1024;
    
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
        transactions: transactionCount,
        signatures: signatureCount,
      },
      storage: {
        signatureKB: Math.round(signatureStorageKB * 100) / 100,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

