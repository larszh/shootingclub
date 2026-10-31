import { APP_TZ, formatDateZurich, zurichParts } from "../../lib/time";

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
export function fmtDay(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return formatDateZurich(d, opts);
}

/** Titel eines Standbuchs: Anlage oder «Ganze Anlage». */
export function dayTitle(day: { resource: { name: string } | null }) {
  return day.resource?.name ?? "Ganze Anlage";
}

export function flagsLabel(f: { usedAm: boolean; usedPm: boolean; usedEvening: boolean }) {
  const parts = [f.usedAm && "Vormittag", f.usedPm && "Nachmittag", f.usedEvening && "Abend"].filter(Boolean);
  return parts.length ? parts.join(", ") : "kein Halbtag";
}

export function flagsShort(f: { usedAm: boolean; usedPm: boolean; usedEvening: boolean }) {
  return `${f.usedAm ? "V" : "·"} ${f.usedPm ? "N" : "·"} ${f.usedEvening ? "A" : "·"}`;
}

/** Zeitpunkt der Erstellung für Druckfusszeilen. */
export function printedAtLabel() {
  return new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
