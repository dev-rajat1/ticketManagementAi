import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, name: true }
  });
  console.log('Admins found:', JSON.stringify(admins, null, 2));
}

main().finally(() => prisma.$disconnect());
