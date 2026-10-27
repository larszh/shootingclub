"use client";

import "./globals.css";
import { Logo } from "@/components/logo";
import { ErrorView } from "@/components/ui/error-view";

/** Letzte Rückfallebene, wenn sogar das Root-Layout fehlschlägt. Muss eigenes <html> rendern. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de-CH">
      <body className="font-sans">
        <title>Fehler · Standchef</title>
        <div className="min-h-dvh">
          <div className="flex justify-center pt-10">
            <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
              <Logo size={32} /> Standchef
            </span>
          </div>
          <ErrorView error={error} reset={reset} />
        </div>
      </body>
    </html>
  );
}
