"use client";

import Link from "next/link";
import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, RefreshCw, WifiOff } from "lucide-react";
import { buttonClasses } from "./index";
import { MissIllustration, OfflineIllustration } from "./illustrations";
import { useOnlineStatus } from "./controls";
import { isNetworkError } from "@/lib/ui-feedback";

/**
 * Gemeinsame Fehleransicht für error.tsx-Dateien. Erkennt fehlende Verbindung und
 * weist dann auf die Offline-Inhalte hin.
 */
export function ErrorView({ error, reset, compact }: { error: Error & { digest?: string }; reset: () => void; compact?: boolean }) {
  const online = useOnlineStatus();
  const router = useRouter();
  const offline = !online || isNetworkError(error);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={compact ? "py-6" : "flex min-h-[60dvh] items-center justify-center px-4 py-10"}>
      <div className="animate-rise mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex justify-center">{offline ? <OfflineIllustration size={112} /> : <MissIllustration size={112} />}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{offline ? "Keine Verbindung" : "Da ging etwas daneben"}</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          {offline
            ? "Keine Verbindung – Inhalte, die du schon geöffnet hast, sind offline verfügbar. Resultate, die du jetzt erfasst, werden übertragen, sobald du wieder online bist."
            : "Diese Seite konnte nicht geladen werden. Versuch es bitte nochmals. Wenn es wieder passiert, hilft oft ein Neuladen der App."}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() =>
              // Serverdaten neu holen und die Fehlergrenze zurücksetzen.
              startTransition(() => {
                router.refresh();
                reset();
              })
            } className={buttonClasses("primary", "lg")}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Nochmals versuchen
          </button>
          {offline ? (
            // Bewusst ohne Client-Router: der Service Worker liefert /offline aus dem Cache.
            <a href="/offline" className={buttonClasses("secondary", "lg")}>
              <WifiOff className="h-4 w-4" aria-hidden /> Offline-Inhalte
            </a>
          ) : (
            <Link href="/" className={buttonClasses("secondary", "lg")}>
              <Home className="h-4 w-4" aria-hidden /> Zur Startseite
            </Link>
          )}
        </div>
        {error.digest ? <p className="mt-6 text-xs text-ink-3">Fehlercode: <span className="font-mono">{error.digest}</span></p> : null}
      </div>
    </div>
  );
}
