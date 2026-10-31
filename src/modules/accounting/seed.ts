/**
 * Demo-Kontenplan für den Seed (prisma/seed.ts). Nur relative Imports und kein "server-only",
 * damit tsx das Skript ausserhalb von Next.js ausführen kann. Idempotent: legt die Einstellungen
 * mit den Standardkonten (KMU-Kontenrahmen) nur an, wenn noch keine existieren. Die Buchungen selbst
 * entstehen aus den Demo-Rechnungen der Module Beiträge, Reservationen und Munition.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { DEFAULT_ACCOUNTS } from "./types";

type Db = Pick<PrismaClient, "accountingSettings">;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function seedDemoAccounting(db: Db, tenantId: string, _userIds?: string[]) {
  const existing = await db.accountingSettings.findUnique({ where: { tenantId } });
  if (existing) return { created: false };
  await db.accountingSettings.create({ data: { tenantId, ...DEFAULT_ACCOUNTS } });
  return { created: true };
}
