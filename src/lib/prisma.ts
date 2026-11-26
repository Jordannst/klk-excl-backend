import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';

// Create a singleton Prisma client to prevent multiple instances
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !URL.canParse(connectionString)) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Unsupported DATABASE_URL protocol');
  const params = url.searchParams;

  // Keep the connection limits from existing Prisma URLs when moving to pg.Pool.
  const max = params.has('connection_limit') ? Number(params.get('connection_limit')) : 10;
  const timeout = Number(params.get('pool_timeout') ?? params.get('connect_timeout') ?? '5');
  if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(timeout) || timeout < 0) {
    throw new Error('Invalid PostgreSQL connection limit or timeout');
  }
  const legacyCa = params.get('sslcert');
  if (legacyCa && !params.has('sslkey') && !params.has('sslrootcert')) {
    // Prisma's sslcert identifies the server CA relative to prisma/schema.prisma.
    params.set('sslrootcert', resolve(__dirname, '../../prisma', legacyCa));
    params.delete('sslcert');
  }
  if (/\.supabase\.(co|com)$/i.test(url.hostname) && !process.env.PGSSLMODE && !params.has('sslmode') && !params.has('ssl')) {
    params.set('sslmode', 'verify-full');
  }

  const adapter = new PrismaPg(
    { connectionString: url.toString(), max, connectionTimeoutMillis: timeout * 1000 },
    { schema: params.get('schema') ?? 'public' },
  );
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error instanceof Error ? error.message : error);
    return false;
  }
}
