import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  try {
    console.log("=== USERS IN SYSTEM ===");
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, isActive: true }
    });
    console.log(users);

    console.log("\n=== TICKETS IN SYSTEM ===");
    const tickets = await prisma.ticket.findMany({
      select: { id: true, ticketNumber: true, status: true, assignedToId: true }
    });
    console.log(tickets);

    // Let's test the calculations for an Admin
    const adminUser = users.find(u => u.role === 'ADMIN');
    const agentUser = users.find(u => u.role === 'AGENT');
    
    console.log("\n=== STATS CALCULATION FOR ADMIN ===");
    const adminStats = await getStatsForUser(adminUser);
    console.log("Admin Stats:", adminStats);

    if (agentUser) {
      console.log("\n=== STATS CALCULATION FOR AGENT ===");
      const agentStats = await getStatsForUser(agentUser);
      console.log("Agent Stats:", agentStats);
    } else {
      console.log("\nNo AGENT found in DB.");
    }
  } catch (err) {
    console.error("Error executing script:", err);
  } finally {
    await prisma.$disconnect();
  }
}

async function getStatsForUser(user) {
  if (!user) return null;
  const where = {};
  if (user.role === 'USER') {
    where.createdById = user.id;
  }

  const [
    total, open, inProgress, waiting, resolved, closed,
    assignedToMe, assignedToMeOpen, unassigned
  ] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: 'OPEN' } }),
    prisma.ticket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    prisma.ticket.count({ where: { ...where, status: 'WAITING' } }),
    prisma.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
    prisma.ticket.count({ where: { ...where, status: 'CLOSED' } }),
    prisma.ticket.count({ where: { assignedToId: user.id } }),
    prisma.ticket.count({ where: { assignedToId: user.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } } }),
    prisma.ticket.count({ where: { assignedToId: null, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);

  return { total, open, inProgress, waiting, resolved, closed, assignedToMe, assignedToMeOpen, unassigned };
}

run();
