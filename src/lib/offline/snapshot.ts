// Snapshot des aktiven Vereins (Programme, Mitglieder, offene Durchgänge) für den Offline-Betrieb.
import { STORES, idbPut, idbSupported } from "./idb";
import { emitSyncEvent } from "./events";
import { getSession, pruneMatches, setMeta, upsertServerView } from "./store";
import type { OfflineSession, OfflineSnapshot, SnapshotResponse } from "./types";

let lastFetch = 0;
let inflight: Promise<boolean> | null = null;

const KEEP_CLEAN_MATCHES_MS = 14 * 86_400_000;

/**
 * Lädt den Snapshot vom Server und legt ihn in IndexedDB ab.
 * `maxAgeMs`: nicht erneut laden, wenn der letzte Abruf jünger ist.
 * Liefert true, wenn ein aktueller Snapshot gespeichert wurde.
 */
export function refreshSnapshot(opts?: { maxAgeMs?: number }): Promise<boolean> {
  if (!idbSupported() || typeof navigator === "undefined" || !navigator.onLine) return Promise.resolve(false);
  const maxAge = opts?.maxAgeMs ?? 0;
  if (maxAge && Date.now() - lastFetch < maxAge) return Promise.resolve(false);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/offline/snapshot", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
      if (res.status === 401) return false;
      if (!res.ok) return false;
      const data = (await res.json()) as SnapshotResponse;
      lastFetch = Date.now();
      const session: OfflineSession = {
        userId: data.user.id,
        userName: data.user.name,
        tenantId: data.tenant?.id ?? null,
        tenantName: data.tenant?.name ?? null,
        updatedAt: Date.now(),
      };
      await setMeta("session", session);
      if (data.tenant && data.scores) {
        const snapshot: OfflineSnapshot = {
          tenantId: data.tenant.id,
          tenantName: data.tenant.name,
          userId: data.user.id,
          userName: data.user.name,
          userAvatarUrl: data.user.avatarUrl,
          canCreate: data.scores.canCreate,
          programs: data.scores.programs,
          members: data.scores.members,
          generatedAt: data.generatedAt,
        };
        await idbPut(STORES.snapshot, snapshot);
        for (const m of data.scores.openMatches) await upsertServerView(m, data.tenant.id, data.user.id);
        await pruneMatches(data.user.id, new Set(data.scores.openMatches.map((m) => m.id ?? "")), KEEP_CLEAN_MATCHES_MS);
      }
      emitSyncEvent({ type: "snapshot" });
      return true;
    } catch {
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Nach dem Abmelden: nächsten Abruf sofort erlauben (neues Konto). */
export function resetSnapshotThrottle() {
  lastFetch = 0;
}

/** Aktuell angemeldeter Benutzer laut letztem Snapshot. */
export { getSession };
