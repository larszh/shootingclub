import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Client = typeof db | Prisma.TransactionClient;

/**
 * Personendaten (Name, E-Mail, Telefon, Geburtsdatum, Adresse) gehören der Person, nicht dem Verein.
 * Ein Verein darf sie nur ändern (und Zugangsmails an eine geänderte Adresse schicken), wenn er das
 * Konto allein verwaltet: kein eigenes Passwort, nicht gelöscht und keine weitere Mitgliedschaft
 * (ausser «ausgetreten») in einem anderen, nicht gelöschten Verein.
 */
export async function profileManagedByTenant(userId: string, tenantId: string, client: Client = db): Promise<boolean> {
  const u = await client.user.findUnique({ where: { id: userId }, select: { passwordSetAt: true, deletedAt: true } });
  if (!u || u.passwordSetAt || u.deletedAt) return false;
  const elsewhere = await client.membership.count({
    where: { userId, tenantId: { not: tenantId }, status: { not: "LEFT" }, tenant: { deletedAt: null } },
  });
  return elsewhere === 0;
}

/** Wie profileManagedByTenant für viele Konten auf einmal (Menge der allein verwalteten userIds). */
export async function profilesManagedByTenant(userIds: string[], tenantId: string, client: Client = db): Promise<Set<string>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return new Set();
  const [users, others] = await Promise.all([
    client.user.findMany({ where: { id: { in: ids }, passwordSetAt: null, deletedAt: null }, select: { id: true } }),
    client.membership.findMany({
      where: { userId: { in: ids }, tenantId: { not: tenantId }, status: { not: "LEFT" }, tenant: { deletedAt: null } },
      select: { userId: true },
    }),
  ]);
  const shared = new Set(others.map((o) => o.userId));
  return new Set(users.map((u) => u.id).filter((id) => !shared.has(id)));
}
