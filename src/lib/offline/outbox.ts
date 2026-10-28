// Outbox-Verarbeitung: sendet ausstehende Operationen an /api/sync, mit Backoff und Idempotenz.
import { idbSupported } from "./idb";
import { emitSyncEvent, onSyncEvent } from "./events";
import { applyAck, getSession, listOutbox, markOpError, takeServiceWorkerAcks } from "./store";
import type { OutboxOp, SyncOpResult, SyncResponse, WireOp } from "./types";

export type SyncStatus = {
  supported: boolean;
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  /** Server verlangt Anmeldung (Sitzung abgelaufen) */
  authRequired: boolean;
};

const INITIAL: SyncStatus = { supported: false, online: true, pending: 0, failed: 0, syncing: false, lastSyncAt: null, lastError: null, authRequired: false };

let status: SyncStatus = INITIAL;
const listeners = new Set<() => void>();
let initialized = false;

function setStatus(patch: Partial<SyncStatus>) {
  const next = { ...status, ...patch };
  const changed = (Object.keys(next) as Array<keyof SyncStatus>).some((k) => next[k] !== status[k]);
  if (!changed) return;
  status = next;
  for (const l of listeners) l();
}

export function getSyncStatus() {
  return status;
}

export function getServerSyncStatus() {
  return INITIAL;
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  setStatus({ supported: idbSupported(), online: navigator.onLine });
  window.addEventListener("online", () => setStatus({ online: true }));
  window.addEventListener("offline", () => setStatus({ online: false }));
  onSyncEvent((ev) => {
    if (ev.type === "changed" || ev.type === "acked" || ev.type === "failed" || ev.type === "flushed") void refreshCounts();
  });
  void refreshCounts();
}

export function subscribeSyncStatus(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Anzahl ausstehender / fehlgeschlagener Operationen des angemeldeten Benutzers neu zählen. */
export async function refreshCounts() {
  if (!idbSupported()) return;
  try {
    const session = await getSession();
    const ops = session ? await listOutbox(session.userId) : [];
    setStatus({ pending: ops.filter((o) => !o.failed).length, failed: ops.filter((o) => o.failed).length });
  } catch {
    // IndexedDB nicht verfügbar (z.B. privater Modus): Status bleibt
  }
}

// ---------------------------------------------------------------------------
// Senden
// ---------------------------------------------------------------------------

const BATCH = 40;
const MAX_BATCHES = 10;
const REQUEST_TIMEOUT = 15_000;

function backoff(attempts: number) {
  const base = Math.min(2_000 * 2 ** attempts, 5 * 60_000);
  return Date.now() + base + Math.floor(Math.random() * 1_000);
}

function toWire(op: OutboxOp): WireOp {
  return { id: op.id, type: op.type, tenantId: op.tenantId, userId: op.userId, payload: op.payload } as WireOp;
}

let flushing: Promise<void> | null = null;
let again = false;

/**
 * Ausstehende Operationen übertragen. Mehrfachaufrufe werden zusammengefasst.
 * `force` ignoriert die Wartezeit des Backoffs (z.B. «Jetzt synchronisieren»).
 */
export function flushOutbox(opts?: { force?: boolean }): Promise<void> {
  init();
  if (flushing) {
    again = true;
    return flushing;
  }
  flushing = (async () => {
    try {
      const run = () => doFlush(!!opts?.force);
      // Über Tabs hinweg nur ein Sendevorgang gleichzeitig (Server ist ohnehin idempotent)
      const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
      if (locks?.request) await locks.request("standchef-sync", { ifAvailable: true }, async (lock) => (lock ? run() : undefined));
      else await run();
    } finally {
      flushing = null;
      if (again) {
        again = false;
        void flushOutbox();
      }
    }
  })();
  return flushing;
}

async function doFlush(force: boolean) {
  if (!idbSupported() || typeof navigator === "undefined") return;
  if (!navigator.onLine) {
    setStatus({ online: false });
    return;
  }
  const session = await getSession();
  if (!session) return;

  // Resultate einer Hintergrund-Synchronisierung durch den Service Worker übernehmen
  for (const { op, result } of await takeServiceWorkerAcks()) {
    await applyAck(op, result);
    emitSyncEvent({ type: "acked", op, result });
  }

  let ackedTotal = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const now = Date.now();
    const ops = (await listOutbox(session.userId)).filter((o) => !o.failed && (force || !o.nextAttemptAt || o.nextAttemptAt <= now)).slice(0, BATCH);
    if (ops.length === 0) break;
    setStatus({ syncing: true });

    let res: Response;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT);
    try {
      res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ ops: ops.map(toWire) }),
        signal: ctrl.signal,
      });
    } catch {
      clearTimeout(timer);
      for (const op of ops) await markOpError(op, { id: op.id, ok: false, error: "Keine Verbindung", retry: true }, backoff(op.attempts));
      setStatus({ syncing: false, lastError: "Keine Verbindung zum Server" });
      break;
    }
    clearTimeout(timer);

    if (res.status === 401) {
      setStatus({ syncing: false, authRequired: true, lastError: "Bitte erneut anmelden" });
      break;
    }
    if (!res.ok) {
      for (const op of ops) await markOpError(op, { id: op.id, ok: false, error: `Serverfehler (${res.status})`, retry: true }, backoff(op.attempts));
      setStatus({ syncing: false, lastError: `Serverfehler (${res.status})` });
      break;
    }

    let data: SyncResponse;
    try {
      data = (await res.json()) as SyncResponse;
    } catch {
      setStatus({ syncing: false, lastError: "Ungültige Serverantwort" });
      break;
    }
    const byId = new Map<string, SyncOpResult>(data.results.map((r) => [r.id, r]));
    let progressed = false;
    for (const op of ops) {
      const r = byId.get(op.id);
      if (!r) continue;
      if (r.ok) {
        r.serverTime = data.serverTime;
        await applyAck(op, r);
        ackedTotal++;
        progressed = true;
        emitSyncEvent({ type: "acked", op, result: r });
      } else {
        await markOpError(op, r, backoff(op.attempts));
        if (r.retry === false) emitSyncEvent({ type: "failed", op, result: r });
      }
    }
    setStatus({ authRequired: false, lastError: null });
    if (!progressed) break;
  }
  setStatus({ syncing: false, lastSyncAt: Date.now() });
  emitSyncEvent({ type: "flushed", acked: ackedTotal });
}

// ---------------------------------------------------------------------------
// Verzögertes Senden nach Eingaben
// ---------------------------------------------------------------------------

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Nach einer Eingabe kurz warten (mehrere Schüsse zusammenfassen) und dann senden. */
export function requestFlush(delay = 600) {
  if (typeof window === "undefined") return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushOutbox();
  }, delay);
  void registerBackgroundSync();
}

/** Background Sync als Ergänzung: der Browser weckt den Service Worker, sobald wieder Netz da ist. */
export async function registerBackgroundSync() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = (await Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 1_000))])) as
      | (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })
      | null;
    await reg?.sync?.register("standchef-sync");
  } catch {
    // nicht unterstützt oder nicht erlaubt
  }
}
