/**
 * Übersetzte Bezeichnungen für Schiess-Ansichten (Namensraum «shooting.»).
 * Rückfall: deutsche Bezeichnung aus den Typen (z.B. unbekannte Codes aus älteren Daten).
 * Client-sicher: nimmt eine bereits erzeugte Übersetzungsfunktion entgegen.
 */
import { INTL_LOCALE, type Locale, type TFunction } from "@/lib/i18n/core";
import { disciplineLabel, officialKindLabel, positionLabel, scoringModeLabel } from "@/modules/scores/types";

/** Übersetzung mit Rückfall, falls der Schlüssel fehlt. */
export function tOr(t: TFunction, key: string, fallback: string, vars?: Record<string, string | number>): string {
  const v = t(key, vars);
  return v === key ? fallback : v;
}

export function disciplineText(t: TFunction, key: string): string {
  return tOr(t, `shooting.discipline.${key}`, disciplineLabel(key));
}

export function officialKindText(t: TFunction, key: string | null | undefined): string {
  if (!key) return "";
  return tOr(t, `shooting.officialKind.${key}`, officialKindLabel(key));
}

export function scoringModeText(t: TFunction, key: string, short = false): string {
  return tOr(t, `shooting.scoringMode.${key}${short ? ".short" : ""}`, scoringModeLabel(key, short));
}

export function positionText(t: TFunction, key: string | undefined): string {
  return tOr(t, `shooting.position.${key || "ANY"}`, positionLabel(key));
}

/** Einzahl/Mehrzahl: Schlüssel «<key>.one» / «<key>.other», Platzhalter {n}. */
export function tCount(t: TFunction, key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? "one" : "other"}`, { n, ...vars });
}

const DE_MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/**
 * Zeitraum-Bezeichnung einer Rangliste (z.B. «Oktober 2026», «Jahr 2026», «Alle Zeiten») in der
 * gewünschten Sprache. `label` ist die deutsche Bezeichnung aus periodRange().
 */
export function periodLabelText(t: TFunction, locale: Locale, period: string, label: string): string {
  if (period === "all") return tOr(t, "shooting.period.allTime", label);
  const year = label.match(/\d{4}/)?.[0];
  if (!year) return label;
  if (period === "year") return tOr(t, "shooting.period.yearN", label, { year });
  const month = DE_MONTHS.findIndex((m) => label.startsWith(m));
  if (month === -1) return label;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(year), month, 15)));
}

/** Umschalter Monat / Jahr / Alle. */
export function periodTabText(t: TFunction, key: string, fallback: string): string {
  return tOr(t, `shooting.period.tab.${key}`, fallback);
}

/** Zeitraumfilter der Durchgangsliste (Schlüssel "" = alle Zeiten). */
export function matchPeriodText(t: TFunction, key: string, fallback: string): string {
  return tOr(t, `shooting.period.match.${key || "all"}`, fallback);
}

/** Bezeichnung der Höchstwerte (Zehner / Höchstwerte / × beste Zone). */
export function topShotsText(t: TFunction, label: string): string {
  const key = label === "Zehner" ? "tens" : label === "Höchstwerte" ? "max" : label === "× beste Zone" ? "bestZone" : null;
  return key ? tOr(t, `shooting.topShots.${key}`, label) : label;
}
