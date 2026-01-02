import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  console.log('🌱 Seeding database...');

  // Check if admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingUser) {
    console.log(`✅ Admin user "${adminUsername}" already exists. Skipping...`);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create admin user
  const user = await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
    },
  });

  console.log(`✅ Admin user created:`);
  console.log(`   Username: ${user.username}`);
  console.log(`   Password: ${adminPassword} (please change this!)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
