import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Keep the main admin and delete others with role ADMIN
  const mainAdminEmail = 'admin@smartsupport.com';
  
  const deleted = await prisma.user.deleteMany({
    where: {
      role: 'ADMIN',
      NOT: {
        email: mainAdminEmail
      }
    }
  });
  
  console.log(`Deleted ${deleted.count} extra admin(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
