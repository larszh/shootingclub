/**
 * Standbetrieb (Modul «range»): reine Funktionen ohne Datenbank, für Client und Server.
 * Halbtage aus Besuchszeiten, Kontingent zählen, Schiesszeiten prüfen, Alter aus Jahrgang.
 */
import { zurichParts } from "../../lib/time";

// --- Zeiten ---------------------------------------------------------------------------

/** "HH:MM" → Minuten ab Mitternacht; null bei ungültiger Eingabe. "24:00" ist als Ende erlaubt. */
export function parseTimeToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59) return null;
  if (h === 24 && min === 0) return 1440;
  if (h > 23) return null;
  return h * 60 + min;
}

/** Minuten ab Mitternacht → "HH:MM". */
export function formatMinutes(min: number) {
  const m = Math.max(0, Math.min(1440, Math.round(min)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minuten ab Mitternacht (Schweizer Zeit) eines Zeitpunkts. */
export function zurichMinutes(at: Date) {
  const t = zurichParts(at).timeStr;
  return parseTimeToMinutes(t) ?? 0;
}

/** Schweizer Kalendertag "YYYY-MM-DD" eines Zeitpunkts. */
export function zurichDayKey(at: Date) {
  return zurichParts(at).dateStr;
}

/** @db.Date-Wert (UTC-Mitternacht des Schweizer Kalendertags) → "YYYY-MM-DD". */
export function dbDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → @db.Date-Wert (UTC-Mitternacht). */
export function dayKeyToDbDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

// --- Schiesshalbtage ---------------------------------------------------------------

export type HalfDayFlags = { usedAm: boolean; usedPm: boolean; usedEvening: boolean };

/** Grenzen der Halbtage in Minuten: Vormittag < 12:00, Nachmittag 12:00–18:00, Abend ab 18:00. */
export const NOON = 12 * 60;
export const EVENING = 18 * 60;

/**
 * Halbtage aus Zeitintervallen in Minuten ab Mitternacht (start inklusiv, end exklusiv).
 * Ein Intervall zählt für jeden Halbtag, den es berührt. Ein reiner Zeitpunkt (start = end)
 * zählt für den Halbtag, in dem er liegt.
 */
export function halfDayFlagsFromIntervals(intervals: Array<{ start: number; end: number }>): HalfDayFlags {
  const flags: HalfDayFlags = { usedAm: false, usedPm: false, usedEvening: false };
  for (const iv of intervals) {
    const start = Math.max(0, Math.min(1440, iv.start));
    const end = Math.max(start, Math.min(1440, iv.end));
    if (end === start) {
      if (start < NOON) flags.usedAm = true;
      else if (start < EVENING) flags.usedPm = true;
      else flags.usedEvening = true;
      continue;
    }
    if (start < NOON) flags.usedAm = true;
    if (start < EVENING && end > NOON) flags.usedPm = true;
    if (end > EVENING) flags.usedEvening = true;
  }
  return flags;
}

/**
 * Halbtage eines Schiesstags aus den Besuchen (Check-in bis Check-out). Offene Besuche zählen
 * bis `until` (z.B. Abschlusszeit). Teile ausserhalb des Kalendertags `dayKey` werden abgeschnitten.
 */
export function halfDayFlagsFromVisits(dayKey: string, visits: Array<{ checkedInAt: Date; checkedOutAt: Date | null }>, until: Date): HalfDayFlags {
  const intervals: Array<{ start: number; end: number }> = [];
  for (const v of visits) {
    const out = v.checkedOutAt ?? until;
    const inKey = zurichDayKey(v.checkedInAt);
    const outKey = zurichDayKey(out);
    if (inKey > dayKey || outKey < dayKey) continue;
    const start = inKey < dayKey ? 0 : zurichMinutes(v.checkedInAt);
    const end = outKey > dayKey ? 1440 : out < v.checkedInAt ? start : zurichMinutes(out);
    intervals.push({ start, end: Math.max(start, end) });
  }
  return halfDayFlagsFromIntervals(intervals);
}

export function countFlags(f: HalfDayFlags) {
  return (f.usedAm ? 1 : 0) + (f.usedPm ? 1 : 0) + (f.usedEvening ? 1 : 0);
}

// --- Kontingent ------------------------------------------------------------------------

export type QuotaDay = HalfDayFlags & { date: Date; resourceId: string | null };

/** Tage, die für ein Kontingent zählen: Ressource null = ganze Anlage (alle Tage), sonst Tage der Ressource und der ganzen Anlage. */
export function daysForQuota<T extends { resourceId: string | null }>(days: T[], quotaResourceId: string | null): T[] {
  if (quotaResourceId === null) return days;
  return days.filter((d) => d.resourceId === quotaResourceId || d.resourceId === null);
}

/**
 * Halbtage pro Kalendertag zusammengefasst (mehrere Standbücher am selben Tag zählen nur einmal je Halbtag).
 * Sortiert nach Datum.
 */
export function mergeHalfDaysByDate(days: Array<HalfDayFlags & { date: Date }>): Array<HalfDayFlags & { dayKey: string; count: number }> {
  const map = new Map<string, HalfDayFlags>();
  for (const d of days) {
    const key = dbDateKey(d.date);
    const cur = map.get(key) ?? { usedAm: false, usedPm: false, usedEvening: false };
    map.set(key, { usedAm: cur.usedAm || d.usedAm, usedPm: cur.usedPm || d.usedPm, usedEvening: cur.usedEvening || d.usedEvening });
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dayKey, f]) => ({ dayKey, ...f, count: countFlags(f) }))
    .filter((d) => d.count > 0);
}

/** Verbrauchte Halbtage eines Kontingents. */
export function countHalfDays(days: QuotaDay[], quotaResourceId: string | null) {
  return mergeHalfDaysByDate(daysForQuota(days, quotaResourceId)).reduce((a, d) => a + d.count, 0);
}

export type MonthRow = { month: number; am: number; pm: number; evening: number; total: number; days: number };

/** Halbtage pro Monat (1–12) aus zusammengefassten Tagen. */
export function halfDaysByMonth(merged: Array<HalfDayFlags & { dayKey: string }>): MonthRow[] {
  const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, am: 0, pm: 0, evening: 0, total: 0, days: 0 }));
  for (const d of merged) {
    const m = Number(d.dayKey.slice(5, 7));
    const row = rows[m - 1];
    if (!row) continue;
    const c = countFlags(d);
    if (c === 0) continue;
    row.am += d.usedAm ? 1 : 0;
    row.pm += d.usedPm ? 1 : 0;
    row.evening += d.usedEvening ? 1 : 0;
    row.total += c;
    row.days += 1;
  }
  return rows;
}

