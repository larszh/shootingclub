"use client";

import { confirmDialog } from "@/components/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Check, CloudOff, CloudUpload, LogIn, RefreshCw, Sparkles, Trash2, WifiOff, X } from "lucide-react";
import { useSyncStatus } from "@/lib/offline/hooks";
import { onSyncEvent } from "@/lib/offline/events";
import { flushOutbox, getSyncStatus, refreshCounts } from "@/lib/offline/outbox";
import { refreshSnapshot, resetSnapshotThrottle } from "@/lib/offline/snapshot";
import { clearUserData, discardFailed, getSession, listOutbox, retryFailed } from "@/lib/offline/store";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";

const SW_ENABLED = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1";
const AUTH_PATHS = ["/login", "/register"];
const SNAPSHOT_MAX_AGE = 5 * 60_000;

function postToServiceWorker(message: unknown) {
  try {
    navigator.serviceWorker?.controller?.postMessage(message);
  } catch {
    // kein aktiver Service Worker
  }
}

/**
 * Registriert den Service Worker, zeigt Online-/Sync-Status und Update-Hinweis und
 * stösst die Synchronisierung an (online, sichtbar, alle 60 s bei ausstehenden Daten).
 * Im Root-Layout eingebunden.
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();
  const t = useT();
  const status = useSyncStatus();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [failedErrors, setFailedErrors] = useState<string[]>([]);
  const acceptedUpdate = useRef(false);

  // --- Service Worker registrieren ------------------------------------------------
  useEffect(() => {
    if (!SW_ENABLED || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    let cancelled = false;

    const onControllerChange = () => {
      // Nur nach Bestätigung durch den Benutzer neu laden (nicht bei der Erstinstallation)
      if (acceptedUpdate.current) window.location.reload();
    };
    const onMessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === "SYNC_NOW") void flushOutbox();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.addEventListener("message", onMessage);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        if (cancelled) return;
        reg = r;
        if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
        r.addEventListener("updatefound", () => {
          const sw = r.installing;
          sw?.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        // Offline-Seiten einmal pro Sitzung auffrischen (nach einem Deployment)
        try {
          if (navigator.onLine && navigator.serviceWorker.controller && !sessionStorage.getItem("sc-shell-refreshed")) {
            sessionStorage.setItem("sc-shell-refreshed", "1");
            postToServiceWorker({ type: "REFRESH_OFFLINE_SHELL" });
          }
        } catch {
          // sessionStorage gesperrt
        }
      })
      .catch((e) => console.warn("Service Worker konnte nicht registriert werden", e));

    const updateTimer = setInterval(() => void reg?.update().catch(() => undefined), 30 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(updateTimer);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  // --- Synchronisierung anstossen -------------------------------------------------
  useEffect(() => {
    const onOnline = () => {
      void flushOutbox({ force: true }).then(() => refreshSnapshot({ maxAgeMs: 30_000 }));
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshCounts();
      void flushOutbox().then(() => refreshSnapshot({ maxAgeMs: SNAPSHOT_MAX_AGE }));
    };
    const interval = setInterval(() => {
      if (getSyncStatus().pending > 0) void flushOutbox();
    }, 60_000);
    let lastSnapshotAfterSync = 0;
    const off = onSyncEvent((ev) => {
      // Nach erfolgreicher Übertragung Snapshot nachladen (gedrosselt)
      if (ev.type === "flushed" && ev.acked > 0 && Date.now() - lastSnapshotAfterSync > 30_000) {
        lastSnapshotAfterSync = Date.now();
        void refreshSnapshot();
      }
    });
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      off();
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // --- Seitenwechsel: nach Abmeldung Daten löschen, sonst Snapshot aktuell halten ---
  useEffect(() => {
    if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      // Gemeinsam genutzte Geräte: nichts vom vorherigen Konto zurücklassen
      resetSnapshotThrottle();
      postToServiceWorker({ type: "CLEAR_USER_CACHES" });
      void clearUserData()
        .then(() => refreshCounts())
        .catch(() => undefined);
      return;
    }
    if (pathname.startsWith("/offline")) {
      void flushOutbox();
      return;
    }
    // Vereinswechsel und Beitritt leiten auf "/" um (ohne Neuladen): dort immer frisch laden,
    // damit Offline-Daten nicht beim bisherigen Verein bleiben
    void refreshSnapshot({ maxAgeMs: pathname === "/" ? 0 : SNAPSHOT_MAX_AGE }).then(() => flushOutbox());
    // Per Client-Navigation erreichte Seiten auch als HTML für Offline-Neuladen ablegen
    if (navigator.onLine) postToServiceWorker({ type: "CACHE_PAGE", url: window.location.href });
  }, [pathname]);

  const loadFailed = useCallback(async () => {
    const session = await getSession().catch(() => undefined);
    if (!session) return setFailedErrors([]);
    const ops = await listOutbox(session.userId);
    setFailedErrors([...new Set(ops.filter((o) => o.failed).map((o) => o.lastError ?? t("shell.sync.unknownError")))].slice(0, 3));
  }, [t]);

  const togglePanel = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    if (next) void loadFailed();
  };

  const withSession = async (fn: (userId: string) => Promise<void>) => {
    const session = await getSession().catch(() => undefined);
    if (session) await fn(session.userId);
    await loadFailed();
  };

  const isAuthPage = AUTH_PATHS.includes(pathname);
  const showPill = !isAuthPage && (!status.online || status.pending > 0 || status.failed > 0 || status.authRequired);
  const showUpdate = !!waiting && !updateDismissed;

  return (
    <>
      {showUpdate ? (
        <div className="fixed inset-x-0 z-50 flex justify-center px-4 top-[calc(env(safe-area-inset-top)+0.75rem)] pointer-events-none no-print">
          <div role="status" className="animate-rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card border border-line bg-surface p-3 pl-4 shadow-lg">
            <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{t("shell.sync.updateTitle")}</div>
              <div className="text-ink-3 text-xs">{t("shell.sync.updateText")}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                acceptedUpdate.current = true;
                waiting?.postMessage({ type: "SKIP_WAITING" });
                // Fallback, falls controllerchange ausbleibt
                setTimeout(() => window.location.reload(), 3_000);
              }}
              className="press h-10 rounded-control bg-ink px-3 text-sm font-medium text-bg"
            >
              {t("shell.sync.update")}
            </button>
            <button type="button" onClick={() => setUpdateDismissed(true)} aria-label={t("shell.sync.later")} className="press flex h-10 w-8 items-center justify-center text-ink-3">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {showPill ? (
        <div className="pointer-events-none fixed inset-x-0 z-40 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:bottom-4 flex flex-col items-center gap-2 px-4 no-print">
          {panelOpen ? (
            <>
              <button type="button" aria-label={t("shell.common.close")} className="pointer-events-auto fixed inset-0 -z-10 cursor-default" onClick={() => setPanelOpen(false)} />
              <div className="pointer-events-auto animate-rise w-full max-w-[22rem] rounded-card border border-line bg-surface p-4 shadow-xl text-sm">
                <div className="flex items-start gap-3">
                  {status.online ? <CloudUpload className="mt-0.5 h-5 w-5 text-ink-2" aria-hidden /> : <WifiOff className="mt-0.5 h-5 w-5 text-warn" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{status.online ? t("shell.sync.connected") : t("shell.sync.noInternet")}</div>
                    <p className="mt-0.5 text-ink-3">
                      {status.online
                        ? status.pending > 0
                          ? t(status.pending === 1 ? "shell.sync.pendingOne" : "shell.sync.pendingMany", { count: status.pending })
                          : t("shell.sync.allSaved")
                        : t("shell.sync.offlineText")}
                    </p>
                  </div>
                </div>

                {status.authRequired ? (
                  <a href="/login" className="press mt-3 flex h-11 items-center justify-center gap-2 rounded-control bg-ink font-medium text-bg">
                    <LogIn className="h-4 w-4" /> {t("shell.sync.reloginToSync")}
                  </a>
                ) : null}

                {status.failed > 0 ? (
                  <div className="mt-3 rounded-control bg-accent-soft p-3 text-accent">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" /> {t(status.failed === 1 ? "shell.sync.failedOne" : "shell.sync.failedMany", { count: status.failed })}
                    </div>
                    {failedErrors.length ? (
                      <ul className="mt-1 list-disc pl-5 text-xs">
                        {failedErrors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => void withSession(retryFailed).then(() => flushOutbox({ force: true }))} className="press h-11 rounded-control bg-surface px-3 text-xs font-medium text-ink">
                        {t("shell.sync.retry")}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if ((await confirmDialog({ title: t("shell.sync.discardConfirm"), tone: "danger", confirmLabel: t("shell.sync.discard") }))) void withSession(discardFailed);
                        }}
                        className="press inline-flex h-11 items-center gap-1 rounded-control px-3 text-xs font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> {t("shell.sync.discard")}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={!status.online || status.syncing}
                    onClick={() => void flushOutbox({ force: true })}
                    className="press inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-line bg-surface-2 font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={cn("h-4 w-4", status.syncing && "animate-spin")} /> {t("shell.sync.syncNow")}
                  </button>
                  <a href="/offline" className="press inline-flex h-11 items-center justify-center rounded-control px-3 font-medium text-ink-2 hover:bg-surface-2">
                    {t("shell.sync.overview")}
                  </a>
                </div>
              </div>
            </>
          ) : null}

          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={panelOpen}
            aria-live="polite"
            className={cn(
              "pointer-events-auto animate-pop press inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-lg backdrop-blur",
              !status.online ? "border-warn/40 bg-surface/95 text-ink" : status.failed > 0 ? "border-accent/40 bg-surface/95 text-accent" : "border-line bg-surface/95 text-ink",
            )}
          >
            {!status.online ? (
              <>
                <CloudOff className="h-4 w-4 text-warn" aria-hidden />
                {status.pending > 0 ? t("shell.sync.pillOfflinePending", { count: status.pending }) : t("shell.sync.pillOffline")}
              </>
            ) : status.authRequired ? (
              <>
                <LogIn className="h-4 w-4" aria-hidden /> {t("shell.sync.pillLogin")}
              </>
            ) : status.failed > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4" aria-hidden /> {t("shell.sync.pillFailed", { count: status.failed })}
              </>
            ) : status.syncing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> {t("shell.sync.pillSyncing")}
              </>
            ) : status.pending > 0 ? (
              <>
                <CloudUpload className="h-4 w-4" aria-hidden /> {t("shell.sync.pillPending", { count: status.pending })}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-ok" aria-hidden /> {t("shell.sync.pillSaved")}
              </>
            )}
          </button>
        </div>
      ) : null}
    </>
  );
}
