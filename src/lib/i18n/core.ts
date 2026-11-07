/**
 * Übersetzungs-Kern ohne Server-Abhängigkeiten (auch in Client-Komponenten nutzbar).
 * Server-Code importiert normalerweise "@/lib/i18n" (inkl. getRequestLocale).
 */
import de from "./de";
import fr from "./fr";
import it from "./it";
import en from "./en";
import * as extraPlatform from "./extra/platform";
import * as extraMembers from "./extra/members";
import * as extraOps from "./extra/ops";
import * as extraShell from "./extra/shell";
import * as extraMoney from "./extra/money";
import * as extraShooting from "./extra/shooting";
import * as extraBookings from "./extra/bookings";
import * as extraAdmin1 from "./extra/admin1";
import * as extraAdmin2 from "./extra/admin2";
import * as extraAiHelp from "./extra/aihelp";
import * as extraAiContent from "./extra/aicontent";
import * as extraAiCoach from "./extra/aicoach";
import * as extraMisc from "./extra/misc";

import { DEFAULT_LOCALE, INTL_LOCALE, LOCALES, normalizeLocale, type Locale } from "./locales";

export * from "./locales";

export type Dict = Record<string, string>;
export type ExtraDict = { de?: Dict; fr?: Dict; it?: Dict; en?: Dict };
export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Akzeptiert die Formen, in denen Zusatz-Wörterbücher exportiert werden können:
 * `export default { de, fr, it, en }`, ein benannter Export mit diesem Aufbau oder
 * direkt `export const de = {...}` usw.
 */
export function pickExtra(mod: unknown): ExtraDict {
  const isDictShape = (v: unknown): v is ExtraDict =>
    !!v && typeof v === "object" && ("de" in v || "fr" in v || "it" in v || "en" in v);
  if (!mod || typeof mod !== "object") return {};
  if (isDictShape(mod) && typeof (mod as Record<string, unknown>).de === "object") return mod as ExtraDict;
  const rec = mod as Record<string, unknown>;
  if (isDictShape(rec.default)) return rec.default;
  for (const v of Object.values(rec)) if (isDictShape(v)) return v;
  return {};
}

/** Führt Basis- und Zusatz-Wörterbücher zusammen. Basis-Schlüssel haben Vorrang. */
export function mergeDicts(base: Record<Locale, Dict>, extras: ExtraDict[]): Record<Locale, Dict> {
  const out: Record<Locale, Dict> = { de: {}, fr: {}, it: {}, en: {} };
  for (const l of LOCALES) {
    for (const e of extras) Object.assign(out[l], e[l] ?? {});
    Object.assign(out[l], base[l]);
  }
  return out;
}

const DICTS: Record<Locale, Dict> = mergeDicts(
  { de, fr, it, en },
  [
    pickExtra(extraPlatform), pickExtra(extraMembers), pickExtra(extraOps),
    pickExtra(extraShell), pickExtra(extraMoney), pickExtra(extraShooting), pickExtra(extraBookings),
    pickExtra(extraAdmin1), pickExtra(extraAdmin2), pickExtra(extraAiHelp), pickExtra(extraAiContent),
    pickExtra(extraAiCoach), pickExtra(extraMisc),
  ],
);

// ---------------------------------------------------------------------------
// Übersteuerungen (Admin → Übersetzungen). Liegen auf globalThis, damit Server-Bundles
// (Instrumentation, RSC, SSR) im selben Prozess dieselbe Tabelle sehen. Auf dem Server schreibt
// nur overrides.ts (Laden aus der DB); im Browser setzt <I18nOverrides> sie beim Rendern aus
// den Daten des Root-Layouts (beim vollen Laden und nach router.refresh(), nicht bei
// Client-Navigationen – offene Sitzungen anderer sehen Client-Texte erst nach dem Neuladen).

export type OverrideMap = Partial<Record<Locale, Dict>>;

type OverrideStore = { map: OverrideMap; version: number; source: OverrideMap | null };
const STORE_KEY = "__standchefI18nOverrides";

function store(): OverrideStore {
  const g = globalThis as unknown as Record<string, OverrideStore | undefined>;
  let s = g[STORE_KEY];
  if (!s) {
    s = { map: {}, version: 0, source: null };
    g[STORE_KEY] = s;
  }
  return s;
}

/**
 * Ersetzt alle Übersteuerungen (pro Sprache Schlüssel → Text). Leere Texte werden ignoriert.
 * Dasselbe Objekt erneut übergeben ist ein No-op (günstig beim Rendern).
 */
