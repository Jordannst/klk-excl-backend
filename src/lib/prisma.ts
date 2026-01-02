import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client to prevent multiple instances
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    const dbUrl = process.env.DATABASE_URL || '';
    // Mask the password in the URL for security
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
    console.log('✅ Database connection successful!');
    console.log(`📍 Connected to: ${maskedUrl.substring(0, 80)}...`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error('Error:', error instanceof Error ? error.message : error);
    return false;
  }
}
