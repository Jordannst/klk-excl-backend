import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'test' && !process.env.TEST_DATABASE_URL) config({ quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: { url: process.env.DATABASE_URL },
});
