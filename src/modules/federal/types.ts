/**
 * Bundesübungen (Obligatorisch, Feldschiessen): reine Hilfsfunktionen ohne DB und ohne "server-only",
 * damit sie getestet und in Abfragen, Routen und Komponenten genutzt werden können.
 *
 * Wichtig: Fristen, Grenzwerte und Abläufe sind vom Verein einstellbar und hier nie als Tatsachen
 * hinterlegt. Die App unterstützt den Schützenmeister, ersetzt aber dessen Verantwortung nicht.
 */
import { addDays, zurichParts, zurichToUtc } from "@/lib/time";
import { toCsv } from "@/modules/scores/analytics";

export { evaluatePass, autoAttempt, passLabel } from "@/modules/scores/official";

export const FEDERAL_RULES_HINT = "Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.";
export const FEDERAL_RESPONSIBILITY_HINT =
  "Die App unterstützt den Schützenmeister bei Erfassung und Übersicht. Die Verantwortung für korrekte Resultate und Meldungen bleibt beim Verein.";

// ---------------------------------------------------------------------------
// Datum (Schweizer Kalendertag, @db.Date als UTC-Mitternacht)
// ---------------------------------------------------------------------------

/** Schweizer Kalendertag eines Zeitpunkts als "YYYY-MM-DD". */
export function swissDay(at: Date): string {
  return zurichParts(at).dateStr;
}

