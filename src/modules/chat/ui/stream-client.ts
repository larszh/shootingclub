/**
 * Eine gemeinsame EventSource-Verbindung zu /api/chat/stream pro Browser-Tab, geteilt von
 * Badge, Liste und Unterhaltung. Verbindet bei Fehlern mit exponentiellem Backoff neu
 * (1 s … 30 s). Nach wiederholten Fehlern meldet der Status "degraded": Ansichten fragen
 * dann zusätzlich per Polling (GET /api/chat/[id]/messages?after=…) nach.
 * Jedes (Wieder-)Verbinden liefert ein "hello"-Ereignis – Ansichten holen dann verpasste
 * Nachrichten nach.
 */
import { useSyncExternalStore } from "react";
import type { ChatStreamEvent } from "../types";

export type ChatStreamStatus = "idle" | "connecting" | "open" | "degraded";

type Listener = (ev: ChatStreamEvent) => void;

const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
let source: EventSource | null = null;
let status: ChatStreamStatus = "idle";
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let windowHooked = false;
let me: string | null = null;

function setStatus(next: ChatStreamStatus) {
  if (status === next) return;
  status = next;
  for (const l of statusListeners) l();
}

function dispatch(ev: ChatStreamEvent) {
  if (ev.type === "hello") me = ev.userId;
  for (const l of [...listeners]) {
    try {
      l(ev);
    } catch {
      // Fehler in einer Ansicht dürfen die anderen nicht stören.
    }
  }
}

function connect() {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    setStatus("degraded");
    return;
  }
  if (source || !listeners.size) return;
  clearTimeout(retryTimer);
  setStatus(failures >= 2 ? "degraded" : "connecting");
  const es = new EventSource("/api/chat/stream");
  source = es;
  es.onopen = () => {
    failures = 0;
    setStatus("open");
  };
  es.onmessage = (e) => {
    let ev: ChatStreamEvent;
    try {
      ev = JSON.parse(e.data) as ChatStreamEvent;
    } catch {
      return;
    }
    dispatch(ev);
  };
  es.onerror = () => {
    // Selbst neu verbinden (mit Backoff), statt dem Browser-Automatismus zu vertrauen.
    es.close();
    if (source === es) source = null;
    failures += 1;
    setStatus(failures >= 2 ? "degraded" : "connecting");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  clearTimeout(retryTimer);
  if (!listeners.size) return;
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, failures - 1));
  const delay = base + Math.round(Math.random() * 500);
  retryTimer = setTimeout(() => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return scheduleReconnect();
    connect();
  }, delay);
}

function disconnect() {
  clearTimeout(retryTimer);
  source?.close();
  source = null;
  failures = 0;
  setStatus("idle");
}

function hookWindow() {
  if (windowHooked || typeof window === "undefined") return;
  windowHooked = true;
  window.addEventListener("online", () => {
    if (!source && listeners.size) {
      failures = Math.min(failures, 1);
      connect();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !source && listeners.size) connect();
  });
}

/** Ereignisse abonnieren. Die Verbindung wird beim ersten Abonnenten geöffnet. */
export function subscribeChatStream(listener: Listener) {
  listeners.add(listener);
  clearTimeout(idleTimer);
  hookWindow();
  connect();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      // Kurz warten: bei Seitenwechseln abonniert die nächste Ansicht gleich wieder.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!listeners.size) disconnect();
      }, 3000);
    }
  };
}

/** userId aus dem letzten "hello" (null, solange nicht verbunden). */
export function chatStreamUserId() {
  return me;
}

function subscribeStatus(l: () => void) {
  statusListeners.add(l);
  return () => {
    statusListeners.delete(l);
  };
}

const getStatus = () => status;
const getServerStatus = (): ChatStreamStatus => "idle";

export function useChatStreamStatus() {
  return useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
}
