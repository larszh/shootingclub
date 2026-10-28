/**
 * Ausgangskorb für Chat-Nachrichten im localStorage (pro Benutzer getrennt).
 * Jede Nachricht hat eine clientId (UUID); der Server speichert jede clientId nur einmal,
 * daher ist mehrfaches Senden (z.B. aus zwei Tabs) unschädlich. Ohne Verbindung bleiben
 * Nachrichten hier liegen und werden beim nächsten «online» bzw. Öffnen des Chats gesendet.
 */
import { useSyncExternalStore } from "react";
import type { ChatMessageDTO } from "../types";

export type OutboxEntry = {
  clientId: string;
  conversationId: string;
  body: string;
  createdAt: string;
  /** queued = wird (erneut) automatisch gesendet; failed = Server hat abgelehnt, «Erneut senden» */
  status: "queued" | "failed";
  /** Letzter Fehler. Bei "queued" ein vorübergehender Fehler (automatischer neuer Versuch folgt). */
  error?: string;
};

const PREFIX = "standchef:chat-outbox:";
const EMPTY: OutboxEntry[] = [];
const cache = new Map<string, OutboxEntry[]>();
const listeners = new Set<() => void>();
const deliveredListeners = new Set<(m: ChatMessageDTO) => void>();
const inflight = new Set<string>();
let storageHooked = false;

function key(userId: string) {
  return PREFIX + userId;
}

function readStorage(userId: string): OutboxEntry[] {
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (e): e is OutboxEntry =>
        !!e && typeof e === "object" && typeof (e as OutboxEntry).clientId === "string" && typeof (e as OutboxEntry).conversationId === "string" && typeof (e as OutboxEntry).body === "string",
    );
  } catch {
    return EMPTY;
  }
}

function emit() {
  for (const l of listeners) l();
}

export function getOutbox(userId: string): OutboxEntry[] {
  if (typeof window === "undefined") return EMPTY;
  let v = cache.get(userId);
  if (!v) {
    v = readStorage(userId);
    cache.set(userId, v);
  }
  return v;
}

function write(userId: string, entries: OutboxEntry[]) {
  cache.set(userId, entries);
  try {
    if (entries.length) window.localStorage.setItem(key(userId), JSON.stringify(entries));
    else window.localStorage.removeItem(key(userId));
  } catch {
    // Speicher voll oder gesperrt: bleibt bis zum Neuladen im Speicher des Tabs.
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!storageHooked && typeof window !== "undefined") {
    storageHooked = true;
    // Änderungen aus anderen Tabs übernehmen.
    window.addEventListener("storage", (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      cache.delete(e.key.slice(PREFIX.length));
      emit();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useOutbox(userId: string) {
  return useSyncExternalStore(
    subscribe,
    () => getOutbox(userId),
    () => EMPTY,
  );
}

export function addToOutbox(userId: string, entry: OutboxEntry) {
  const list = getOutbox(userId);
  if (list.some((e) => e.clientId === entry.clientId)) return;
  write(userId, [...list, entry]);
}

export function removeFromOutbox(userId: string, clientId: string) {
  const list = getOutbox(userId);
  if (!list.some((e) => e.clientId === clientId)) return;
  write(userId, list.filter((e) => e.clientId !== clientId));
}

function patchEntry(userId: string, clientId: string, patch: Partial<OutboxEntry>) {
  const list = getOutbox(userId);
  if (!list.some((e) => e.clientId === clientId)) return;
  write(userId, list.map((e) => (e.clientId === clientId ? { ...e, ...patch } : e)));
}

/** Benachrichtigt Ansichten über zugestellte Nachrichten (auch ohne Stream). */
export function onDelivered(listener: (m: ChatMessageDTO) => void) {
  deliveredListeners.add(listener);
  return () => {
    deliveredListeners.delete(listener);
  };
}

/** UUID v4, auch ohne sicheren Kontext (crypto.randomUUID gibt es nur unter https/localhost). */
export function newClientId(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  c?.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type DeliverResult = { ok: true; message: ChatMessageDTO } | { ok: false; retry: boolean; error: string };

/** Eine Nachricht aus dem Ausgangskorb senden. Doppelte gleichzeitige Versuche werden übersprungen. */
export async function deliverEntry(userId: string, entry: OutboxEntry): Promise<DeliverResult> {
  if (inflight.has(entry.clientId)) return { ok: false, retry: true, error: "Wird bereits gesendet." };
  inflight.add(entry.clientId);
  try {
    const res = await fetch(`/api/chat/${encodeURIComponent(entry.conversationId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: entry.clientId, body: entry.body }),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as { message?: ChatMessageDTO; error?: string };
    if (res.ok && data.message) {
      for (const l of deliveredListeners) l(data.message);
      removeFromOutbox(userId, entry.clientId);
      return { ok: true, message: data.message };
    }
    // Serverfehler, Überlastung oder abgelaufene Sitzung: später automatisch erneut versuchen.
    if (res.status >= 500 || res.status === 429 || res.status === 401) {
      const error = res.status === 401 ? "Bitte erneut anmelden." : (data.error ?? "Server nicht erreichbar.");
      // Bleibt in der Warteschlange (wird automatisch erneut versucht), zeigt aber «Erneut senden».
      patchEntry(userId, entry.clientId, { error });
      return { ok: false, retry: true, error };
    }
    const error = data.error ?? "Die Nachricht konnte nicht gesendet werden.";
    patchEntry(userId, entry.clientId, { status: "failed", error });
    return { ok: false, retry: false, error };
  } catch {
    const error = "Keine Verbindung.";
    // Nur bei (vermeintlich) bestehender Verbindung als Fehler zeigen; offline wartet die Nachricht still.
    if (typeof navigator === "undefined" || navigator.onLine) patchEntry(userId, entry.clientId, { error });
    return { ok: false, retry: true, error };
  } finally {
    inflight.delete(entry.clientId);
  }
}

/** Alle wartenden Nachrichten der Reihe nach senden (bricht bei Verbindungsproblemen ab). */
export async function flushOutbox(userId: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  for (const entry of getOutbox(userId)) {
    if (entry.status !== "queued") continue;
    const r = await deliverEntry(userId, entry);
    if (!r.ok && r.retry) break;
  }
}

/** «Erneut senden» für eine abgelehnte Nachricht. */
export async function retryEntry(userId: string, clientId: string) {
  patchEntry(userId, clientId, { status: "queued", error: undefined });
  const entry = getOutbox(userId).find((e) => e.clientId === clientId);
  if (entry) return deliverEntry(userId, entry);
  return null;
}
