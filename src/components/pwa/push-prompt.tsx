"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { Spinner } from "@/components/ui/form";
import { toast } from "@/lib/ui-feedback";
import { enablePush, getPushState, resyncPush, type PushState } from "@/lib/push/client";

const DISMISS_KEY = "sc-push-prompt-dismissed";
const RESYNC_KEY = "sc-push-resynced";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Speicher gesperrt (privater Modus): Hinweis erscheint beim nächsten Besuch wieder
  }
}

/**
 * Einmaliger Vorschlag, Benachrichtigungen einzuschalten (z.B. auf dem Dashboard).
 * Erscheint nur, wenn Push auf diesem Gerät möglich, aber noch nicht eingeschaltet ist,
 * bzw. auf dem iPhone als Hinweis zum Home-Bildschirm. «Später» wird im Browser gemerkt.
 */
export function PushPrompt({ className }: { className?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getPushState().then((s) => {
      if (cancelled) return;
      setState(s);
      setHidden(readDismissed());
      // Bereits eingeschaltet: einmal pro Sitzung beim Server bestätigen (Kontowechsel auf demselben Gerät)
      if (s === "enabled") {
        try {
          if (!sessionStorage.getItem(RESYNC_KEY)) {
            sessionStorage.setItem(RESYNC_KEY, "1");
            void resyncPush();
          }
        } catch {
          void resyncPush();
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || (state !== "disabled" && state !== "ios-needs-install")) return null;

  const dismiss = () => {
    writeDismissed();
    setHidden(true);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const next = await enablePush();
      setState(next);
      if (next === "enabled") {
        toast.success("Benachrichtigungen eingeschaltet.");
        writeDismissed();
        setHidden(true);
      } else if (next === "denied") {
        toast.error("Benachrichtigungen wurden nicht erlaubt.", { description: "Du kannst sie jederzeit in den Einstellungen des Browsers erlauben." });
        dismiss();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={["animate-rise relative p-4 pr-12", className].filter(Boolean).join(" ")}>
      <button type="button" onClick={dismiss} aria-label="Hinweis schliessen" className="press absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-control text-ink-3 hover:text-ink">
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Nichts mehr verpassen</p>
          {state === "ios-needs-install" ? (
            <p className="mt-0.5 text-sm text-ink-3">
              Auf dem iPhone kommen Benachrichtigungen, wenn Standchef auf dem Home-Bildschirm liegt: in Safari «Teilen» → «Zum Home-Bildschirm».
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-ink-3">Erhalte Chat-Nachrichten, Absagen und Rechnungen direkt auf dieses Gerät.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === "disabled" ? (
              <Button onClick={() => void enable()} disabled={busy}>
                {busy ? <Spinner /> : <Bell className="h-4 w-4" aria-hidden />} Einschalten
              </Button>
            ) : null}
            <Link href="/me/notifications" className="press inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">
              Einstellungen
            </Link>
            <button type="button" onClick={dismiss} className="press inline-flex h-11 items-center rounded-control px-3 text-sm font-medium text-ink-3 hover:bg-surface-2">
              Später
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
