"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/locale";
import { dismissToast, getServerToasts, getToasts, subscribeToasts, toast, type ToastItem } from "@/lib/ui-feedback";

export { toast, dismissToast };
export type { ToastOptions, ToastTone } from "@/lib/ui-feedback";

export function useToasts() {
  return useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
}

/**
 * Darstellung der globalen Toasts. Einmal pro Layout einbinden:
 *   <Toaster />
 * Mobil über der Tab-Leiste (Safe-Area beachtet), am Desktop unten rechts.
 */
export function Toaster() {
  const items = useToasts();
  const t = useT();
  return (
    <div
      role="region"
      aria-label={t("shell.ui.notifications")}
      className="no-print pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0"
    >
      <ol aria-live="polite" aria-relevant="additions text" className="flex w-full max-w-sm flex-col gap-2">
        {items.map((it) => (
          <ToastCard key={it.id + it.createdAt} item={it} />
        ))}
      </ol>
    </div>
  );
}

const toneStyle = {
  success: { icon: CheckCircle2, cls: "text-ok" },
  error: { icon: XCircle, cls: "text-danger" },
  info: { icon: Info, cls: "text-ink-2" },
} as const;

function ToastCard({ item }: { item: ToastItem }) {
  const t = useT();
  const [paused, setPaused] = useState(false);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; id: number } | null>(null);

  // Auto-Ausblenden (pausiert bei Hover/Fokus/Wischen).
  useEffect(() => {
    if (!item.duration || paused) return;
    const timer = window.setTimeout(() => dismissToast(item.id), item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration, paused]);

  function close() {
    setLeaving(true);
    window.setTimeout(() => dismissToast(item.id), 160);
  }

  const { icon: Icon, cls } = toneStyle[item.tone];

  return (
    <li
      className={cn(
        "pointer-events-auto touch-pan-y select-none rounded-card border border-line bg-surface text-ink shadow-[0_8px_30px_rgba(0,0,0,0.12)] animate-rise",
        "motion-safe:transition-[opacity,transform] motion-safe:duration-150",
        leaving && "opacity-0 scale-95",
      )}
      style={dx ? { transform: `translateX(${dx}px)`, opacity: Math.max(0.2, 1 - Math.abs(dx) / 200), transition: "none" } : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        start.current = { x: e.clientX, id: e.pointerId };
        setPaused(true);
      }}
      onPointerMove={(e) => {
        if (start.current?.id !== e.pointerId) return;
        setDx(e.clientX - start.current.x);
      }}
      onPointerUp={(e) => {
        if (start.current?.id !== e.pointerId) return;
        const moved = e.clientX - start.current.x;
        start.current = null;
        setPaused(false);
        // Wischen oder Antippen schliesst den Toast.
        if (Math.abs(moved) > 60 || Math.abs(moved) < 6) close();
        else setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
        setPaused(false);
      }}
    >
      <div className="flex items-start gap-3 p-3.5 pr-2">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cls)} aria-hidden />
        <div className="min-w-0 flex-1 text-[15px] leading-snug">
          <p className="font-medium">
            <span className="sr-only">{item.tone === "error" ? "Fehler: " : item.tone === "success" ? "Erledigt: " : ""}</span>
            {item.message}
          </p>
          {item.description ? <p className="mt-0.5 text-sm text-ink-3">{item.description}</p> : null}
          {item.action ? (
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent rounded"
              onClick={() => {
                item.action?.onClick();
                close();
              }}
            >
              {item.action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("shell.ui.closeNotice")}
          className="press -my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/** Hilfsfunktion: zeigt für ein ActionResult passend Erfolg/Fehler an. */
export function toastResult(res: { ok: true; message?: string } | { ok: false; error: string }, successFallback?: string) {
  if (res.ok) {
    const msg = res.message ?? successFallback;
    if (msg) toast.success(msg);
  } else {
    toast.error(res.error);
  }
}
