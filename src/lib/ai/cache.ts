import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/** Stabiler Schlüssel aus beliebigen Teilen (sha256, hex, 64 Zeichen). */
export function aiCacheKey(...parts: Array<string | number | null | undefined>): string {
  return createHash("sha256").update(parts.map((p) => String(p ?? "")).join("\u001f")).digest("hex");
}

/** Gespeicherte Antwort, falls vorhanden und nicht abgelaufen. */
export async function getAiCache(feature: string, cacheKey: string, now: Date = new Date()): Promise<string | null> {
  const row = await db.aiCache.findUnique({ where: { feature_cacheKey: { feature, cacheKey } }, select: { value: true, expiresAt: true } });
  if (!row || row.expiresAt <= now) return null;
  return row.value;
}

export async function setAiCache(input: { feature: string; cacheKey: string; value: string; ttlMs: number; tenantId?: string | null; userId?: string | null }): Promise<void> {
  const expiresAt = new Date(Date.now() + Math.max(1000, input.ttlMs));
  await db.aiCache.upsert({
    where: { feature_cacheKey: { feature: input.feature, cacheKey: input.cacheKey } },
    create: { feature: input.feature, cacheKey: input.cacheKey, value: input.value, expiresAt, tenantId: input.tenantId ?? null, userId: input.userId ?? null },
    update: { value: input.value, expiresAt, tenantId: input.tenantId ?? null, userId: input.userId ?? null },
  });
}

/** Löscht abgelaufene Einträge (für einen Aufräum-Job). Gibt die Anzahl zurück. */
export async function purgeExpiredAiCache(now: Date = new Date()): Promise<number> {
  const res = await db.aiCache.deleteMany({ where: { expiresAt: { lte: now } } });
  return res.count;
}

/** sha256 eines Quelltexts (für ContentTranslation.sourceHash). */
export function sourceHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