export type QuotaStatus = { max: number; used: number; remaining: number; pct: number; tone: "ok" | "warn" | "danger" };

/** Stand eines Kontingents; ab 80 % Warnung, ab 100 % überschritten. */
export function quotaStatus(max: number, used: number): QuotaStatus {
  const remaining = max - used;
  const pct = max > 0 ? Math.round((used / max) * 100) : used > 0 ? 100 : 0;
  const tone = remaining < 0 || (max > 0 && used >= max) ? "danger" : pct >= 80 ? "warn" : "ok";
  return { max, used, remaining, pct, tone };
}

// --- Schiesszeiten ---------------------------------------------------------------------

export type WindowRule = { resourceId: string | null; weekday: number; startMinute: number; endMinute: number };

export const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"] as const;
export const WEEKDAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
/** Anzeige-Reihenfolge Montag zuerst. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Fenster, die für eine Ressource gelten: die eigenen und die der ganzen Anlage (resourceId null). */
export function applicableWindows<T extends WindowRule>(windows: T[], resourceId: string | null): T[] {
  return windows.filter((w) => w.resourceId === null || w.resourceId === resourceId);
}

/** Überlappende oder aneinanderstossende Fenster eines Wochentags zusammenfassen. */
export function mergeWindows(ranges: Array<{ startMinute: number; endMinute: number }>) {
  const sorted = ranges.filter((r) => r.endMinute > r.startMinute).sort((a, b) => a.startMinute - b.startMinute);
  const out: Array<{ startMinute: number; endMinute: number }> = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.startMinute <= last.endMinute) last.endMinute = Math.max(last.endMinute, r.endMinute);
    else out.push({ ...r });
  }
  return out;
}

