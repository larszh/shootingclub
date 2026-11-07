"use client";

import { createContext, useContext, useState } from "react";
import { Languages } from "lucide-react";
import { getT, LOCALE_LABELS, type Locale } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";

type Ctx = { showOriginal: boolean; toggle: () => void };
const ToggleContext = createContext<Ctx | null>(null);

/**
 * Umschalter Übersetzung/Original für Inhalte in Listen (z.B. Mitteilungen). Beide Fassungen
 * werden auf dem Server gerendert und hier nur gewechselt. Den Knopf (TranslationSwitchButton)
 * in beide Fassungen setzen.
 */
export function TranslationToggle({ translated, original }: { translated: React.ReactNode; original: React.ReactNode }) {
  const [showOriginal, setShowOriginal] = useState(false);
  return (
    <ToggleContext.Provider value={{ showOriginal, toggle: () => setShowOriginal((v) => !v) }}>
      {showOriginal ? original : translated}
    </ToggleContext.Provider>
  );
}

/** «Automatisch übersetzt · Original anzeigen» bzw. «Original (Deutsch) · Übersetzung anzeigen». */
export function TranslationSwitchButton({ locale, sourceLocale, reviewed, className }: { locale: Locale; sourceLocale: Locale; reviewed: boolean; className?: string }) {
  const ctx = useContext(ToggleContext);
  if (!ctx) return null;
  const t = getT(locale);
  return (
    <p className={cn("mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3", className)}>
      <Languages className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{ctx.showOriginal ? t("aicontent.view.original", { lang: LOCALE_LABELS[sourceLocale] }) : t(reviewed ? "aicontent.view.translated" : "aicontent.view.auto")}</span>
      <span aria-hidden>·</span>
      <button type="button" onClick={ctx.toggle} aria-pressed={ctx.showOriginal}
        className="inline-flex min-h-11 items-center font-medium text-accent underline-offset-2 hover:underline">
        {ctx.showOriginal ? t("aicontent.view.showTranslation") : t("aicontent.view.showOriginal")}
      </button>
    </p>
  );
}