/** "YYYY-MM-DD" → Date (UTC-Mitternacht) für @db.Date-Felder. Ungültig → null. */
export function dayToDbDate(day: string | null | undefined): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m! - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** @db.Date (UTC-Mitternacht) → "YYYY-MM-DD". */
export function dbDateToDay(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** @db.Date als "TT.MM.JJJJ" (ohne Zeitzonen-Verschiebung). */
export function formatDbDate(d: Date | null | undefined): string {
  const day = dbDateToDay(d);
  if (!day) return "";
  const [y, m, dd] = day.split("-");
  return `${dd}.${m}.${y}`;
}

/** "YYYY-MM-DD" → "TT.MM.JJJJ". */
export function formatDay(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

/** Ganze Tage von `from` bis `to` (beide "YYYY-MM-DD"), negativ wenn `to` vorher liegt. */
export function daysBetween(from: string, to: string): number {
  const a = dayToDbDate(from);
  const b = dayToDbDate(to);
  if (!a || !b) return Number.NaN;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Jahre für die Auswahl: nächstes Jahr, aktuelles und vier frühere. */
export function yearOptions(currentYear: number): number[] {
  return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4];
}

/** Jahr aus dem Query-Parameter, sonst das aktuelle. */
export function parseYear(raw: string | undefined | null, currentYear: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2000 && n <= currentYear + 1 ? n : currentYear;
}

// ---------------------------------------------------------------------------
// Fristen und Erinnerungen
// ---------------------------------------------------------------------------

export const DEADLINE_FIELDS = [
  { key: "registrationDeadline", label: "Meldung der Schiesstage", hint: "z.B. Eingabe der Schiesstage (SAT-Admin)" },
  { key: "shootingDeadline", label: "Letzter Schiesstag Obligatorisch", hint: "Letzter Tag, an dem das Obligatorisch geschossen werden kann" },
  { key: "reportDeadline", label: "Abschluss / Meldung der Resultate", hint: "Resultate vollständig erfasst und gemeldet" },
] as const;
export type DeadlineKey = (typeof DEADLINE_FIELDS)[number]["key"];

/** Erinnerungsstufen in Tagen vor der Frist. */
export const REMINDER_STAGES = [14, 3] as const;

export type DueReminder = { key: DeadlineKey; label: string; day: string; stage: number; daysLeft: number };

/**
 * Fällige Frist-Erinnerungen für heute: höchstens eine Stufe pro Frist (die kleinste passende).
 * Stufe 14 gilt ab 14 bis 4 Tage vorher, Stufe 3 ab 3 Tagen bis zum Fristtag. Wer die Stufe 14
 * verpasst (z.B. Frist erst kurzfristig eingetragen), bekommt direkt die Stufe 3.
 * Ob die Erinnerung schon verschickt wurde, prüft der Aufrufer (pro Frist, Tag und Stufe).
 */
export function dueDeadlineReminders(deadlines: Partial<Record<DeadlineKey, string | null>>, today: string): DueReminder[] {
  const out: DueReminder[] = [];
  for (const f of DEADLINE_FIELDS) {
    const day = deadlines[f.key];
    if (!day) continue;
    const left = daysBetween(today, day);
    if (!Number.isFinite(left) || left < 0) continue;
    const stage = [...REMINDER_STAGES].sort((a, b) => a - b).find((s) => left <= s);
    if (stage === undefined) continue;
    out.push({ key: f.key, label: f.label, day, stage, daysLeft: left });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Status pro Schütze (Obligatorisch)
// ---------------------------------------------------------------------------

export type OfficialResultLite = { userId: string | null; passed: boolean | null; attempt: number | null; date: Date };
export type OpUserStatus = { userId: string; status: "passed" | "failed" | "unknown"; attempts: number; lastDate: Date };

/**
 * Status pro Schütze aus seinen amtlichen OP-Resultaten eines Jahres:
 * «passed» sobald ein Resultat bestanden ist, «failed» wenn nur nicht bestandene vorliegen
 * (= verblieben), «unknown» wenn das Programm keine Bestehensregel hat.
 */
export function opStatusByUser(results: readonly OfficialResultLite[]): Map<string, OpUserStatus> {
  const map = new Map<string, OpUserStatus>();
  for (const r of results) {
    if (!r.userId) continue;
    const cur = map.get(r.userId) ?? { userId: r.userId, status: "unknown" as OpUserStatus["status"], attempts: 0, lastDate: r.date };
    cur.attempts = Math.max(cur.attempts + 1, r.attempt ?? 0);
    if (r.date > cur.lastDate) cur.lastDate = r.date;
    if (r.passed === true) cur.status = "passed";
    else if (r.passed === false && cur.status !== "passed") cur.status = "failed";
    map.set(r.userId, cur);
  }
  return map;
}

export function summarizeOp(results: readonly OfficialResultLite[]) {
  const byUser = opStatusByUser(results);
  let passed = 0;
  let failed = 0;
  let unknown = 0;
  for (const s of byUser.values()) {
    if (s.status === "passed") passed += 1;
    else if (s.status === "failed") failed += 1;
    else unknown += 1;
  }
  return { confirmed: results.length, shooters: byUser.size, passed, failed, unknown };
}

// ---------------------------------------------------------------------------
// Schiesstage (Schiessnachweis)
// ---------------------------------------------------------------------------

export type ShootingDay = { date: Date; source: "match" | "visit" };

/**
 * Führt Schiesstage aus Durchgängen (Zeitpunkte) und Standbesuchen (Kalendertage) zusammen:
 * pro Schweizer Kalendertag ein Eintrag, Durchgänge haben Vorrang. Ergebnis aufsteigend,
 * Datum als UTC-Mitternacht des Schweizer Tages. Optional auf [from, to] (Kalendertage) begrenzt.
 */
export function mergeShootingDays(matchDates: readonly Date[], visitDates: readonly Date[], range?: { from: Date; to: Date }): ShootingDay[] {
  const fromKey = range ? swissDay(range.from) : null;
  const toKey = range ? swissDay(range.to) : null;
  const byDay = new Map<string, ShootingDay["source"]>();
  const add = (d: Date, source: ShootingDay["source"]) => {
    const key = swissDay(d);
    if (fromKey && key < fromKey) return;
    if (toKey && key > toKey) return;
    if (byDay.get(key) === "match") return;
    byDay.set(key, source);
  };
  for (const d of matchDates) add(d, "match");
  for (const d of visitDates) add(d, "visit");
  return [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([day, source]) => ({ date: dayToDbDate(day)!, source }));
}

/** Jahre, die der Schiessnachweis zurückschaut. */
export const NACHWEIS_YEARS = 5;

/** Zeitraum des Nachweises: die letzten fünf Jahre bis heute (Schweizer Kalendertage). */
export function nachweisRange(now: Date) {
  const today = swissDay(now);
  let fromDay = `${Number(today.slice(0, 4)) - NACHWEIS_YEARS}${today.slice(4)}`;
  // 29.2. gibt es nicht in jedem Jahr: auf den 1.3. ausweichen
  if (!dayToDbDate(fromDay)) fromDay = addDays(fromDay.replace("-02-29", "-02-28"), 1);
  return { from: zurichToUtc(fromDay, "00:00"), to: now, fromDay, today };
}

/** Schiesstage nach Jahr gruppiert (neueste zuerst). */
export function groupDaysByYear(days: readonly ShootingDay[]): Array<{ year: number; days: ShootingDay[] }> {
  const map = new Map<number, ShootingDay[]>();
  for (const d of days) {
    const y = d.date.getUTCFullYear();
    const list = map.get(y) ?? [];
    list.push(d);
    map.set(y, list);
  }
  return [...map.entries()].sort(([a], [b]) => b - a).map(([year, list]) => ({ year, days: [...list].sort((a, b) => b.date.getTime() - a.date.getTime()) }));
}

// ---------------------------------------------------------------------------
// Feldschiessen-Rangliste
// ---------------------------------------------------------------------------

export type FsEntry = { id: string; name: string; total: number; zeros: number | null };

/** Rangliste nach Total (absteigend), bei Gleichstand weniger Nuller zuerst; gleiche Werte = gleicher Rang. */
export function rankFs<T extends FsEntry>(entries: readonly T[]): Array<T & { rank: number }> {
  const sorted = [...entries].sort((a, b) => b.total - a.total || (a.zeros ?? 0) - (b.zeros ?? 0) || a.name.localeCompare(b.name, "de-CH"));
  let rank = 0;
  let prev: T | null = null;
  return sorted.map((e, i) => {
    if (!prev || prev.total !== e.total || (prev.zeros ?? 0) !== (e.zeros ?? 0)) rank = i + 1;
    prev = e;
    return { ...e, rank };
  });
}

// ---------------------------------------------------------------------------
// Export für SAT-Admin
// ---------------------------------------------------------------------------

/** Name in Vor- und Nachname aufteilen (letztes Wort = Nachname). */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: "", lastName: parts[0] ?? "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]! };
}

export type SatRow = {
  name: string;
  birthDate: Date | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  program: string;
  total: number | null;
  zeros: number | null;
  attempt: number | null;
  passed: boolean | null;
  date: Date;
  decimal?: boolean;
};

export const SAT_HEADER = ["Name", "Vorname", "Geburtsdatum", "Strasse", "PLZ", "Ort", "Programm", "Resultat", "Nuller", "Versuch", "Bestanden", "Datum"];

function fmtTotal(n: number | null, decimal?: boolean) {
  if (n === null) return "";
  return decimal ? n.toFixed(1) : String(Math.round(n * 10) / 10);
}

/** Datum eines Durchgangs (Zeitpunkt) als "TT.MM.JJJJ" in Schweizer Zeit. */
export function formatSwissDate(at: Date): string {
  return formatDay(swissDay(at));
}

/** Eine Exportzeile (ohne AHV-Nummer – diese wird in der App nicht gespeichert). */
export function satRowCells(r: SatRow): string[] {
  const { firstName, lastName } = splitName(r.name);
  return [
    lastName,
    firstName,
    formatDbDate(r.birthDate),
    r.street ?? "",
    r.zip ?? "",
    r.city ?? "",
    r.program,
    fmtTotal(r.total, r.decimal),
    r.zeros === null ? "" : String(r.zeros),
    r.attempt === null ? "" : String(r.attempt),
    r.passed === true ? "ja" : r.passed === false ? "nein" : "",
    formatSwissDate(r.date),
  ];
}

/** CSV (Semikolon, UTF-8 mit BOM, Schutz gegen Formel-Injection) für den Import/Abgleich in SAT-Admin. */
export function buildSatCsv(rows: readonly SatRow[]): string {
  return toCsv([SAT_HEADER, ...rows.map(satRowCells)]);
}
