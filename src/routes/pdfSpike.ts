import { Router, Request, Response } from 'express';
import { generatePdfSpikePdf } from '../services/pdfSpikeHtml';

const router = Router();

// GET /api/pdf-spike - Temporary guarded Chromium PDF deployment smoke test.
router.get('/', async (req: Request, res: Response) => {
  if (process.env.PDF_SPIKE_ENABLED !== 'true') {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const expectedToken = process.env.PDF_SPIKE_TOKEN;
  const providedToken = req.get('x-pdf-spike-token') || req.query.token;

  if (!expectedToken || providedToken !== expectedToken) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  try {
    const pdf = await generatePdfSpikePdf();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="pdf-spike.pdf"');
    res.setHeader('Content-Length', pdf.length.toString());
    res.send(pdf);
  } catch (error) {
    console.error('Error generating PDF spike:', error);
    res.status(500).json({ error: 'Failed to generate PDF spike' });
  }
});

export default router;
