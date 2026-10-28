// Lokale Daten: Sitzung, Snapshot, Durchgänge und Outbox (alles in IndexedDB).
import { STORES, idbClear, idbGet, idbGetAll, idbPut, promisify, uuid, withTx } from "./idb";
import { emitSyncEvent } from "./events";
import {
  cellKey,
  type CreateMatchPayload,
  type MatchEntry,
  type OfflineSession,
  type OfflineSnapshot,
  type OutboxOp,
  type ScoreMatch,
  type SyncMapping,
  type SyncOpResult,
} from "./types";

// ---------------------------------------------------------------------------
// Sitzung & Snapshot
// ---------------------------------------------------------------------------

type MetaRecord<T> = { key: string; value: T };

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const rec = await idbGet<MetaRecord<T>>(STORES.meta, key);
  return rec?.value;
}

export function setMeta<T>(key: string, value: T) {
  return idbPut<MetaRecord<T>>(STORES.meta, { key, value });
}

export function getSession() {
  return getMeta<OfflineSession>("session");
}

/** Sitzung setzen, falls noch keine (oder eine andere) gespeichert ist – z.B. vor dem ersten Snapshot. */
export async function ensureSession(user: { id: string; name: string }, tenant: { id: string; name: string | null } | null) {
  const current = await getSession();
  if (current && current.userId === user.id && (current.tenantId === (tenant?.id ?? null) || !tenant)) return current;
  const next: OfflineSession = { userId: user.id, userName: user.name, tenantId: tenant?.id ?? current?.tenantId ?? null, tenantName: tenant?.name ?? current?.tenantName ?? null, updatedAt: Date.now() };
  await setMeta("session", next);
  return next;
}

export async function getSnapshot(tenantId: string, userId: string): Promise<OfflineSnapshot | null> {
  const snap = await idbGet<OfflineSnapshot>(STORES.snapshot, tenantId);
  return snap && snap.userId === userId ? snap : null;
}

/** Snapshot des aktiven Vereins für den angemeldeten Benutzer (oder null). */
export async function getActiveSnapshot(): Promise<{ session: OfflineSession; snapshot: OfflineSnapshot | null } | null> {
  const session = await getSession();
  if (!session) return null;
  const snapshot = session.tenantId ? await getSnapshot(session.tenantId, session.userId) : null;
  return { session, snapshot };
}

/** Beim Abmelden: alle personenbezogenen Daten entfernen. Die Outbox bleibt, damit nichts verloren geht. */
export async function clearUserData() {
  await idbClear([STORES.snapshot, STORES.matches]);
  await withTx([STORES.meta], "readwrite", async (tx) => {
    await promisify(tx.objectStore(STORES.meta).delete("session"));
  });
  emitSyncEvent({ type: "snapshot" });
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen für Schüsse
// ---------------------------------------------------------------------------

export function shotsFromView(view: ScoreMatch): Record<string, number[][]> {
  return Object.fromEntries(
    view.participants.map((p) => [p.id, view.program.stages.map((_, i) => p.results.find((r) => r.stageIndex === i)?.shots ?? [])]),
  );
}

/**
 * Serverstand mit lokalen Ständen überlagern: noch nicht bestätigte Änderungen und bestätigte
 * Änderungen, die neuer sind als die Serveransicht (z.B. Seite stammt aus dem Offline-Cache).
 */
export function overlayDirty(base: Record<string, number[][]>, entry: Pick<MatchEntry, "shots" | "dirty" | "synced">, viewGeneratedAt?: string): Record<string, number[][]> {
  const out: Record<string, number[][]> = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v.map((a) => [...a])]));
  const viewTime = viewGeneratedAt ? Date.parse(viewGeneratedAt) : Number.POSITIVE_INFINITY;
  const keys = new Set(Object.keys(entry.dirty));
  for (const [ck, t] of Object.entries(entry.synced ?? {})) if (t > viewTime) keys.add(ck);
  for (const ck of keys) {
    const sep = ck.lastIndexOf("|");
    const pk = ck.slice(0, sep);
    const si = Number(ck.slice(sep + 1));
    const local = entry.shots[pk]?.[si];
    if (!out[pk] || !local) continue;
    out[pk]![si] = [...local];
  }
  return out;
}

function matchRefFor(key: string): { matchId?: string; matchClientId?: string } {
  return key.startsWith("s:") ? { matchId: key.slice(2) } : { matchClientId: key.slice(2) };
}

