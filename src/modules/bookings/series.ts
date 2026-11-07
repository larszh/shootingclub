/**
 * Serienbuchungen (wiederkehrende Reservationen, z.B. jeden Dienstag 18–20 Uhr).
 * Reine Logik ohne Server-Abhängigkeiten (testbar): Termine erzeugen, einzeln prüfen, Konflikte trennen.
 *
 * Wochentage nach ISO 8601: 1 = Montag … 7 = Sonntag (BookingSeries.weekdays als CSV, z.B. "1,3").
 * Zeiten «HH:mm» in Schweizer Zeit; die Umrechnung nach UTC erfolgt pro Termin (Sommer-/Winterzeit).
 */
import { addDays, zurichToUtc } from "../../lib/time";
import { peakConcurrency, type Interval, type UnitInterval } from "./availability";
import type { OpeningHours } from "./types";

/** Höchstzahl Termine pro Serie (ein Jahr wöchentlich an drei Tagen ≈ 156). */
export const SERIES_MAX_OCCURRENCES = 200;
/** Längster Zeitraum einer Serie in Tagen. */
export const SERIES_MAX_DAYS = 366;

export const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
/** Kurzbezeichnungen ISO-Wochentag → «Mo» … «So». */
export const ISO_WEEKDAY_SHORT: Record<number, string> = { 1: "Mo", 2: "Di", 3: "Mi", 4: "Do", 5: "Fr", 6: "Sa", 7: "So" };
export const ISO_WEEKDAY_LONG: Record<number, string> = { 1: "Montag", 2: "Dienstag", 3: "Mittwoch", 4: "Donnerstag", 5: "Freitag", 6: "Samstag", 7: "Sonntag" };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** ISO-Wochentag (1 = Mo … 7 = So) eines Kalenderdatums «YYYY-MM-DD». */
export function isoWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 = So
  return d === 0 ? 7 : d;
}

