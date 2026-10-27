import { PrismaClient } from "@/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

/**
 * Datenbankverbindung zu MySQL / MariaDB.
 * DATABASE_URL im Format mysql://benutzer:passwort@host:3306/datenbank
 * (CloudPanel: Host 127.0.0.1, Port 3306, Zugangsdaten aus «Databases»).
 */
export function parseDatabaseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname || "127.0.0.1",
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    connectionLimit: Number(u.searchParams.get("connection_limit") ?? 5),
    timezone: "Z",
  };
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL fehlt (siehe .env.example)");
  const adapter = new PrismaMariaDb(parseDatabaseUrl(url));
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
