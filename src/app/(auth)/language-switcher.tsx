"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

/** Muss zu LOCALE_COOKIE in src/lib/i18n/index.ts passen (dort serverseitig gelesen). */
const COOKIE = "standchef_locale";

/**
 * Sprachwahl auf den Anmeldeseiten (ohne Konto): setzt das Cookie «standchef_locale» für ein Jahr
 * und lädt die Seite neu. Nach der Anmeldung gilt die Sprache im Profil.
 */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    start(() => router.refresh());
  }

  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1">
      <Globe className="h-4 w-4 text-ink-3" aria-hidden />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => choose(l)}
          disabled={pending}
          aria-current={l === locale ? "true" : undefined}
          className={cn(
            "press inline-flex h-11 min-w-11 items-center justify-center rounded-control px-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent",
            l === locale ? "font-semibold text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink",
          )}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </nav>
  );
}
