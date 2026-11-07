import { APP_TZ, formatDateZurich, zurichParts } from "../../lib/time";
import { INTL_LOCALE, normalizeLocale } from "../../lib/i18n/locales";
import type { TFunction } from "../../lib/i18n/core";

const timeFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit" });

/** Uhrzeit in Schweizer Zeit, z.B. "18:05". */
export function fmtTime(d: Date) {
  return timeFmt.format(d);
}

const dateTimeFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Uhrzeit für einen Eintrag im Standbuch vom Tag `dayKey` ("YYYY-MM-DD"). Liegt der Zeitpunkt an
 * einem anderen Tag (z.B. Standbuch erst am Folgetag abgeschlossen), mit Datum: "31.10., 08:10".
 */
export function fmtTimeOn(d: Date, dayKey: string) {
  return zurichParts(d).dateStr === dayKey ? timeFmt.format(d) : dateTimeFmt.format(d);
}

/** @db.Date-Wert als Datum, z.B. "Sa., 07.03.2026". */
export function fmtDay(d: Date, opts?: Intl.DateTimeFormatOptions, locale?: string | null) {
  if (!locale || normalizeLocale(locale) === "de") return formatDateZurich(d, opts);
  return new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: APP_TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", ...opts }).format(d);
}

/** Titel eines Standbuchs: Anlage oder «Ganze Anlage». */
export function dayTitle(day: { resource: { name: string } | null }, t?: TFunction) {
  return day.resource?.name ?? (t ? t("shooting.range.wholeFacility") : "Ganze Anlage");
}

/** Benutzte Halbtage als Text; mit `t` übersetzt, sonst Deutsch. */
export function flagsLabel(f: { usedAm: boolean; usedPm: boolean; usedEvening: boolean }, t?: TFunction) {
  const l = (key: string, de: string) => (t ? t(`shooting.log.flag.${key}`) : de);
  const parts = [f.usedAm && l("am", "Vormittag"), f.usedPm && l("pm", "Nachmittag"), f.usedEvening && l("evening", "Abend")].filter(Boolean);
  return parts.length ? parts.join(", ") : l("none", "kein Halbtag");
}

/** Kurzform «V N A»; mit `t` die Buchstaben der Sprache (Schlüssel «shooting.log.flagLetters»). */
export function flagsShort(f: { usedAm: boolean; usedPm: boolean; usedEvening: boolean }, t?: TFunction) {
  const [am = "V", pm = "N", ev = "A"] = t ? t("shooting.log.flagLetters").split(" ") : [];
  return `${f.usedAm ? am : "·"} ${f.usedPm ? pm : "·"} ${f.usedEvening ? ev : "·"}`;
}

/** Zeitpunkt der Erstellung für Druckfusszeilen. */
export function printedAtLabel() {
  return new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
