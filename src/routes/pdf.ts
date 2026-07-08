import { Router, Request, Response } from 'express';
import { generateInvoicePdf } from '../services/pdf/invoicePdf';
import { generateTransactionPdf } from '../services/pdf/transactionPdf';

const router = Router();

function sendPdf(res: Response, pdf: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length.toString());
  res.send(pdf);
}

router.post('/invoice', (req: Request, res: Response) => {
  try {
    const pdf = generateInvoicePdf(req.body);
    sendPdf(res, pdf, 'invoice-klk.pdf');
  } catch (error) {
    if (error instanceof Error && error.message === 'At least one transaction is required') {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

router.post('/transactions', (req: Request, res: Response) => {
  try {
    const pdf = generateTransactionPdf(req.body);
    sendPdf(res, pdf, 'transaksi-klk.pdf');
  } catch (error) {
    if (error instanceof Error && error.message === 'At least one transaction is required') {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error('Error generating transaction PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
