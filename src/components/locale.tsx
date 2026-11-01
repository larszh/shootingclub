"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getT, normalizeLocale, type Locale, type TFunction } from "@/lib/i18n/core";

/**
 * Sprache der aktuellen Seite für Client-Komponenten. Das Root-Layout setzt sie aus
 * getRequestLocale(); ohne Provider gilt Deutsch. Für Komponenten, die tief in geteilten
 * UI-Bausteinen stecken (Dialoge, Toasts, Offline-Anzeige), statt die Sprache als Prop
 * durchzureichen.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Übersetzer für die Sprache der aktuellen Seite. */
export function useT(): TFunction {
  const locale = useLocale();
  return useMemo(() => getT(locale), [locale]);
}

/* ------------------------------------------------------------------ Offline */

const STORED_LOCALE_KEY = "sc-locale";

/** Merkt sich die Sprache im Browser, damit die statischen Offline-Seiten sie kennen. */
export function rememberLocale(locale: Locale) {
  try {
    localStorage.setItem(STORED_LOCALE_KEY, locale);
  } catch {
    // Speicher gesperrt (privater Modus): Offline-Seiten fallen auf die Browsersprache zurück
  }
}

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORED_LOCALE_KEY);
    if (v === "de" || v === "fr" || v === "it") return v;
  } catch {
    // ignorieren
  }
  return normalizeLocale(typeof navigator === "undefined" ? null : navigator.language);
}

const noopSubscribe = () => () => undefined;

/**
 * Für die statischen Offline-Seiten (ohne Request-Sprache): zuletzt in der App verwendete
 * Sprache aus dem Browser, sonst die Browsersprache. Serverseitig und beim ersten Rendern Deutsch.
 */
export function StoredLocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(noopSubscribe, readStoredLocale, () => DEFAULT_LOCALE);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