// ---------------------------------------------------------------------------
// Durchgänge
// ---------------------------------------------------------------------------

export function getMatchEntry(key: string) {
  return idbGet<MatchEntry>(STORES.matches, key);
}

export async function listMatchEntries(userId: string): Promise<MatchEntry[]> {
  const all = await idbGetAll<MatchEntry>(STORES.matches);
  return all.filter((e) => e.userId === userId && !e.serverId).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Serveransicht ablegen, lokale ungesicherte Änderungen bleiben erhalten. */
export async function upsertServerView(view: ScoreMatch, tenantId: string, userId: string): Promise<MatchEntry | null> {
  if (!view.id) return null;
  const key = `s:${view.id}`;
  return withTx([STORES.matches], "readwrite", async (tx) => {
    const store = tx.objectStore(STORES.matches);
    const existing = (await promisify(store.get(key))) as MatchEntry | undefined;
    const base = shotsFromView(view);
    const own = existing && existing.userId === userId ? existing : null;
    // Ältere Ansicht (z.B. Seite aus dem Service-Worker-Cache) darf einen neueren lokalen Stand nie ersetzen
    if (own && Date.parse(own.view.generatedAt) > Date.parse(view.generatedAt)) return own;
    const dirty = own ? own.dirty : {};
    // Bestätigte Stände, die in der Serveransicht bereits enthalten sind, nicht mehr bevorzugen
    const viewTime = Date.parse(view.generatedAt);
    const synced = Object.fromEntries(Object.entries(own?.synced ?? {}).filter(([, t]) => t > viewTime));
    const entry: MatchEntry = {
      key,
      userId,
      tenantId,
      view,
      shots: own ? overlayDirty(base, own, view.generatedAt) : base,
      dirty,
      synced,
      status: existing?.statusDirty && existing.userId === userId ? existing.status : view.status,
      statusDirty: existing?.userId === userId ? (existing.statusDirty ?? null) : null,
      updatedAt: Date.now(),
    };
    await promisify(store.put(entry));
    return entry;
  });
}

function emptyShots(view: ScoreMatch) {
  return Object.fromEntries(view.participants.map((p) => [p.id, view.program.stages.map(() => [] as number[])]));
}

/** Offline erstellten Durchgang ablegen und createMatch in die Outbox stellen. */
export async function createOfflineMatch(view: ScoreMatch, payload: CreateMatchPayload, tenantId: string, userId: string) {
  const key = `c:${payload.clientId}`;
  const now = Date.now();
  await withTx([STORES.matches, STORES.outbox], "readwrite", async (tx) => {
    const entry: MatchEntry = { key, userId, tenantId, view, shots: emptyShots(view), dirty: {}, status: "OPEN", statusDirty: null, updatedAt: now };
    await promisify(tx.objectStore(STORES.matches).put(entry));
    const op: OutboxOp = {
      key: `cm|${payload.clientId}`,
      id: uuid(),
      type: "createMatch",
      tenantId,
      userId,
      payload,
      createdAt: now,
      attempts: 0,
      nextAttemptAt: 0,
      originKey: key,
    };
    await promisify(tx.objectStore(STORES.outbox).put(op));
  });
  emitSyncEvent({ type: "changed" });
  return key;
}

/** Zieleintrag auflösen: offline erstellte Durchgänge zeigen nach der Übertragung auf den Server-Eintrag. */
async function resolveTarget(store: IDBObjectStore, key: string, participantKey: string) {
  const entry = (await promisify(store.get(key))) as MatchEntry | undefined;
  if (entry?.serverId) {
    const idx = Number(participantKey);
    const pid = /^\d+$/.test(participantKey) ? (entry.participantMap?.[idx] ?? null) : participantKey;
    const target = (await promisify(store.get(`s:${entry.serverId}`))) as MatchEntry | undefined;
    return { key: `s:${entry.serverId}`, entry: target, participantKey: pid };
  }
  return { key, entry, participantKey: participantKey as string | null };
}

type RecordContext = { storageKey: string; view: ScoreMatch; tenantId: string; userId: string };

function baseEntry(ctx: RecordContext, key: string): MatchEntry {
  return { key, userId: ctx.userId, tenantId: ctx.tenantId, view: ctx.view, shots: shotsFromView(ctx.view), dirty: {}, status: ctx.view.status, statusDirty: null, updatedAt: Date.now() };
}

/**
 * Schüsse einer Serie lokal speichern (sofort dauerhaft) und die Übertragung einreihen.
 * Beides in einer Transaktion, damit kein Schuss verloren geht.
 */
export async function recordShots(ctx: RecordContext, participantKey: string, stageIndex: number, shots: number[], ts: number) {
  await withTx([STORES.matches, STORES.outbox], "readwrite", async (tx) => {
    const matches = tx.objectStore(STORES.matches);
    const target = await resolveTarget(matches, ctx.storageKey, participantKey);
    if (!target.participantKey) return; // Teilnehmer wurde vom Server verworfen
    const entry = target.entry ?? baseEntry(ctx, target.key);
    const pk = target.participantKey;
    const rows = entry.shots[pk] ?? ctx.view.program.stages.map(() => [] as number[]);
    rows[stageIndex] = [...shots];
    entry.shots[pk] = rows;
    entry.dirty[cellKey(pk, stageIndex)] = ts;
    entry.updatedAt = ts;
    await promisify(matches.put(entry));

    const ref = matchRefFor(target.key);
    const op: OutboxOp = {
      key: `ss|${target.key}|${pk}|${stageIndex}`,
      id: uuid(),
      type: "saveStageResult",
      tenantId: entry.tenantId,
      userId: entry.userId,
      payload: { ...ref, participantKey: pk, stageIndex, shots: [...shots], clientUpdatedAt: ts },
      createdAt: ts,
      attempts: 0,
      nextAttemptAt: 0,
      originKey: ctx.storageKey,
      uiParticipantKey: participantKey,
    };
    await promisify(tx.objectStore(STORES.outbox).put(op));
  });
  emitSyncEvent({ type: "changed" });
}

/** Status (abschliessen / wieder öffnen) lokal setzen und einreihen. */
export async function recordStatus(ctx: RecordContext, status: "OPEN" | "FINISHED", ts: number) {
  await withTx([STORES.matches, STORES.outbox], "readwrite", async (tx) => {
    const matches = tx.objectStore(STORES.matches);
    const target = await resolveTarget(matches, ctx.storageKey, "0");
    const entry = target.entry ?? baseEntry(ctx, target.key);
    entry.status = status;
    entry.statusDirty = ts;
    entry.updatedAt = ts;
    await promisify(matches.put(entry));
    const op: OutboxOp = {
      key: `st|${target.key}`,
      id: uuid(),
      type: "setMatchStatus",
      tenantId: entry.tenantId,
      userId: entry.userId,
      payload: { ...matchRefFor(target.key), status, clientUpdatedAt: ts },
      createdAt: ts,
      attempts: 0,
      nextAttemptAt: 0,
      originKey: ctx.storageKey,
    };
    await promisify(tx.objectStore(STORES.outbox).put(op));
  });
  emitSyncEvent({ type: "changed" });
}

/** Lokalen Durchgang und alle zugehörigen ausstehenden Operationen verwerfen. */
export async function discardMatch(key: string) {
  await withTx([STORES.matches, STORES.outbox], "readwrite", async (tx) => {
    const matches = tx.objectStore(STORES.matches);
    const entry = (await promisify(matches.get(key))) as MatchEntry | undefined;
    const keys = new Set([key]);
    if (entry?.serverId) keys.add(`s:${entry.serverId}`);
    for (const k of keys) await promisify(matches.delete(k));
    const outbox = tx.objectStore(STORES.outbox);
    const ops = (await promisify(outbox.getAll())) as OutboxOp[];
    for (const op of ops) {
      const ref = op.type === "createMatch" ? `c:${op.payload.clientId}` : op.payload.matchId ? `s:${op.payload.matchId}` : `c:${op.payload.matchClientId}`;
      if (keys.has(ref) || (op.originKey && keys.has(op.originKey))) await promisify(outbox.delete(op.key));
    }
  });
  emitSyncEvent({ type: "changed" });
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export async function listOutbox(userId?: string): Promise<OutboxOp[]> {
  const all = await idbGetAll<OutboxOp>(STORES.outbox);
  return all.filter((op) => !userId || op.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

/** Bestätigte Operation entfernen (nur wenn sie inzwischen nicht ersetzt wurde) und lokale Markierungen bereinigen. */
export async function applyAck(op: OutboxOp, result: SyncOpResult) {
  await withTx([STORES.outbox, STORES.matches], "readwrite", async (tx) => {
    const outbox = tx.objectStore(STORES.outbox);
    const current = (await promisify(outbox.get(op.key))) as OutboxOp | undefined;
    if (current && current.id === op.id) await promisify(outbox.delete(op.key));

    const matches = tx.objectStore(STORES.matches);
    if (op.type === "saveStageResult") {
      const p = op.payload;
      const key = p.matchId ? `s:${p.matchId}` : `c:${p.matchClientId}`;
      const target = await resolveTarget(matches, key, p.participantKey);
      if (target.entry && target.participantKey) {
        const ck = cellKey(target.participantKey, p.stageIndex);
        const ts = target.entry.dirty[ck];
        if (ts !== undefined && ts <= p.clientUpdatedAt) {
          delete target.entry.dirty[ck];
          // Vom Server ignoriert (neuerer Stand dort): lokalen Stand nicht mehr bevorzugen
          if (!result.ignored) target.entry.synced = { ...(target.entry.synced ?? {}), [ck]: result.serverTime ?? Date.now() };
          await promisify(matches.put(target.entry));
        }
      }
    } else if (op.type === "setMatchStatus") {
      const p = op.payload;
      const key = p.matchId ? `s:${p.matchId}` : `c:${p.matchClientId}`;
      const target = await resolveTarget(matches, key, "0");
      if (target.entry && target.entry.statusDirty && target.entry.statusDirty <= p.clientUpdatedAt) {
        target.entry.statusDirty = null;
        await promisify(matches.put(target.entry));
      }
    }
  });
  if (result.mapping) await applyMapping(result.mapping);
}

/** Dauerhaft fehlgeschlagene oder erneut zu versuchende Operation aktualisieren. */
export async function markOpError(op: OutboxOp, result: SyncOpResult, nextAttemptAt: number) {
  await withTx([STORES.outbox], "readwrite", async (tx) => {
    const outbox = tx.objectStore(STORES.outbox);
    const current = (await promisify(outbox.get(op.key))) as OutboxOp | undefined;
    if (!current || current.id !== op.id) return; // inzwischen ersetzt
    current.attempts = (current.attempts ?? 0) + 1;
    current.lastError = result.error ?? "Unbekannter Fehler";
    if (result.retry === false) current.failed = true;
    else current.nextAttemptAt = nextAttemptAt;
    await promisify(outbox.put(current));
  });
}

/** Alle fehlgeschlagenen Operationen erneut versuchen. */
export async function retryFailed(userId: string) {
  await withTx([STORES.outbox], "readwrite", async (tx) => {
    const outbox = tx.objectStore(STORES.outbox);
    const ops = (await promisify(outbox.getAll())) as OutboxOp[];
    for (const op of ops) {
      if (op.userId !== userId) continue;
      if (op.failed || op.nextAttemptAt > 0) await promisify(outbox.put({ ...op, failed: false, attempts: 0, nextAttemptAt: 0 }));
    }
  });
  emitSyncEvent({ type: "changed" });
}

/** Fehlgeschlagene Operationen verwerfen; die lokale Markierung «nicht gespeichert» wird entfernt. */
export async function discardFailed(userId: string) {
  await withTx([STORES.outbox, STORES.matches], "readwrite", async (tx) => {
    const outbox = tx.objectStore(STORES.outbox);
    const matches = tx.objectStore(STORES.matches);
    const ops = (await promisify(outbox.getAll())) as OutboxOp[];
    // Wird eine Erstellung verworfen, sind auch die Resultate dieses Durchgangs hinfällig
    const droppedClientIds = new Set(ops.filter((o) => o.userId === userId && o.failed && o.type === "createMatch").map((o) => (o.type === "createMatch" ? o.payload.clientId : "")));
    for (const op of ops) {
      if (op.userId !== userId) continue;
      if (op.type !== "createMatch" && op.payload.matchClientId && droppedClientIds.has(op.payload.matchClientId)) {
        await promisify(outbox.delete(op.key));
        continue;
      }
      if (!op.failed) continue;
      await promisify(outbox.delete(op.key));
      if (op.type === "saveStageResult") {
        const p = op.payload;
        const target = await resolveTarget(matches, p.matchId ? `s:${p.matchId}` : `c:${p.matchClientId}`, p.participantKey);
        if (target.entry && target.participantKey) {
          delete target.entry.dirty[cellKey(target.participantKey, p.stageIndex)];
          await promisify(matches.put(target.entry));
        }
      } else if (op.type === "createMatch") {
        await promisify(matches.delete(`c:${op.payload.clientId}`));
      }
    }
  });
  emitSyncEvent({ type: "changed" });
}

/** Offline erstellten Durchgang auf die Server-IDs umschreiben. */
export async function applyMapping(mapping: SyncMapping) {
  const { matchClientId, matchId, participantIds } = mapping;
  const changed = await withTx([STORES.matches], "readwrite", async (tx) => {
    const store = tx.objectStore(STORES.matches);
    const c = (await promisify(store.get(`c:${matchClientId}`))) as MatchEntry | undefined;
    if (!c || c.serverId) return false;
    const remap = (k: string) => (/^\d+$/.test(k) ? (participantIds[Number(k)] ?? null) : k);
    const view: ScoreMatch = {
      ...c.view,
      id: matchId,
      clientId: matchClientId,
      participants: c.view.participants
        .map((p, i) => ({ ...p, id: participantIds[i] ?? "" }))
        .filter((p) => p.id !== ""),
    };
    const shots: Record<string, number[][]> = {};
    for (const [k, v] of Object.entries(c.shots)) {
      const id = remap(k);
      if (id) shots[id] = v;
    }
    const remapCells = (rec: Record<string, number>) => {
      const out: Record<string, number> = {};
      for (const [ck, ts] of Object.entries(rec)) {
        const sep = ck.lastIndexOf("|");
        const id = remap(ck.slice(0, sep));
        if (id) out[`${id}|${ck.slice(sep + 1)}`] = ts;
      }
      return out;
    };
    const dirty = remapCells(c.dirty);
    const synced = remapCells(c.synced ?? {});
    const existing = (await promisify(store.get(`s:${matchId}`))) as MatchEntry | undefined;
    const s: MatchEntry = {
      key: `s:${matchId}`,
      userId: c.userId,
      tenantId: c.tenantId,
      view,
      shots: existing ? { ...existing.shots, ...shots } : shots,
      dirty: existing ? { ...existing.dirty, ...dirty } : dirty,
      synced: existing ? { ...(existing.synced ?? {}), ...synced } : synced,
      status: c.status,
      statusDirty: c.statusDirty ?? null,
      updatedAt: Date.now(),
    };
    await promisify(store.put(s));
    await promisify(store.put({ ...c, serverId: matchId, participantMap: participantIds, shots: {}, dirty: {}, synced: {}, updatedAt: Date.now() }));
    return true;
  });
  if (changed) emitSyncEvent({ type: "mapped", clientId: matchClientId, matchId, participantIds });
}

/** Vom Service Worker (Background Sync) gemeldete Resultate übernehmen. */
export async function takeServiceWorkerAcks(): Promise<Array<{ op: OutboxOp; result: SyncOpResult }>> {
  return withTx([STORES.meta], "readwrite", async (tx) => {
    const meta = tx.objectStore(STORES.meta);
    const rec = (await promisify(meta.get("swAcks"))) as MetaRecord<Array<{ op: OutboxOp; result: SyncOpResult }>> | undefined;
    if (rec?.value?.length) await promisify(meta.delete("swAcks"));
    return rec?.value ?? [];
  });
}

/** Alte, vollständig übertragene Server-Durchgänge aufräumen. */
export async function pruneMatches(userId: string, keepIds: Set<string>, maxAgeMs: number) {
  const now = Date.now();
  await withTx([STORES.matches], "readwrite", async (tx) => {
    const store = tx.objectStore(STORES.matches);
    const all = (await promisify(store.getAll())) as MatchEntry[];
    // Server-Einträge, auf die ein (noch behaltener) offline erstellter Eintrag zeigt, nicht löschen
    const referenced = new Set(all.filter((e) => e.serverId && !(now - e.updatedAt > maxAgeMs)).map((e) => `s:${e.serverId}`));
    for (const e of all) {
      if (referenced.has(e.key)) continue;
      const clean = Object.keys(e.dirty).length === 0 && !e.statusDirty;
      if (e.userId !== userId) {
        // Daten eines anderen Kontos: ohne offene Änderungen entfernen
        if (clean) await promisify(store.delete(e.key));
        continue;
      }
      if (e.serverId && now - e.updatedAt > maxAgeMs) await promisify(store.delete(e.key));
      else if (e.key.startsWith("s:") && clean && !keepIds.has(e.key.slice(2)) && now - e.updatedAt > maxAgeMs) await promisify(store.delete(e.key));
    }
  });
}
