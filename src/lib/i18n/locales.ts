/** Unterstützte Sprachen (ohne Wörterbücher – klein genug für Client-Komponenten). */
export type Locale = "de" | "fr" | "it";
export const LOCALES: readonly Locale[] = ["de", "fr", "it"] as const;
export const DEFAULT_LOCALE: Locale = "de";
export const LOCALE_LABELS: Record<Locale, string> = { de: "Deutsch", fr: "Français", it: "Italiano" };

/** BCP-47-Tag für Intl (Schweizer Varianten). */
export const INTL_LOCALE: Record<Locale, string> = { de: "de-CH", fr: "fr-CH", it: "it-CH" };

export function isLocale(v: unknown): v is Locale {
  return v === "de" || v === "fr" || v === "it";
}

/** Normalisiert beliebige Eingaben ("fr-CH", "IT", null) auf eine unterstützte Sprache. */
export function normalizeLocale(v: string | null | undefined): Locale {
  if (!v) return DEFAULT_LOCALE;
  const base = v.trim().toLowerCase().slice(0, 2);
  return isLocale(base) ? base : DEFAULT_LOCALE;
}
