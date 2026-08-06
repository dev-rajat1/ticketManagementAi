import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'ADMIN_EMAIL';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ADMIN_PASS';
  const adminHash = await bcrypt.hash(adminPassword, 12);

  console.log(`🚀 Seeding database... Target Admin: ${adminEmail}`);

  // 1. Clean up extra ADMINS (keeping only the seed email) for security consistency
  const deleted = await prisma.user.deleteMany({
    where: {
      role: 'ADMIN',
      NOT: {
        email: adminEmail
      }
    }
  });

  if (deleted.count > 0) {
    console.log(`🗑️ Deleted ${deleted.count} extra admin(s).`);
  }

  // 2. Upsert the Primary Admin
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { 
      passwordHash: adminHash,
      role: 'ADMIN',
      isActive: true
    },
    create: { 
      email: adminEmail, 
      name: 'System Admin', 
      passwordHash: adminHash, 
      role: 'ADMIN',
      isActive: true
    },
  });

  console.log('✅ Seed data sync complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