/** CSV «1,3» → [1, 3] (sortiert, ohne Duplikate, nur 1–7). */
export function parseWeekdays(csv: string | null | undefined): number[] {
  if (!csv) return [];
  const days = csv.split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

/** [3, 1, 3] → «1,3» */
export function formatWeekdaysCsv(days: number[]): string {
  return parseWeekdays(days.join(",")).join(",");
}

/** «Di, Do» */
export function weekdaysLabel(days: number[] | string, long = false): string {
  const list = typeof days === "string" ? parseWeekdays(days) : parseWeekdays(days.join(","));
  return list.map((d) => (long ? ISO_WEEKDAY_LONG[d] : ISO_WEEKDAY_SHORT[d])).join(", ");
}

export function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

/** Dauer in Minuten zwischen zwei Uhrzeiten am selben Tag (0 oder negativ = ungültig). */
export function minutesBetween(startTime: string, endTime: string) {
  return toMinutes(endTime) - toMinutes(startTime);
}

export type SeriesPattern = { fromDate: string; untilDate: string; weekdays: number[] };

export type SeriesPatternError = "invalidDate" | "untilBeforeFrom" | "tooLong" | "noWeekdays" | "invalidTime" | "endBeforeStart" | "tooMany" | "empty";

/** Prüft Zeitraum, Wochentage und Zeiten einer Serie. */
export function validatePattern(p: SeriesPattern & { startTime: string; endTime: string }): SeriesPatternError | null {
  if (!DATE_RE.test(p.fromDate) || !DATE_RE.test(p.untilDate)) return "invalidDate";
  if (p.untilDate < p.fromDate) return "untilBeforeFrom";
  if (daysBetween(p.fromDate, p.untilDate) > SERIES_MAX_DAYS) return "tooLong";
  if (!parseWeekdays(p.weekdays.join(",")).length) return "noWeekdays";
  if (!TIME_RE.test(p.startTime) || !TIME_RE.test(p.endTime)) return "invalidTime";
  if (minutesBetween(p.startTime, p.endTime) <= 0) return "endBeforeStart";
  const n = seriesDates(p, SERIES_MAX_OCCURRENCES + 1).length;
  if (n === 0) return "empty";
  if (n > SERIES_MAX_OCCURRENCES) return "tooMany";
  return null;
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Alle Kalendertage der Serie: ab `fromDate` bis und mit `untilDate`, an den gewählten Wochentagen.
 * Höchstens `limit` Einträge.
 */
export function seriesDates(p: SeriesPattern, limit = SERIES_MAX_OCCURRENCES): string[] {
  const days = new Set(parseWeekdays(p.weekdays.join(",")));
  if (!days.size || !DATE_RE.test(p.fromDate) || !DATE_RE.test(p.untilDate) || p.untilDate < p.fromDate) return [];
  const out: string[] = [];
  for (let d = p.fromDate; d <= p.untilDate && out.length < limit; d = addDays(d, 1)) {
    if (days.has(isoWeekday(d))) out.push(d);
  }
  return out;
}

export type Occurrence = { date: string; startsAt: Date; endsAt: Date };

/** Termine mit Beginn und Ende in UTC (pro Tag umgerechnet, damit 18:00 auch nach der Zeitumstellung 18:00 bleibt). */
export function seriesOccurrences(p: SeriesPattern & { startTime: string; endTime: string }, limit = SERIES_MAX_OCCURRENCES): Occurrence[] {
  return seriesDates(p, limit).map((date) => ({ date, startsAt: zurichToUtc(date, p.startTime), endsAt: zurichToUtc(date, p.endTime) }));
}

export type ConflictReason = "past" | "closed" | "blocked" | "full" | "window";

export type OccurrenceCheckInput = {
  occurrence: Occurrence & { startTime: string; endTime: string };
  openingHours: OpeningHours;
  capacity: number;
  requestedUnits: number;
  /** Aktive Buchungen der Ressource (mit Einheiten). */
  bookings: UnitInterval[];
  /** Sperrzeiten (Ressource oder ganzer Verein). */
  blocks: Interval[];
  /** Bewilligte Schiesszeiten (Modul «Standbetrieb»): false = ausserhalb. Ohne Angabe gilt keine Einschränkung. */
  insideWindow?: boolean;
  now?: Date;
};

/**
 * Prüft einen Termin: nicht in der Vergangenheit, innerhalb der Öffnungszeiten des Wochentags,
 * keine Sperrzeit, genug Kapazität, innerhalb der Schiesszeiten. Liefert null, wenn er frei ist.
 */
export function checkOccurrence(c: OccurrenceCheckInput): ConflictReason | null {
  const now = c.now ?? new Date();
  const o = c.occurrence;
  if (o.startsAt <= now) return "past";
  // Öffnungszeiten: Schlüssel 0 = So … 6 = Sa (wie BookingSettings.openingHours).
  const ranges = c.openingHours[String(isoWeekday(o.date) % 7)] ?? [];
  const from = toMinutes(o.startTime);
  const to = toMinutes(o.endTime);
  if (!ranges.some(([a, b]) => toMinutes(a) <= from && to <= toMinutes(b))) return "closed";
  const slot = { startsAt: o.startsAt, endsAt: o.endsAt };
  if (c.blocks.some((b) => b.startsAt < slot.endsAt && b.endsAt > slot.startsAt)) return "blocked";
  if (peakConcurrency(c.bookings, slot) + Math.max(1, c.requestedUnits) > c.capacity) return "full";
  if (c.insideWindow === false) return "window";
  return null;
}

export type CheckedOccurrence<T extends Occurrence = Occurrence> = T & { conflict: ConflictReason | null };

/** Trennt geprüfte Termine in buchbare und Konflikte; zählt Konflikte nach Grund. */
export function partitionOccurrences<T extends Occurrence>(list: Array<CheckedOccurrence<T>>) {
  const free = list.filter((o) => !o.conflict);
  const conflicts = list.filter((o) => !!o.conflict);
  const byReason: Partial<Record<ConflictReason, number>> = {};
  for (const c of conflicts) byReason[c.conflict!] = (byReason[c.conflict!] ?? 0) + 1;
  return { free, conflicts, byReason };
}

/** Deutsche Bezeichnung eines Konfliktgrunds (für die Verwaltung). */
export const CONFLICT_LABEL: Record<ConflictReason, string> = {
  past: "Vergangen",
  closed: "Ausserhalb der Öffnungszeiten",
  blocked: "Gesperrt",
  full: "Belegt",
  window: "Ausserhalb der Schiesszeiten",
};

/** Zusammenfassung «12 Termine buchbar, 2 übersprungen (1× Belegt, 1× Gesperrt)». */
export function conflictSummary(freeCount: number, byReason: Partial<Record<ConflictReason, number>>) {
  const parts = (Object.keys(byReason) as ConflictReason[]).map((r) => `${byReason[r]}× ${CONFLICT_LABEL[r]}`);
  const skipped = Object.values(byReason).reduce((s, n) => s + (n ?? 0), 0);
  const head = `${freeCount} ${freeCount === 1 ? "Termin" : "Termine"} buchbar`;
  return skipped ? `${head}, ${skipped} übersprungen (${parts.join(", ")})` : head;
}

/** Nur künftige, aktive Termine einer Serie werden beim Stornieren der ganzen Serie storniert. */
export function cancellableOccurrences<T extends { status: string; startsAt: Date }>(list: T[], now = new Date()) {
  return list.filter((b) => (b.status === "PENDING" || b.status === "CONFIRMED") && b.startsAt > now);
}
