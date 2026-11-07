/**
 * Helfereinsätze und Arbeitsstunden – reine Logik ohne DB (testbar mit Vitest):
 * Stunden pro Einsatz, Jahressaldo, fehlende Stunden und Ersatzabgabe, Unterbesetzung,
 * Vorlagen auf mehrere Daten kopieren.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export const ASSIGNMENT_STATUSES = ["ASSIGNED", "DONE", "NO_SHOW"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export function isAssignmentStatus(s: string): s is AssignmentStatus {
  return (ASSIGNMENT_STATUSES as readonly string[]).includes(s);
}

/** Auf Viertelstunden runden (Anzeige und Speicherung von Stunden). */
export function roundHours(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return Math.round(h * 4) / 4;
}

/** Dauer eines Einsatzes in Stunden (auf Viertelstunden gerundet, nie negativ). */
export function shiftDurationHours(s: { startsAt: Date; endsAt: Date }): number {
  return Math.max(0, roundHours((s.endsAt.getTime() - s.startsAt.getTime()) / HOUR_MS));
}

/** Angerechnete Stunden eines Einsatzes: hoursCredit, sonst die Dauer. */
export function defaultShiftHours(s: { startsAt: Date; endsAt: Date; hoursCredit: number | null }): number {
  return s.hoursCredit != null && s.hoursCredit >= 0 ? s.hoursCredit : shiftDurationHours(s);
}

/** Stunden einer Einteilung: nur «erledigt» zählt; erfasste Stunden haben Vorrang vor dem Standard. */
export function assignmentHours(a: { status: string; hours: number | null }, shift: { startsAt: Date; endsAt: Date; hoursCredit: number | null }): number {
  if (a.status !== "DONE") return 0;
  return a.hours != null && a.hours >= 0 ? a.hours : defaultShiftHours(shift);
}

export type HoursInput = {
  assignments: Array<{ status: string; hours: number | null; shift: { startsAt: Date; endsAt: Date; hoursCredit: number | null } }>;
  workLogs: Array<{ hours: number; approvedAt: Date | null }>;
};