export function setOverrides(map: OverrideMap): void {
  const s = store();
  if (s.source === map || s.map === map) return;
  const clean: OverrideMap = {};
  for (const l of LOCALES) {
    const src = map[l];
    if (!src) continue;
    const d: Dict = {};
    for (const [k, v] of Object.entries(src)) if (typeof v === "string" && v !== "") d[k] = v;
    if (Object.keys(d).length > 0) clean[l] = d;
  }
  s.map = clean;
  s.source = map;
  s.version += 1;
}

/** Aktuelle Übersteuerungen (nicht verändern). */
export function getOverrides(): OverrideMap {
  return store().map;
}

/** Zählt bei jedem setOverrides() hoch (z. B. für Memo-Abhängigkeiten). */
export function overridesVersion(): number {
  return store().version;
}

/** Text aus den mitgelieferten Wörterbüchern (ohne Übersteuerung), oder undefined. */
export function baseText(locale: Locale, key: string): string | undefined {
  return DICTS[locale][key];
}

/** Alle Schlüssel aller Sprachen (Vereinigung, sortiert) – für die Übersetzungs-Verwaltung. */
export function allDictionaryKeys(): string[] {
  const keys = new Set<string>();
  for (const l of LOCALES) for (const k of Object.keys(DICTS[l])) keys.add(k);
  return [...keys].sort();
}

/** Ersetzt {name}-Platzhalter. Unbekannte Platzhalter bleiben stehen. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Rohtext ohne Platzhalter-Ersetzung: Übersteuerung → Sprache → Deutsch (inkl. Übersteuerung) → Schlüssel. */
export function lookup(locale: Locale, key: string): string {
  const o = store().map;
  return o[locale]?.[key] ?? DICTS[locale][key] ?? o[DEFAULT_LOCALE]?.[key] ?? DICTS[DEFAULT_LOCALE][key] ?? key;
}

/**
 * Übersetzer für eine Sprache. Rückfall: Übersteuerung → Sprache → Deutsch → Schlüssel.
 * Übersteuerungen werden bei jedem Aufruf gelesen (nicht beim Erzeugen des Übersetzers).
 */
export function getT(locale: string | null | undefined): TFunction {
  const l = normalizeLocale(locale);
  return (key, vars) => interpolate(lookup(l, key), vars);
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

/**
 * Platzhalter-Namen, die als Text gespeichert werden (Pseudonymisierung beim Löschen eines Kontos,
 * Gäste, ehemalige Mitglieder), für die Anzeige in der Sprache der Person. Andere Namen bleiben.
 */
const PLACEHOLDER_NAME_KEY: Record<string, string> = {
  "Gelöschtes Mitglied": "misc.user.deleted",
  "Ehemaliges Mitglied": "misc.user.former",
  "Gast": "misc.user.guest",
};

export function displayUserName(name: string, t: TFunction): string;
export function displayUserName(name: string | null | undefined, t: TFunction): string | null | undefined;
export function displayUserName(name: string | null | undefined, t: TFunction): string | null | undefined {
  const key = name ? PLACEHOLDER_NAME_KEY[name] : undefined;
  return key ? t(key) : name;
}

/**
 * Tausendertrennzeichen je Sprache, unabhängig von der ICU-Version: Node und Chromium liefern für
 * de-CH/en-CH/it-CH teils U+2019, teils den ASCII-Apostroph, für fr-CH verschiedene Leerzeichen.
 * Unterschiedliche Ausgaben auf Server und Client lösen Hydrierungsfehler (React #418) aus.
 */
const GROUP_SEPARATOR: Record<Locale, string> = { de: "’", fr: "\u202F", it: "’", en: "’" };

/** Intl-Ausgabe mit festem Tausendertrennzeichen und geschützten Leerzeichen (Server = Client). */
function stableFormat(nf: Intl.NumberFormat, l: Locale, n: number): string {
  return nf.formatToParts(n).map((p) => (p.type === "group" ? GROUP_SEPARATOR[l] : p.type === "literal" ? p.value.replace(/\s/g, "\u00A0") : p.value)).join("");
}

/**
 * Zahl in der Sprache der Person («1’500», fr «1 500»). Für alles, was auch in Client-Komponenten
 * gerendert wird, statt `new Intl.NumberFormat(...).format()`.
 */
export function formatNumberL(n: number, locale: string | null | undefined, opts?: Intl.NumberFormatOptions): string {
  const l = normalizeLocale(locale);
  return stableFormat(new Intl.NumberFormat(INTL_LOCALE[l], opts), l, n);
}

export function formatMoneyLocale(cents: number, locale: string | null | undefined, currency = "CHF"): string {
  return formatNumberL(cents / 100, locale, { style: "currency", currency, minimumFractionDigits: 2 });
}
