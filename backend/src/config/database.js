/**
 * @fileoverview Prisma client singleton instance.
 * Ensures a single PrismaClient is reused across the application,
 * preventing connection pool exhaustion during hot reloads.
 * @module config/database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

/**
 * Gracefully disconnect Prisma on process termination.
 */
const gracefulShutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

export default prisma;
