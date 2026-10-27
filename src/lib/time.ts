export const APP_TZ = "Europe/Zurich";

/** Datum/Uhrzeit (Schweizer Zeit) → Date in UTC. dateStr "YYYY-MM-DD", timeStr "HH:mm". */
export function zurichToUtc(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // Erste Annäherung als UTC, dann Offset für diesen Zeitpunkt bestimmen und korrigieren.
  const guess = Date.UTC(y!, m! - 1, d!, hh!, mm ?? 0);
  const offset1 = tzOffsetMinutes(new Date(guess));
  const corrected = guess - offset1 * 60_000;
  const offset2 = tzOffsetMinutes(new Date(corrected));
  return new Date(offset1 === offset2 ? corrected : guess - offset2 * 60_000);
}

/** Offset von Europe/Zurich gegenüber UTC in Minuten für einen Zeitpunkt. */
export function tzOffsetMinutes(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Zerlegt einen UTC-Zeitpunkt in Schweizer Kalenderwerte. */
export function zurichParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    timeStr: `${get("hour")}:${get("minute")}`,
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

export function todayZurich() {
  return zurichParts(new Date()).dateStr;
}

export function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

export function formatTimeRange(start: Date, end: Date) {
  const f = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit" });
  return `${f.format(start)}–${f.format(end)}`;
}

export function formatDateZurich(d: Date, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", ...opts }).format(d);
}

export function formatDateTimeZurich(d: Date) {
  return new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
