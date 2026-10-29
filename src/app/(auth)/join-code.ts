import "server-only";
import { db } from "@/lib/db";
import { clientIp, throttle, THROTTLE } from "@/lib/auth";
import { tenantLogoUrl } from "@/components/avatar";

/** Normalisiert einen Beitrittscode aus der URL (nur Buchstaben/Ziffern, max. 12). */
export function normalizeJoinCode(raw: string | string[] | undefined) {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9]{4,12}$/.test(v) ? v : null;
}

/**
 * Name und Logo des Vereins zu einem Beitrittscode (nur zur Anzeige, keine weiteren Daten).
 * Pro IP gedrosselt, damit die Vorschau nicht zum Durchprobieren von Codes taugt;
 * bei Überschreitung entfällt nur die Vorschau, der Beitritt selbst ist separat gedrosselt.
 */
export async function lookupJoinTenant(code: string | null) {
  if (!code) return null;
  const limited = throttle(`join-preview-ip:${await clientIp()}`, THROTTLE.joinCode.limit * 3, THROTTLE.joinCode.windowMs);
  if (limited) return null;
  const t = await db.tenant.findFirst({ where: { joinCode: code, deletedAt: null }, select: { id: true, name: true, city: true, logoPath: true, updatedAt: true } });
  if (!t) return null;
  return { name: t.name, city: t.city, logoUrl: tenantLogoUrl(t) };
}