/** Geleistete Stunden: bestätigte Einsätze plus bewilligte Arbeitsrapporte. */
export function memberHours(input: HoursInput): { shiftHours: number; logHours: number; total: number; pendingLogHours: number } {
  const shiftHours = input.assignments.reduce((s, a) => s + assignmentHours(a, a.shift), 0);
  const logHours = input.workLogs.filter((l) => l.approvedAt).reduce((s, l) => s + Math.max(0, l.hours), 0);
  const pendingLogHours = input.workLogs.filter((l) => !l.approvedAt).reduce((s, l) => s + Math.max(0, l.hours), 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { shiftHours: r(shiftHours), logHours: r(logHours), total: r(shiftHours + logHours), pendingLogHours: r(pendingLogHours) };
}

/** Fehlende Stunden gegenüber dem Soll (nie negativ, 2 Nachkommastellen). */
export function missingHours(required: number, done: number): number {
  if (!(required > 0)) return 0;
  return Math.max(0, Math.round((required - Math.max(0, done)) * 100) / 100);
}

/** Ersatzabgabe in Rappen: fehlende Stunden × Ansatz, auf 5 Rappen gerundet. */
export function ersatzAmountCents(missing: number, ratePerHourCents: number): number {
  if (!(missing > 0) || !(ratePerHourCents > 0)) return 0;
  return Math.round((missing * ratePerHourCents) / 5) * 5;
}

/** Status ohne Arbeitsstundenpflicht (ausgetreten, Beitritt wartet auf Freigabe). */
const NEVER_SUBJECT = new Set(["LEFT", "PENDING"]);

/** CSV «ACTIVE,JUNIOR» → Liste gültiger Status (ohne LEFT/PENDING, ohne Duplikate). */
export function parseStatuses(csv: string | null | undefined, allowed: readonly string[]): string[] {
  const set = new Set((csv ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => s && !NEVER_SUBJECT.has(s) && allowed.includes(s)));
  return [...set];
}

/** Gilt die Arbeitsstundenpflicht für diese Mitgliedschaft? */
export function isSubjectToWorkHours(m: { status: string; workHoursExempt: boolean }, statuses: string[]): boolean {
  return !m.workHoursExempt && !NEVER_SUBJECT.has(m.status) && statuses.includes(m.status);
}

// ---------------------------------------------------------------------------
// Pro rata (Eintritt bzw. Austritt im Lauf des Jahres)
// ---------------------------------------------------------------------------

/** Auf halbe Stunden runden (Soll pro rata). */
export function roundHalfHours(h: number): number {
  if (!Number.isFinite(h)) return 0;
  return Math.round(h * 2) / 2;
}

/**
 * Monate des Jahres, in denen jemand Mitglied ist (0–12). Der Eintrittsmonat zählt voll
 * (Eintritt im März = 10 Monate, März bis Dezember), der Austrittsmonat ebenfalls.
 * Ohne Eintrittsdatum bzw. Eintritt vor dem Jahr: ab Januar. Daten als @db.Date (UTC-Mitternacht).
 */
export function membershipMonthsInYear(year: number, joinedAt: Date | null | undefined, leftAt?: Date | null): number {
  const startMonth = !joinedAt ? 1 : joinedAt.getUTCFullYear() < year ? 1 : joinedAt.getUTCFullYear() > year ? 13 : joinedAt.getUTCMonth() + 1;
  const endMonth = !leftAt ? 12 : leftAt.getUTCFullYear() > year ? 12 : leftAt.getUTCFullYear() < year ? 0 : leftAt.getUTCMonth() + 1;
  return Math.max(0, Math.min(12, endMonth - startMonth + 1));
}

/** Soll pro rata: Soll × Monate / 12, auf 0.5 h gerundet. 12 Monate = volles Soll. */
export function proRataRequired(required: number, months: number): number {
  if (!(required > 0)) return 0;
  const m = Math.max(0, Math.min(12, Math.round(months)));
  if (m >= 12) return required;
  return roundHalfHours((required * m) / 12);
}

export type HoursRow = {
  required: number;
  done: number;
  missing: number;
  amountCents: number;
  subject: boolean;
  /** Monate, für die das Soll gilt (12 = ganzes Jahr bzw. pro rata aus) */
  months: number;
  /** Soll wurde wegen Eintritt/Austritt im Jahr anteilig gekürzt */
  proRata: boolean;
};

export type WorkHoursSettingsLite = { enabled: boolean; requiredHours: number; ratePerMissingHourCents: number; statuses: string[]; proRata?: boolean };

/**
 * Saldo eines Mitglieds für ein Jahr. Mit `settings.proRata` gilt bei Eintritt (bzw. Austritt) im Lauf
 * des Jahres das anteilige Soll (siehe proRataRequired); das wirkt auch auf die Ersatzabgabe.
 * Ohne `year` bzw. ohne Eintrittsdatum gilt das volle Soll.
 */
export function hoursBalance(
  m: { status: string; workHoursExempt: boolean; joinedAt?: Date | null; leftAt?: Date | null },
  done: number,
  settings: WorkHoursSettingsLite,
  year?: number,
): HoursRow {
  const subjectStatus = settings.enabled && isSubjectToWorkHours(m, settings.statuses);
  const months = settings.proRata && year !== undefined ? membershipMonthsInYear(year, m.joinedAt, m.leftAt) : 12;
  const subject = subjectStatus && months > 0;
  const full = Math.max(0, settings.requiredHours);
  const required = subject ? proRataRequired(full, months) : 0;
  const missing = subject ? missingHours(required, done) : 0;
  return {
    required,
    done,
    missing,
    amountCents: subject ? ersatzAmountCents(missing, settings.ratePerMissingHourCents) : 0,
    subject,
    months: subject ? months : 12,
    proRata: subject && months < 12 && full > 0,
  };
}

/** Bezeichnung der Ersatzabgabe-Rechnung (auch Erkennungsmerkmal gegen doppelte Verrechnung). */
export function ersatzCategoryPrefix(year: number) {
  return `Ersatzabgabe Arbeitsstunden ${year}`;
}

export function ersatzCategoryName(year: number, missing: number) {
  return `${ersatzCategoryPrefix(year)} (${formatHours(missing)} h)`;
}

/** 2.5 → «2.5», 3 → «3», 1.25 → «1.25» (Schweizer Schreibweise mit Punkt). */
export function formatHours(h: number): string {
  const r = Math.round(h * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, "");
}

// ---------------------------------------------------------------------------
// Besetzung
// ---------------------------------------------------------------------------

export type Staffing = { filled: number; capacity: number; open: number; understaffed: boolean; full: boolean };

/** Besetzung: eingeteilt oder erledigt zählt, «nicht erschienen» nicht. */
export function staffing(capacity: number, assignments: Array<{ status: string }>): Staffing {
  const filled = assignments.filter((a) => a.status === "ASSIGNED" || a.status === "DONE").length;
  const cap = Math.max(1, capacity);
  return { filled, capacity: cap, open: Math.max(0, cap - filled), understaffed: filled < cap, full: filled >= cap };
}

/** Fehlt die verlangte Qualifikation bei allen eingeteilten Personen? (Ohne Anforderung: false) */
export function missingQualification(required: string | null | undefined, assignedQualified: boolean[]): boolean {
  if (!required) return false;
  return !assignedQualified.some(Boolean);
}

/** Darf sich ein Mitglied (noch) eintragen bzw. austragen? Bis zum Beginn des Einsatzes. */
export function canSelfSignUp(shift: { startsAt: Date }, st: Staffing, now: Date): boolean {
  return shift.startsAt.getTime() > now.getTime() && !st.full;
}

export function canSelfWithdraw(shift: { startsAt: Date }, assignment: { status: string }, now: Date): boolean {
  return assignment.status === "ASSIGNED" && shift.startsAt.getTime() > now.getTime();
}

// ---------------------------------------------------------------------------
// Vorlage auf mehrere Daten kopieren
// ---------------------------------------------------------------------------

export const MAX_COPIES = 60;

/** Wochentag (0 = Sonntag) eines Kalendertags «YYYY-MM-DD». */
export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

function addDayKey(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Alle Kalendertage zwischen `from` und `to` (inklusive) an den gewählten Wochentagen, jede
 * `everyWeeks`. Woche (gezählt ab der Woche von `from`). `exclude` (z.B. das Datum der Vorlage)
 * wird ausgelassen. Höchstens `max` Daten.
 */
export function expandTemplateDates(o: { from: string; to: string; weekdays: number[]; everyWeeks?: number; exclude?: string[]; max?: number }): string[] {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(o.from) || !re.test(o.to) || o.to < o.from) return [];
  const weekdays = new Set(o.weekdays.filter((w) => Number.isInteger(w) && w >= 0 && w <= 6));
  if (!weekdays.size) return [];
  const every = Math.max(1, Math.min(8, Math.floor(o.everyWeeks ?? 1)));
  const exclude = new Set(o.exclude ?? []);
  const max = o.max ?? MAX_COPIES;
  // Wochenbeginn (Montag) der Startwoche als Bezug für «jede n. Woche»
  const fromWd = weekdayOf(o.from);
  const weekStart = addDayKey(o.from, -((fromWd + 6) % 7));
  const out: string[] = [];
  for (let day = o.from; day <= o.to; day = addDayKey(day, 1)) {
    if (!weekdays.has(weekdayOf(day))) continue;
    const weekIndex = Math.floor((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / (7 * DAY_MS));
    if (weekIndex % every !== 0) continue;
    if (exclude.has(day)) continue;
    out.push(day);
    if (out.length >= max) break;
  }
  return out;
}

/** Tagesverschiebung zwischen zwei Kalendertagen (für Ende nach Mitternacht). */
export function dayOffset(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);
}

export { addDayKey };
