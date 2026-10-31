/**
 * Reine Logik der Vereinswaffen (ohne DB, ohne Server-Abhängigkeiten): Alter/Minderjährigkeit,
 * Meldefrist, Wartung fällig, Status nach Rückgabe, Sperrgrund in den Notizen.
 */

const DAY_MS = 86_400_000;

/** @db.Date-Wert (UTC-Mitternacht des Schweizer Kalendertags) → "YYYY-MM-DD". */
export function dbDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → @db.Date-Wert (UTC-Mitternacht). */
export function dayKeyToDbDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Ganze Lebensjahre am Stichtag (beide als "YYYY-MM-DD"). */
export function ageOn(birthKey: string, dayKey: string) {
  const [by, bm, bd] = birthKey.split("-").map(Number);
  const [y, m, d] = dayKey.split("-").map(Number);
  let age = y! - by!;
  if (m! < bm! || (m === bm && d! < bd!)) age--;
  return age;
}

/** Minderjährig (unter 18) am Stichtag; ohne Geburtsdatum unbekannt (null). */
export function isMinorOn(birthDate: Date | null | undefined, dayKey: string): boolean | null {
  if (!birthDate) return null;
  return ageOn(dbDateKey(birthDate), dayKey) < 18;
}

/** Meldefrist: Ausleihzeitpunkt plus Tage. */
export function reportDueFrom(loanedAt: Date, days: number) {
  return new Date(loanedAt.getTime() + Math.max(0, Math.round(days)) * DAY_MS);
}

/** Aus einer bestehenden Leihe die verwendete Frist in Tagen ableiten (für den Vorschlag der nächsten). */
export function inferReportDays(loanedAt: Date, reportDueAt: Date | null) {
  if (!reportDueAt) return null;
  const days = Math.round((reportDueAt.getTime() - loanedAt.getTime()) / DAY_MS);
  return days >= 1 && days <= 365 ? days : null;
}

export type ReportState = "none" | "reported" | "open" | "soon" | "overdue";

/**
 * Stand der Meldung einer Abgabe an Minderjährige.
 * none = keine Meldung nötig/erfasst, reported = gemeldet, open = offen, soon = Frist in ≤ warnDays Tagen, overdue = Frist vorbei.
 */
export function minorReportState(
  loan: { isMinor: boolean; reportDueAt: Date | null; reportedAt: Date | null },
  now: Date,
  warnDays = 5,
): { state: ReportState; daysLeft: number | null } {
  if (!loan.isMinor) return { state: "none", daysLeft: null };
  if (loan.reportedAt) return { state: "reported", daysLeft: null };
  if (!loan.reportDueAt) return { state: "open", daysLeft: null };
  const left = Math.ceil((loan.reportDueAt.getTime() - now.getTime()) / DAY_MS);
  if (left < 0 || loan.reportDueAt.getTime() < now.getTime()) return { state: "overdue", daysLeft: Math.min(left, 0) };
  if (left <= warnDays) return { state: "soon", daysLeft: left };
  return { state: "open", daysLeft: left };
}

/** Überfällig: Rückgabedatum vorbei und noch nicht zurück. */
export function isLoanOverdue(loan: { dueAt: Date | null; returnedAt: Date | null }, now: Date) {
  return !loan.returnedAt && !!loan.dueAt && loan.dueAt.getTime() < now.getTime();
}

export type ServiceInfo = {
  due: boolean;
  byShots: boolean;
  byDate: boolean;
  /** Schuss bis zur nächsten Wartung (negativ = überschritten), null ohne Intervall */
  shotsLeft: number | null;
  /** Tage bis zum Wartungsdatum (negativ = überschritten), null ohne Datum */
  daysLeft: number | null;
};

/**
 * Wartung fällig nach Schusszahl seit der letzten Wartung oder nach Datum (Schweizer Kalendertag).
 * Status SERVICE gilt immer als fällig, ausgemusterte Waffen nie.
 */
export function serviceInfo(
  w: { status: string; serviceEveryShots: number | null; nextServiceAt: Date | null; shotsSinceService: number },
  todayKey: string,
): ServiceInfo {
  if (w.status === "RETIRED") return { due: false, byShots: false, byDate: false, shotsLeft: null, daysLeft: null };
  const shotsLeft = w.serviceEveryShots ? w.serviceEveryShots - w.shotsSinceService : null;
  const byShots = shotsLeft !== null && shotsLeft <= 0;
  let daysLeft: number | null = null;
  if (w.nextServiceAt) {
    daysLeft = Math.round((dayKeyToDbDate(dbDateKey(w.nextServiceAt)).getTime() - dayKeyToDbDate(todayKey).getTime()) / DAY_MS);
  }
  const byDate = daysLeft !== null && daysLeft <= 0;
  return { due: byShots || byDate || w.status === "SERVICE", byShots, byDate, shotsLeft, daysLeft };
}

/** Status nach der Rückgabe: ausgeliehen → verfügbar bzw. in Wartung, wenn das Schussintervall erreicht ist. Andere Status bleiben. */
export function statusAfterReturn(current: string, shotsSinceServiceAfter: number, serviceEveryShots: number | null) {
  if (current !== "LOANED") return current;
  return serviceEveryShots && shotsSinceServiceAfter >= serviceEveryShots ? "SERVICE" : "AVAILABLE";
}

const BLOCK_PREFIX = "Sperrgrund: ";

/** Sperrgrund steht als erste Zeile «Sperrgrund: …» in den Notizen. */
export function blockReasonOf(notes: string | null | undefined) {
  const first = (notes ?? "").split("\n")[0] ?? "";
  return first.startsWith(BLOCK_PREFIX) ? first.slice(BLOCK_PREFIX.length).trim() || null : null;
}

export function stripBlockReason(notes: string | null | undefined) {
  if (!notes) return null;
  const lines = notes.split("\n");
  if (lines[0]?.startsWith(BLOCK_PREFIX)) lines.shift();
  const rest = lines.join("\n").trim();
  return rest || null;
}

export function withBlockReason(notes: string | null | undefined, reason: string) {
  const clean = reason.replace(/\s+/g, " ").trim();
  const rest = stripBlockReason(notes);
  return rest ? `${BLOCK_PREFIX}${clean}\n${rest}` : `${BLOCK_PREFIX}${clean}`;
}

/** ISO-Kalenderwoche als Schlüssel "YYYY-Www" (für wöchentliche Erinnerungen). */
export function isoWeekKey(dayKey: string) {
  const d = dayKeyToDbDate(dayKey);
  const dow = (d.getUTCDay() + 6) % 7; // Mo = 0
  const thursday = new Date(d.getTime() + (3 - dow) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const ordinal = Math.round((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS); // 0-basiert
  const week = 1 + Math.floor(ordinal / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Betrag wie «45», «45.50», «45,5», «CHF 1'200» → Rappen; leer → null; unlesbar → undefined. */
export function parseCostToCents(raw: string | null | undefined): number | null | undefined {
  const s = (raw ?? "").replace(/CHF|Fr\.?|['’\s]/gi, "").replace(/[.,][–-]+$/, "");
  if (s === "") return null;
  if (!/^\d{1,7}([.,]\d{0,2})?$/.test(s)) return undefined;
  const [a, b = ""] = s.replace(",", ".").split(".");
  return Number(a) * 100 + Number((b + "00").slice(0, 2));
}
