import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Entwicklung: SQLite über better-sqlite3.
// Produktion (PostgreSQL): Adapter gegen `@prisma/adapter-pg` tauschen und in
// prisma/schema.prisma `provider = "postgresql"` setzen. Der Rest des Codes
// bleibt unverändert, da das Schema ohne Enums/Json auskommt.
function createClient() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
