import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { prisma, testDatabaseConnection } from './lib/prisma';
import transaksiRoutes from './routes/transaksi';
import invoiceRoutes from './routes/invoice';
import authRoutes from './routes/auth';
import { authMiddleware } from './middleware/auth.middleware';
import { apiRateLimiter } from './middleware/rateLimit';

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Health check endpoint (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes - require authentication
app.use('/api/transaksi', authMiddleware, transaksiRoutes);
app.use('/api/invoice', authMiddleware, invoiceRoutes);

// Start server
app.listen(config.port, async () => {
  console.log(`🚀 Server is running on http://localhost:${config.port}`);
  console.log(`📦 Environment: ${config.nodeEnv}`);
  console.log(`🔐 Authentication: ENABLED`);
  
  // Test database connection
  console.log('\n🔌 Testing database connection...');
  await testDatabaseConnection();
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