export type WindowCheck = { ok: true; restricted: boolean } | { ok: false; reason: string; allowed: string };

/** Lesbare Liste der Fenster eines Wochentags, z.B. "Mo 09:00–12:00, 14:00–18:00". */
export function describeDayWindows(windows: WindowRule[], weekday: number) {
  const ranges = mergeWindows(windows.filter((w) => w.weekday === weekday));
  if (!ranges.length) return `${WEEKDAYS_SHORT[weekday]}: keine Schiesszeit`;
  return `${WEEKDAYS_SHORT[weekday]} ${ranges.map((r) => `${formatMinutes(r.startMinute)}–${formatMinutes(r.endMinute)}`).join(", ")}`;
}

/**
 * Liegt [startsAt, endsAt) vollständig in einem bewilligten Fenster (Schweizer Zeit)?
 * Gibt es für die Ressource (inkl. ganze Anlage) keine Fenster, ist nichts eingeschränkt.
 * Zeiträume über Mitternacht sind nur erlaubt, wenn sie genau um 24:00 enden.
 */
export function checkWithinWindows(windows: WindowRule[], resourceId: string | null, startsAt: Date, endsAt: Date): WindowCheck {
  const relevant = applicableWindows(windows, resourceId);
  if (!relevant.length) return { ok: true, restricted: false };
  const s = zurichParts(startsAt);
  const e = zurichParts(endsAt);
  const startMin = parseTimeToMinutes(s.timeStr) ?? 0;
  let endMin = parseTimeToMinutes(e.timeStr) ?? 0;
  const allowed = describeDayWindows(relevant, s.weekday);
  if (e.dateStr !== s.dateStr) {
    // Ende genau um Mitternacht des Folgetags = 24:00 am Starttag
    if (endMin === 0 && endsAt.getTime() - startsAt.getTime() <= 24 * 60 * 60_000) endMin = 1440;
    else return { ok: false, reason: "Der Zeitraum geht über Mitternacht hinaus.", allowed };
  }
  if (endsAt <= startsAt) return { ok: false, reason: "Ungültiger Zeitraum.", allowed };
  const ranges = mergeWindows(relevant.filter((w) => w.weekday === s.weekday));
  const inside = ranges.some((r) => r.startMinute <= startMin && endMin <= r.endMinute);
  if (inside) return { ok: true, restricted: true };
  return { ok: false, reason: "Die Zeit liegt ausserhalb der bewilligten Schiesszeiten.", allowed };
}

// --- Alter -------------------------------------------------------------------------------

/** Alter, das jemand mit Jahrgang `birthYear` im Jahr `year` erreicht (Geburtstag evtl. noch nicht vorbei). */
export function ageInYear(birthYear: number, year: number) {
  return year - birthYear;
}

/**
 * Minderjährigkeit aus dem Jahrgang: "minor" sicher unter 18, "maybe" wird dieses Jahr 18
 * (Geburtstag unbekannt), "adult" sicher volljährig.
 */
export function minorStatusFromBirthYear(birthYear: number, year: number): "minor" | "maybe" | "adult" {
  const age = ageInYear(birthYear, year);
  if (age < 18) return "minor";
  if (age === 18) return "maybe";
  return "adult";
}

/** Genaues Alter am Tag `onKey` ("YYYY-MM-DD") aus einem Geburtsdatum "YYYY-MM-DD". */
export function ageOn(birthKey: string, onKey: string) {
  const [by, bm, bd] = birthKey.split("-").map(Number);
  const [y, m, d] = onKey.split("-").map(Number);
  let age = y! - by!;
  if (m! < bm! || (m === bm && d! < bd!)) age -= 1;
  return age;
}

/** Plausibler Jahrgang (nicht in der Zukunft, nicht älter als 110 Jahre). */
export function isPlausibleBirthYear(birthYear: number, year: number) {
  return Number.isInteger(birthYear) && birthYear <= year && birthYear >= year - 110;
}
