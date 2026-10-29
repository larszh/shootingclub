import "server-only";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { deleteStoredFile } from "@/lib/storage";
import { getStorageForProvider, type StorageAdapter } from "@/lib/file-storage";
import { tenantKeyPrefix } from "@/lib/file-storage/keys";

/** Frist zwischen Löschantrag und endgültiger Löschung (Wiederherstellung möglich). */
export const TENANT_PURGE_GRACE_DAYS = 30;

/** Datum der endgültigen Löschung, gerechnet ab dem Löschantrag. */
export function purgeDateFrom(requestedAt: Date, graceDays: number = TENANT_PURGE_GRACE_DAYS): Date {
  return new Date(requestedAt.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

/**
 * Ist der Verein aktiv (nicht zur Löschung vorgemerkt)? Mitglieder dürfen gelöschte
 * Vereine nicht mehr sehen; getAppContext muss Tenants mit deletedAt herausfiltern.
 */
export function isTenantActive(t: { deletedAt: Date | null | undefined } | null | undefined): boolean {
  return !!t && !t.deletedAt;
}

function uploadRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.UPLOAD_DIR ?? "./storage/uploads");
}

/**
 * Entfernt alle gespeicherten Dateien eines Vereins (Dateiablage und Chat-Anhänge in allen
 * Speichern). Avatare gehören zum Benutzerkonto und bleiben. Fehler werden protokolliert und übersprungen.
 */
async function purgeTenantStorage(tenantId: string): Promise<{ files: number; failed: number }> {
  let failed = 0;
  const files = await db.storedFile.findMany({ where: { tenantId }, select: { id: true, provider: true, storageKey: true } });
  const adapters = new Map<string, StorageAdapter | null>();
  for (const f of files) {
    let adapter = adapters.get(f.provider);
    if (adapter === undefined) {
      try {
        adapter = await getStorageForProvider(tenantId, f.provider);
      } catch (e) {
        console.warn(`[tenant-purge] Speicher ${f.provider} für ${tenantId} nicht verfügbar:`, e instanceof Error ? e.message : e);
        adapter = null;
      }
      adapters.set(f.provider, adapter);
    }
    if (!adapter) {
      failed++;
      continue;
    }
    try {
      await adapter.delete(f.storageKey);
    } catch (e) {
      failed++;
      console.warn(`[tenant-purge] Datei ${f.id} (${f.provider}) nicht gelöscht:`, e instanceof Error ? e.message : e);
    }
  }

  // Lokales Vereinsverzeichnis vollständig entfernen (auch Reste ohne DB-Eintrag).
  try {
    const root = uploadRoot();
    const dir = path.resolve(root, tenantKeyPrefix(tenantId));
    if (dir.startsWith(root + path.sep)) await rm(dir, { recursive: true, force: true });
  } catch (e) {
    console.warn(`[tenant-purge] Lokales Verzeichnis für ${tenantId} nicht entfernt:`, e instanceof Error ? e.message : e);
  }
  return { files: files.length, failed };
}

/** Löscht einen Verein endgültig (Dateien, Logo, danach DB mit Cascade). */
export async function purgeTenantNow(tenantId: string): Promise<boolean> {
  const t = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true, name: true, logoPath: true } });
  if (!t) return false;
  const storage = await purgeTenantStorage(t.id);
  if (t.logoPath) {
    try {
      await deleteStoredFile(t.logoPath);
    } catch (e) {
      console.warn(`[tenant-purge] Logo von ${t.id} nicht gelöscht:`, e instanceof Error ? e.message : e);
    }
  }
  await db.tenant.delete({ where: { id: t.id } });
  await audit({
    tenantId: t.id,
    actorName: "System",
    action: "tenant.purge",
    entity: "Tenant",
    entityId: t.id,
    detail: `${t.name} (${t.slug}) endgültig gelöscht; ${storage.files} Dateien, ${storage.failed} nicht entfernt`,
  });
  return true;
}

/**
 * Hintergrundjob (täglich): löscht alle Vereine endgültig, deren Frist (purgeAfter) abgelaufen ist.
 * Gibt die Anzahl gelöschter Vereine zurück. Fehler bei einem Verein halten die anderen nicht auf.
 */
export async function purgeDeletedTenants(now: Date = new Date()): Promise<number> {
  const due = await db.tenant.findMany({
    where: { deletedAt: { not: null }, purgeAfter: { lt: now } },
    select: { id: true },
    take: 50,
  });
  let count = 0;
  for (const t of due) {
    try {
      if (await purgeTenantNow(t.id)) count++;
    } catch (e) {
      console.error(`[tenant-purge] Verein ${t.id} konnte nicht gelöscht werden:`, e instanceof Error ? e.message : e);
    }
  }
  if (count) console.info(`[tenant-purge] ${count} Verein(e) endgültig gelöscht`);
  return count;
}
