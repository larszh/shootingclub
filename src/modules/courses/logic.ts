/**
 * Kurse: reine Logik ohne DB (Alter, Pflichtprogramm-Matrix, Qualifikationsregeln, NDS-Präsenzliste,
 * Teilnehmer-Import). Mit Vitest getestet (logic.test.ts).
 */
import { parseSwissDate } from "@/modules/members/import";

// --- Datum / Alter --------------------------------------------------------------------------------

/** «YYYY-MM-DD» eines @db.Date-Werts (UTC-Mitternacht des Schweizer Kalendertags). */
export function dbDay(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Schweizer Kalendertag «YYYY-MM-DD» → Date als UTC-Mitternacht (für @db.Date-Felder). */
export function dayToDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Alter in ganzen Jahren am Stichtag (beide «YYYY-MM-DD»). null ohne Geburtsdatum. */
export function ageOn(birthDay: string | null | undefined, onDay: string): number | null {
  if (!birthDay || !/^\d{4}-\d{2}-\d{2}/.test(birthDay) || !/^\d{4}-\d{2}-\d{2}/.test(onDay)) return null;
  const [by, bm, bd] = birthDay.slice(0, 10).split("-").map(Number) as [number, number, number];
  const [y, m, d] = onDay.slice(0, 10).split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Minderjährig (unter 18) am Stichtag? Ohne Geburtsdatum: false (unbekannt). */
export function isMinorOn(birthDay: string | null | undefined, onDay: string): boolean {
  const a = ageOn(birthDay, onDay);
  return a !== null && a < 18;
}

/** Stichtag für Altersprüfungen eines Kurses: Kursbeginn, sonst heute. */
export function courseReferenceDay(startsOn: string | null | undefined, today: string): string {
  return startsOn ?? today;
}

/** «YYYY-MM-DD» + n Monate; ein Monatsende wird auf den letzten Tag des Zielmonats begrenzt (31.01. + 1 → 28./29.02.). */
export function addMonthsDay(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ty = Math.floor(total / 12);
  const tm = total - ty * 12;
  const last = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const dt = new Date(Date.UTC(ty, tm, Math.min(d, last)));
  return dt.toISOString().slice(0, 10);
}

/** «YYYY-MM-DD» → «TT.MM.JJJJ». */
export function chDate(day: string | null | undefined): string {
  if (!day) return "";
  const [y, m, d] = day.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// --- Pflichtprogramme (CSV) ---------------------------------------------------------------------------

export function parseIdCsv(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const out: string[] = [];
  for (const raw of csv.split(",")) {
    const id = raw.trim();
    if (id && id.length <= 40 && !out.includes(id)) out.push(id);
  }
  return out;
}

export function toIdCsv(ids: readonly string[]): string | null {
  const clean = parseIdCsv(ids.join(","));
  return clean.length ? clean.join(",") : null;
}

// --- Bestanden / Pflichtprogramm-Matrix -----------------------------------------------------------------

/**
 * Bestanden nach Mindestpunktzahl und maximalen Nullern. Ohne Grenzwerte: null (nicht beurteilbar,
 * Kursleitung entscheidet). Fehlende Nuller zählen nur als bestanden, wenn keine Nuller-Grenze gilt.
 */
export function evaluatePass(limits: { minScore: number | null; maxZeros: number | null }, total: number | null, zeros: number | null): boolean | null {
  if (limits.minScore === null && limits.maxZeros === null) return null;
  if (total === null) return false;
  if (limits.minScore !== null && total < limits.minScore) return false;
  if (limits.maxZeros !== null && (zeros === null || zeros > limits.maxZeros)) return false;
  return true;
}

export type CellState = "passed" | "failed" | "open";
export type ResultLite = { participantId: string; programId: string | null; passed: boolean; score: number | null; date: string };

export type CompletionRow = {
  participantId: string;
  cells: Record<string, { state: CellState; best: ResultLite | null; attempts: number }>;
  passedCount: number;
  required: number;
  allPassed: boolean;
};

/**
 * Matrix Teilnehmende × Pflichtprogramme. Ein Programm gilt als bestanden, sobald ein Resultat
 * bestanden ist; sonst «nicht bestanden», wenn Versuche vorhanden sind, sonst «offen».
 * Ohne Pflichtprogramme ist allPassed true (Abschluss nach Präsenz/Ermessen der Kursleitung).
 */
export function completionMatrix(participantIds: readonly string[], requiredProgramIds: readonly string[], results: readonly ResultLite[]): CompletionRow[] {
  const byParticipant = new Map<string, ResultLite[]>();
  for (const r of results) {
    const list = byParticipant.get(r.participantId) ?? [];
    list.push(r);
    byParticipant.set(r.participantId, list);
  }
  return participantIds.map((pid) => {
    const own = byParticipant.get(pid) ?? [];
    const cells: CompletionRow["cells"] = {};
    let passedCount = 0;
    for (const prog of requiredProgramIds) {
      const attempts = own.filter((r) => r.programId === prog);
      const passedOnes = attempts.filter((r) => r.passed);
      const pickBest = (list: ResultLite[]) =>
        list.reduce<ResultLite | null>((best, r) => (!best || (r.score ?? -1) > (best.score ?? -1) || ((r.score ?? -1) === (best.score ?? -1) && r.date > best.date) ? r : best), null);
      const state: CellState = passedOnes.length ? "passed" : attempts.length ? "failed" : "open";
      if (state === "passed") passedCount += 1;
      cells[prog] = { state, best: pickBest(passedOnes.length ? passedOnes : attempts), attempts: attempts.length };
    }
    return { participantId: pid, cells, passedCount, required: requiredProgramIds.length, allPassed: passedCount === requiredProgramIds.length };
  });
}

/** Darf ein Teilnehmer abgeschlossen werden? (alle Pflichtprogramme bestanden, nicht ausgetreten) */
export function canComplete(row: Pick<CompletionRow, "allPassed">, status: string): boolean {
  return row.allPassed && status !== "DROPPED" && status !== "COMPLETED";
}

// --- Qualifikationsregeln ----------------------------------------------------------------------------

export type RuleLimits = { passScore: number; maxZeros: number | null };
export type RuleEvaluation = { ok: boolean; reasons: string[] };

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Erfüllt ein Resultat die Regel (Mindestpunktzahl, max. Nuller)? Mit verständlichen Gründen. */
export function evaluateRule(rule: RuleLimits, result: { total: number | null; zeros: number | null }): RuleEvaluation {
  const reasons: string[] = [];
  if (result.total === null) reasons.push("Kein Total gespeichert.");
  else if (result.total < rule.passScore) reasons.push(`${fmtNum(result.total)} von mindestens ${fmtNum(rule.passScore)} Punkten.`);
  if (rule.maxZeros !== null) {
    if (result.zeros === null) reasons.push("Anzahl Nuller unbekannt.");
    else if (result.zeros > rule.maxZeros) reasons.push(`${result.zeros} Nuller, erlaubt sind höchstens ${rule.maxZeros}.`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** Anforderung einer Regel als Text, z.B. «mindestens 60 Punkte, höchstens 2 Nuller». */
export function requirementText(rule: RuleLimits): string {
  return `mindestens ${fmtNum(rule.passScore)} Punkte${rule.maxZeros !== null ? `, höchstens ${rule.maxZeros} Nuller` : ""}`;
}

const REQ_MARKER = " · Anforderung: ";

/**
 * Bemerkung einer erteilten Qualifikation: Resultat plus die bei der Erteilung geltende Anforderung
 * (Momentaufnahme – spätere Änderungen der Regel ändern den Nachweis nicht).
 */
export function grantNote(result: { total: number | null; zeros: number | null }, rule: RuleLimits): string {
  return `${result.total ?? "–"} Pkt., ${result.zeros ?? "–"} Nuller${REQ_MARKER}${requirementText(rule)}`;
}

/** Bemerkung zerlegen: Anforderung (falls bei der Erteilung gespeichert) und übrige Bemerkung. */
export function splitGrantNote(note: string | null | undefined): { note: string | null; requirement: string | null } {
  if (!note) return { note: null, requirement: null };
  const i = note.indexOf(REQ_MARKER);
  if (i < 0) return { note, requirement: null };
  return { note: note.slice(0, i) || null, requirement: note.slice(i + REQ_MARKER.length) || null };
}

/** Gültigkeit einer erteilten Qualifikation: ab Schiesstag, bis Schiesstag + Monate. */
export function qualificationValidity(shotDay: string, validityMonths: number): { validFrom: string; validUntil: string } {
  return { validFrom: shotDay, validUntil: addMonthsDay(shotDay, Math.max(1, Math.round(validityMonths))) };
}

// --- Präsenz / NDS-Export -------------------------------------------------------------------------------

export type AttendanceLite = { sessionId: string; participantId: string; present: boolean };

/** Präsenz-Lookup: «sessionId|participantId» → true/false (fehlend = nicht erfasst). */
export function attendanceIndex(rows: readonly AttendanceLite[]): Map<string, boolean> {
  return new Map(rows.map((r) => [`${r.sessionId}|${r.participantId}`, r.present]));
}

/** Anwesenheiten eines Teilnehmers: anwesend / erfasste Lektionen / alle Lektionen. */
export function attendanceSummary(participantId: string, sessionIds: readonly string[], idx: Map<string, boolean>) {
  let present = 0;
  let recorded = 0;
  for (const s of sessionIds) {
    const v = idx.get(`${s}|${participantId}`);
    if (v !== undefined) recorded += 1;
    if (v) present += 1;
  }
  return { present, recorded, total: sessionIds.length };
}

/**
 * Präsenzliste im Aufbau für die manuelle Übertragung in die NDS (J+S):
 * Name; Vorname; Geburtsdatum; danach je Lektionsdatum eine Spalte mit 1 (anwesend) / 0 (abwesend oder nicht erfasst).
 * Mehrere Lektionen am selben Tag erhalten den Zusatz « (2)», « (3)». Kein API-Zugriff auf die NDS.
 */
export function ndsAttendanceRows(
  participants: readonly { id: string; firstName: string; lastName: string; birthDay: string | null }[],
  sessions: readonly { id: string; day: string }[],
  attendance: readonly AttendanceLite[],
): string[][] {
  const sorted = [...sessions].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const seen = new Map<string, number>();
  const heads = sorted.map((s) => {
    const n = (seen.get(s.day) ?? 0) + 1;
    seen.set(s.day, n);
    return n > 1 ? `${chDate(s.day)} (${n})` : chDate(s.day);
  });
  const idx = attendanceIndex(attendance);
  const people = [...participants].sort((a, b) => a.lastName.localeCompare(b.lastName, "de-CH") || a.firstName.localeCompare(b.firstName, "de-CH"));
  const rows = people.map((p) => [p.lastName, p.firstName, chDate(p.birthDay), ...sorted.map((s) => (idx.get(`${s.id}|${p.id}`) ? "1" : "0"))]);
  return [["Name", "Vorname", "Geburtsdatum", ...heads], ...rows];
}

// --- Teilnehmer-Import ----------------------------------------------------------------------------------------

export type ImportedParticipant = {
  line: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  errors: string[];
  warnings: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (h: string) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

const HEADER_ALIASES: Record<keyof Omit<ImportedParticipant, "line" | "errors" | "warnings">, string[]> = {
  firstName: ["vorname", "firstname", "prenom"],
  lastName: ["nachname", "name", "lastname", "nom"],
  birthDate: ["geburtsdatum", "geburtstag", "birthdate", "datedenaissance"],
  email: ["email", "mail"],
  phone: ["telefon", "tel", "mobile", "handy", "natel", "phone"],
  guardianName: ["erziehungsberechtigte", "erziehungsberechtigter", "gesetzlichevertretung", "eltern"],
  guardianEmail: ["emailerziehungsberechtigte", "emailerziehungsberechtigter", "emaileltern"],
  guardianPhone: ["telefonerziehungsberechtigte", "telefonerziehungsberechtigter", "telefoneltern"],
};

/** Spalten den Feldern zuordnen (nach Kopfzeile, sonst nach Position der Vorlage). */
export function mapImportHeaders(headers: readonly string[]): Record<keyof typeof HEADER_ALIASES, number> {
  const keys = Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[];
  const normed = headers.map(norm);
  const out = {} as Record<keyof typeof HEADER_ALIASES, number>;
  const used = new Set<number>();
  // Längere (spezifischere) Aliase zuerst, damit «E-Mail Erziehungsberechtigte» nicht als «E-Mail» gilt.
  for (const k of [...keys].sort((a, b) => Math.max(...HEADER_ALIASES[b].map((s) => s.length)) - Math.max(...HEADER_ALIASES[a].map((s) => s.length)))) {
    const i = normed.findIndex((h, j) => !used.has(j) && HEADER_ALIASES[k].includes(h));
    if (i >= 0) {
      out[k] = i;
      used.add(i);
    }
  }
  const found = Object.keys(out).length;
  if (found < 2) keys.forEach((k, i) => (out[k] = i));
  else for (const k of keys) if (out[k] === undefined) out[k] = -1;
  return out;
}

/**
 * Datenzeilen prüfen. Pflicht: Vor- und Nachname. Unter 18 (am Stichtag) muss die
 * erziehungsberechtigte Person mit E-Mail oder Telefon angegeben sein.
 */
export function mapImportRows(headers: readonly string[], rows: readonly string[][], refDay: string, today: string): ImportedParticipant[] {
  const map = mapImportHeaders(headers);
  const get = (r: readonly string[], k: keyof typeof map) => {
    const i = map[k];
    return i >= 0 ? (r[i] ?? "").trim().slice(0, 191) : "";
  };
  const out: ImportedParticipant[] = [];
  rows.forEach((r, i) => {
    if (r.every((c) => !c.trim())) return;
    const errors: string[] = [];
    const warnings: string[] = [];
    const firstName = get(r, "firstName");
    const lastName = get(r, "lastName");
    if (!firstName) errors.push("Vorname fehlt");
    if (!lastName) errors.push("Nachname fehlt");
    const rawBirth = get(r, "birthDate");
    let birthDate = rawBirth ? parseSwissDate(rawBirth) : null;
    if (rawBirth && !birthDate) warnings.push(`Geburtsdatum «${rawBirth}» nicht erkannt`);
    if (birthDate && (birthDate > today || birthDate < "1900-01-01")) {
      warnings.push(`Geburtsdatum ${chDate(birthDate)} unplausibel – leer gelassen`);
      birthDate = null;
    }
    const email = get(r, "email") || null;
    if (email && !EMAIL_RE.test(email)) errors.push(`E-Mail «${email}» ungültig`);
    const guardianEmail = get(r, "guardianEmail") || null;
    if (guardianEmail && !EMAIL_RE.test(guardianEmail)) errors.push(`E-Mail Erziehungsberechtigte «${guardianEmail}» ungültig`);
    const guardianName = get(r, "guardianName") || null;
    const guardianPhone = get(r, "guardianPhone") || null;
    if (isMinorOn(birthDate, refDay)) {
      if (!guardianName) errors.push("Minderjährig: Erziehungsberechtigte fehlen");
      else if (!guardianEmail && !guardianPhone) errors.push("Minderjährig: E-Mail oder Telefon der Erziehungsberechtigten fehlt");
    }
    if (!birthDate) warnings.push("Ohne Geburtsdatum kann das Alter nicht geprüft werden");
    out.push({ line: i + 2, firstName, lastName, birthDate, email, phone: get(r, "phone") || null, guardianName, guardianEmail, guardianPhone, errors, warnings });
  });
  return out;
}

/** Schlüssel für Doppelte (Name + Geburtsdatum). */
export function participantKey(p: { firstName: string; lastName: string; birthDate: string | null }) {
  const n = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return `${n(p.firstName)}|${n(p.lastName)}|${p.birthDate ?? ""}`;
}

/** Vor-/Nachname aus einem Anzeigenamen («Anna Muster» → Anna / Muster). */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: parts[0] ?? "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1]! };
}

/** Prüft die Pflichtangaben für Erziehungsberechtigte bei Minderjährigen. null = in Ordnung. */
export function guardianProblem(p: { birthDate: string | null; guardianName: string | null; guardianEmail: string | null; guardianPhone: string | null }, refDay: string): string | null {
  if (!isMinorOn(p.birthDate, refDay)) return null;
  if (!p.guardianName) return "Unter 18: Bitte die erziehungsberechtigte Person angeben.";
  if (!p.guardianEmail && !p.guardianPhone) return "Unter 18: Bitte E-Mail oder Telefon der erziehungsberechtigten Person angeben.";
  return null;
}
