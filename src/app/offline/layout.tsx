import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };

/**
 * Schlanke Hülle für die Offline-Seiten. Bewusst ohne Datenbank und ohne Anmeldung, damit der
 * Service Worker die Seiten vorab speichern und ohne Verbindung ausliefern kann.
 */
export default function OfflineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-20 bg-bg/80 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-8">
          {/* Klassische Links (kein Client-Routing), damit der Service Worker die Seite liefern kann */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- volle Navigation, damit der Service Worker antwortet */}
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight"><Logo size={24} /> Standchef</a>
          <a href="/offline" className="press inline-flex h-10 items-center rounded-full px-3 text-sm font-medium text-ink-2 hover:bg-surface-2">Übersicht</a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-28 md:px-8 md:pb-10">{children}</main>
    </div>
  );
}
