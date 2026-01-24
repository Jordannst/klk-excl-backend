import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface CreateSignatureBody {
  label: string;
  imageData: string; // Base64 encoded PNG
}

// ============================================================================
// GET /api/signature - Get all signatures
// ============================================================================
router.get('/', async (_req: Request, res: Response) => {
  try {
    const signatures = await prisma.signature.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        imageData: true,
        createdAt: true,
      },
    });

    res.json(signatures);
  } catch (error) {
    console.error('Error fetching signatures:', error);
    res.status(500).json({ error: 'Failed to fetch signatures' });
  }
});

// ============================================================================
// POST /api/signature - Create a new signature
// ============================================================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const { label, imageData } = req.body as CreateSignatureBody;

    // Validation
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return res.status(400).json({ error: 'Label is required' });
    }

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Validate base64 PNG format
    if (!imageData.startsWith('data:image/png;base64,')) {
      return res.status(400).json({ error: 'Image must be a base64 encoded PNG' });
    }

    // Check label uniqueness (optional but helpful)
    const existingSignature = await prisma.signature.findFirst({
      where: { label: label.trim() },
    });

    if (existingSignature) {
      return res.status(409).json({ error: 'A signature with this label already exists' });
    }

    const signature = await prisma.signature.create({
      data: {
        label: label.trim(),
        imageData,
      },
      select: {
        id: true,
        label: true,
        imageData: true,
        createdAt: true,
      },
    });

    res.status(201).json(signature);
  } catch (error) {
    console.error('Error creating signature:', error);
    res.status(500).json({ error: 'Failed to create signature' });
  }
});

// ============================================================================
// DELETE /api/signature/:id - Delete a signature
// ============================================================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if signature exists
    const signature = await prisma.signature.findUnique({
      where: { id },
    });

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    await prisma.signature.delete({
      where: { id },
    });

    res.json({ message: 'Signature deleted successfully', id });
  } catch (error) {
    console.error('Error deleting signature:', error);
    res.status(500).json({ error: 'Failed to delete signature' });
  }
});

export default router;
