import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { postgresConnectionOptions } from './postgres-connection';

// Create a singleton Prisma client to prevent multiple instances
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const { schema, ...pool } = postgresConnectionOptions(process.env.DATABASE_URL, process.env);
  const adapter = new PrismaPg(pool, { schema });
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
