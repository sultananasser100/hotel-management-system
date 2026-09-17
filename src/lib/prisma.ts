import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Next.js dev mode hot-reloads server modules on every file save, which would
// otherwise create a new PrismaClient (and a new DB connection pool) each time.
// Caching the instance on `globalThis` survives the reload; in production a
// fresh module registry means this only ever runs once anyway.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma 7's default "prisma-client" generator has no bundled query engine —
// it always connects through an explicit driver adapter.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
