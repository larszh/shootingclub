/**
 * Übersetzungs-Kern ohne Server-Abhängigkeiten (auch in Client-Komponenten nutzbar).
 * Server-Code importiert normalerweise "@/lib/i18n" (inkl. getRequestLocale).
 */
import de from "./de";
import fr from "./fr";
import it from "./it";
import * as extraPlatform from "./extra/platform";
import * as extraMembers from "./extra/members";
import * as extraOps from "./extra/ops";
import * as extraShell from "./extra/shell";
import * as extraMoney from "./extra/money";
import * as extraShooting from "./extra/shooting";
import * as extraBookings from "./extra/bookings";

import { DEFAULT_LOCALE, INTL_LOCALE, LOCALES, normalizeLocale, type Locale } from "./locales";

export * from "./locales";

export type Dict = Record<string, string>;
export type ExtraDict = { de?: Dict; fr?: Dict; it?: Dict };
export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Akzeptiert die Formen, in denen Zusatz-Wörterbücher exportiert werden können:
 * `export default { de, fr, it }`, ein benannter Export mit diesem Aufbau oder
 * direkt `export const de = {...}` usw.
 */
export function pickExtra(mod: unknown): ExtraDict {
  const isDictShape = (v: unknown): v is ExtraDict =>
    !!v && typeof v === "object" && ("de" in v || "fr" in v || "it" in v);
  if (!mod || typeof mod !== "object") return {};
  if (isDictShape(mod) && typeof (mod as Record<string, unknown>).de === "object") return mod as ExtraDict;
  const rec = mod as Record<string, unknown>;
  if (isDictShape(rec.default)) return rec.default;
  for (const v of Object.values(rec)) if (isDictShape(v)) return v;
  return {};
}

/** Führt Basis- und Zusatz-Wörterbücher zusammen. Basis-Schlüssel haben Vorrang. */
export function mergeDicts(base: Record<Locale, Dict>, extras: ExtraDict[]): Record<Locale, Dict> {
  const out: Record<Locale, Dict> = { de: {}, fr: {}, it: {} };
  for (const l of LOCALES) {
    for (const e of extras) Object.assign(out[l], e[l] ?? {});
    Object.assign(out[l], base[l]);
  }
  return out;
}

const DICTS: Record<Locale, Dict> = mergeDicts(
  { de, fr, it },
  [
    pickExtra(extraPlatform), pickExtra(extraMembers), pickExtra(extraOps),
    pickExtra(extraShell), pickExtra(extraMoney), pickExtra(extraShooting), pickExtra(extraBookings),
  ],
);

/** Ersetzt {name}-Platzhalter. Unbekannte Platzhalter bleiben stehen. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Übersetzer für eine Sprache. Rückfall: Deutsch, dann der Schlüssel selbst. */
export function getT(locale: string | null | undefined): TFunction {
  const dict = DICTS[normalizeLocale(locale)];
  const fallback = DICTS[DEFAULT_LOCALE];
  return (key, vars) => interpolate(dict[key] ?? fallback[key] ?? key, vars);
}

/** Für Tests und Diagnose: alle Schlüssel einer Sprache. */
export function dictionaryKeys(locale: Locale): string[] {
  return Object.keys(DICTS[locale]);
}

// ---------------------------------------------------------------------------
// Formatierung pro Sprache (Zeitzone immer Europe/Zurich)

const TZ = "Europe/Zurich";

export function formatDate(d: Date, locale: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", ...opts,
  }).format(d);
}

export function formatDateTime(d: Date, locale: string | null | undefined): string {
  return formatDate(d, locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatMoneyLocale(cents: number, locale: string | null | undefined, currency = "CHF"): string {
  return new Intl.NumberFormat(INTL_LOCALE[normalizeLocale(locale)], {
    style: "currency", currency, minimumFractionDigits: 2,
  }).format(cents / 100);
}
