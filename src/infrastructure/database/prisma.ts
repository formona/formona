import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type GlobalWithPrisma = typeof globalThis & {
  formonaPrisma?: PrismaClient;
};

const getDatabaseUrl = () => process.env.PRISMA_DATABASE_URL ?? process.env.POSTGRES_URL;

export const getPrisma = () => {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error('PRISMA_DATABASE_URL or POSTGRES_URL must be configured.');
  }

  const globalForPrisma = globalThis as GlobalWithPrisma;

  if (!globalForPrisma.formonaPrisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    globalForPrisma.formonaPrisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.formonaPrisma;
};
