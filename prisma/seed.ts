import { prisma } from '../src/lib/prisma';
import * as bcrypt from 'bcrypt';

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  console.log('🌱 Seeding database...');

  // Check if admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { username: adminUsername },
  });

  if (existingUser) {
    console.log(`✅ Admin user "${adminUsername}" already exists. Skipping...`);
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('Set ADMIN_PASSWORD before creating the admin user');

  // Hash password
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Create admin user
  const user = await prisma.user.create({
    data: {
      username: adminUsername,
      password: hashedPassword,
    },
  });

  console.log(`✅ Admin user "${user.username}" created.`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
