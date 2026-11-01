"use client";

import "./globals.css";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/logo";
import { ErrorView } from "@/components/ui/error-view";
import { LocaleProvider } from "@/components/locale";
import { DEFAULT_LOCALE, INTL_LOCALE, getT, normalizeLocale, type Locale } from "@/lib/i18n/core";

const noopSubscribe = () => () => undefined;

/** Ohne Root-Layout kennen wir die Sprache des Requests nicht: Browsersprache, sonst Deutsch. */
function useBrowserLocale(): Locale {
  return useSyncExternalStore(noopSubscribe, () => normalizeLocale(navigator.language), () => DEFAULT_LOCALE);
}

/** Letzte Rückfallebene, wenn sogar das Root-Layout fehlschlägt. Muss eigenes <html> rendern. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useBrowserLocale();
  const t = getT(locale);
  return (
    <html lang={INTL_LOCALE[locale]}>
      <body className="font-sans">
        <title>{`${t("shell.error.metaTitle")} · Standchef`}</title>
        <LocaleProvider locale={locale}>
          <div className="min-h-dvh">
            <div className="flex justify-center pt-10">
              <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
                <Logo size={32} /> Standchef
              </span>
            </div>
            <ErrorView error={error} reset={reset} />
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
