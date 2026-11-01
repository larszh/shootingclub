/**
 * Demo-Daten für Website-Widgets (prisma/seed.ts). Nur relative Imports, kein "server-only".
 * Idempotent: setzt den Embed-Token des Demo-Vereins nur, wenn noch keiner existiert.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";

type Db = Pick<PrismaClient, "tenant">;

export async function seedDemoEmbed(db: Db, tenantId: string, _userIds: string[] = []) {
  void _userIds;
  const token = randomBytes(32).toString("base64url");
  await db.tenant.updateMany({ where: { id: tenantId, embedToken: null }, data: { embedToken: token } });
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { embedToken: true } });
  return { embedToken: t?.embedToken ?? null };
}
