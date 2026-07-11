import { Router, Request, Response } from 'express';
import { generateInvoicePdf } from '../services/pdf/invoicePdf';
import { generateTransactionPdf } from '../services/pdf/transactionPdf';

const router = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInvoicePdfRequest(value: unknown): boolean {
  return isRecord(value) && isRecord(value.formData) && Array.isArray(value.transactions);
}

function isTransactionPdfRequest(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.transactions);
}

function sendPdf(res: Response, pdf: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdf.length.toString());
  res.send(pdf);
}

router.post('/invoice', (req: Request, res: Response) => {
  if (!isInvoicePdfRequest(req.body)) {
    res.status(400).json({ error: 'Invalid invoice PDF payload' });
    return;
  }

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
  if (!isTransactionPdfRequest(req.body)) {
    res.status(400).json({ error: 'Invalid transaction PDF payload' });
    return;
  }

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
