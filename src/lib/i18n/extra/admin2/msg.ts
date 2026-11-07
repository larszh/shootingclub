import { formatDate, type TFunction } from "@/lib/i18n/core";

/**
 * Meldungen mit Platzhaltern als ein String (z.B. für zod-Fehlermeldungen in Schemas ohne Sprache):
 * `msg("adm2.common.maxChars", { max: 191 })` → `adm2.common.maxChars|{"max":191}`. `tMsg` übersetzt
 * beides, Schlüssel mit und ohne Platzhalter; andere Texte bleiben unverändert.
 */
export function msg(key: string, vars?: Record<string, string | number>): string {
  return vars ? `${key}|${JSON.stringify(vars)}` : key;
}

export function tMsg(t: TFunction, message: string | null | undefined): string {
  if (!message) return "";
  const i = message.indexOf("|");
  if (i < 0) return t(message);
  try {
    const vars = JSON.parse(message.slice(i + 1)) as Record<string, string | number>;
    return t(message.slice(0, i), vars);
  } catch {
    return t(message);
  }
}

/** Kalendertag «YYYY-MM-DD» als Datum in der Sprache (de/fr/it: TT.MM.JJJJ, en: en-CH). Leer bei null. */
export function dayKeyLabel(day: string | null | undefined, locale: string | null | undefined): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  return formatDate(new Date(`${day}T12:00:00Z`), locale, { timeZone: "UTC" });
}
