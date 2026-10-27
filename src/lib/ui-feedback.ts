/**
 * Kleine, abhängigkeitsfreie Stores für Rückmeldungen in der Oberfläche:
 * Toasts (kurze Hinweise unten) und Bestätigungsdialoge (Promise-basiert).
 *
 * Die Funktionen sind nur im Browser sinnvoll. Auf dem Server sind sie wirkungslos,
 * damit ein versehentlicher Import keinen Fehler auslöst.
 *
 * Darstellung: <Toaster /> (src/components/ui/toaster.tsx) und <DialogHost />
 * (src/components/ui/dialog.tsx) müssen einmal im Layout eingebunden sein.
 */

/* ------------------------------------------------------------------ Toasts */

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  /** Zweite Zeile in kleinerer Schrift */
  description?: string;
  /** Anzeigedauer in ms. 0 = bleibt bis zum Schliessen. Standard: 4000 (Fehler 6000). */
  duration?: number;
  /** Optionaler Knopf im Toast, z.B. «Rückgängig» */
  action?: { label: string; onClick: () => void };
  /** Gleiche id ersetzt einen bestehenden Toast (z.B. «Speichert…» → «Gespeichert»). */
  id?: string;
};

export type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
  description?: string;
  duration: number;
  action?: { label: string; onClick: () => void };
  createdAt: number;
};

const MAX_TOASTS = 4;
let toasts: ToastItem[] = [];
const toastListeners = new Set<() => void>();
let toastSeq = 0;

function emitToasts() {
  for (const l of toastListeners) l();
}

export function subscribeToasts(listener: () => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

export function getToasts() {
  return toasts;
}

const EMPTY_TOASTS: ToastItem[] = [];
export function getServerToasts() {
  return EMPTY_TOASTS;
}

function pushToast(tone: ToastTone, message: string, opts?: ToastOptions) {
  if (typeof window === "undefined") return "";
  const id = opts?.id ?? `t${++toastSeq}`;
  const item: ToastItem = {
    id,
    tone,
    message,
    description: opts?.description,
    duration: opts?.duration ?? (tone === "error" ? 6000 : 4000),
    action: opts?.action,
    createdAt: Date.now(),
  };
  const rest = toasts.filter((t) => t.id !== id);
  toasts = [...rest, item].slice(-MAX_TOASTS);
  emitToasts();
  return id;
}

export function dismissToast(id?: string) {
  toasts = id ? toasts.filter((t) => t.id !== id) : [];
  emitToasts();
}

/**
 * Globale Toasts. Beispiel:
 *   toast.success("Gespeichert");
 *   toast.error("Das hat nicht geklappt", { description: "Bitte nochmals versuchen." });
 */
export const toast = Object.assign((message: string, opts?: ToastOptions) => pushToast("info", message, opts), {
  success: (message: string, opts?: ToastOptions) => pushToast("success", message, opts),
  error: (message: string, opts?: ToastOptions) => pushToast("error", message, opts),
  info: (message: string, opts?: ToastOptions) => pushToast("info", message, opts),
  dismiss: dismissToast,
});

/* ------------------------------------------------------- Bestätigungsdialog */

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

export type ConfirmRequest = ConfirmOptions & { id: number; resolve: (ok: boolean) => void };

let confirmQueue: ConfirmRequest[] = [];
const confirmListeners = new Set<() => void>();
let confirmSeq = 0;
let hostCount = 0;

function emitConfirm() {
  for (const l of confirmListeners) l();
}

export function subscribeConfirm(listener: () => void) {
  confirmListeners.add(listener);
  return () => {
    confirmListeners.delete(listener);
  };
}

export function getConfirmQueue() {
  return confirmQueue;
}

const EMPTY_QUEUE: ConfirmRequest[] = [];
export function getServerConfirmQueue() {
  return EMPTY_QUEUE;
}

/** Wird von <DialogHost /> aufgerufen, damit confirmDialog weiss, ob ein Host existiert. */
export function registerDialogHost() {
  hostCount += 1;
  return () => {
    hostCount = Math.max(0, hostCount - 1);
  };
}

export function resolveConfirm(id: number, ok: boolean) {
  const req = confirmQueue.find((r) => r.id === id);
  confirmQueue = confirmQueue.filter((r) => r.id !== id);
  emitConfirm();
  req?.resolve(ok);
}

/**
 * Ersatz für window.confirm mit eigenem, zugänglichem Dialog.
 *   if (!(await confirmDialog({ title: "Durchgang löschen?", tone: "danger", confirmLabel: "Löschen" }))) return;
 * Ohne eingebundenen <DialogHost /> wird auf window.confirm ausgewichen.
 */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === "string" ? { title: opts } : opts;
  if (typeof window === "undefined") return Promise.resolve(false);
  if (hostCount === 0) {
    return Promise.resolve(window.confirm(o.message ? `${o.title}\n\n${o.message}` : o.title));
  }
  return new Promise<boolean>((resolve) => {
    confirmQueue = [...confirmQueue, { ...o, id: ++confirmSeq, resolve }];
    emitConfirm();
  });
}

/* ---------------------------------------------------------- Online-Status */

export function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function getOnline() {
  return navigator.onLine;
}

export function getServerOnline() {
  return true;
}

/** Erkennt typische Netzwerkfehler (fetch ohne Verbindung, Server nicht erreichbar). */
export function isNetworkError(err: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|connection/i.test(msg);
}

/** Next.js steuert redirect()/notFound() über geworfene Fehler mit digest – diese nie verschlucken. */
export function isNavigationError(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"));
}
