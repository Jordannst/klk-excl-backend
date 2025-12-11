import express from 'express';
import cors from 'cors';
import { config } from './config';
import { prisma } from './lib/prisma';
import transaksiRoutes from './routes/transaksi';
import invoiceRoutes from './routes/invoice';

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/transaksi', transaksiRoutes);
app.use('/api/invoice', invoiceRoutes);

// Start server
app.listen(config.port, () => {
  console.log(` Server is running on http://localhost:${config.port}`);
  console.log(` Environment: ${config.nodeEnv}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
