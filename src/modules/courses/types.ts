import { z } from "zod";
import { msg } from "@/lib/i18n/extra/admin2/msg";

type Tr = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Kurse (Modul «courses»): Jungschützen, J+S, Ausbildung, Polizei/Sicherheit und Qualifikationsschiessen.
 * Ohne Server-Abhängigkeiten (Client und Server).
 * Die App unterstützt die Kursleitung bei Planung, Präsenz und Resultaten; sie ersetzt weder die
 * Vorgaben von VBS/BASPO/SSV/Kanton noch die Verantwortung der Kursleitung.
 */

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "outline";

export const COURSE_KINDS = ["JUNGSCHUETZEN", "JS", "TRAINING", "POLICE", "OTHER"] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

export const COURSE_KIND: Record<CourseKind, { label: string; short: string; text: string }> = {
  JUNGSCHUETZEN: {
    label: "Jungschützenkurs",
    short: "Jungschützen",
    text: "Kurs für Jugendliche mit dem Sturmgewehr auf 300 m nach den Vorgaben des VBS (Leihwaffe und Munition in der Regel über den Bund, Meldung über die kantonalen Stellen – Details bitte prüfen). Nicht zu verwechseln mit J+S.",
  },
  JS: {
    label: "J+S Sportschiessen",
    short: "J+S",
    text: "Jugend+Sport-Angebot des BASPO. Die Administration (Anmeldung, Präsenz, Abschluss) läuft in der Regel über die NDS (Nationale Datenbank Sport) durch den J+S-Coach. Die Präsenzliste hier kann als CSV für die Übertragung in die NDS exportiert werden.",
  },
  TRAINING: {
    label: "Ausbildung / Einsteigerkurs",
    short: "Ausbildung",
    text: "Vereinsinterner Kurs, z.B. Einsteigerkurs, Pistolenkurs oder Weiterbildung für Mitglieder.",
  },
  POLICE: {
    label: "Polizei / Sicherheit",
    short: "Polizei/Sicherheit",
    text: "Aus- und Weiterbildung für Polizei, Sicherheitsdienste oder Firmen, oft mit Qualifikationsschiessen und Nachweis.",
  },
  OTHER: { label: "Anderer Kurs", short: "Andere", text: "Freie Kursart." },
};

export function isCourseKind(k: string | null | undefined): k is CourseKind {
  return !!k && (COURSE_KINDS as readonly string[]).includes(k);
}
/** Bezeichnung der Kursart; mit `t` in der Sprache der Seite (Schlüssel «adm2.courses.kind.<K>»). */
export function courseKindLabel(k: string, t?: Tr) {
  if (!isCourseKind(k)) return k;
  return t ? t(`adm2.courses.kind.${k}`) : COURSE_KIND[k].label;
}
/** Kurzbezeichnung bzw. Erklärung der Kursart in der Sprache der Seite. */
export function courseKindShort(k: string, t: Tr) {
  return isCourseKind(k) ? t(`adm2.courses.kindShort.${k}`) : k;
}
export function courseKindText(k: string, t: Tr) {
  return isCourseKind(k) ? t(`adm2.courses.kindText.${k}`) : "";
}

export const COURSE_STATUSES = ["PLANNED", "RUNNING", "CLOSED"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];
export const COURSE_STATUS: Record<CourseStatus, { label: string; tone: Tone }> = {
  PLANNED: { label: "Geplant", tone: "neutral" },
  RUNNING: { label: "Läuft", tone: "accent" },
  CLOSED: { label: "Abgeschlossen", tone: "outline" },
};
export function isCourseStatus(s: string): s is CourseStatus {
  return (COURSE_STATUSES as readonly string[]).includes(s);
}
export function courseStatusInfo(s: string, t?: Tr) {
  const info = COURSE_STATUS[s as CourseStatus];
  if (!info) return { label: s, tone: "neutral" as Tone };
  return t ? { ...info, label: t(`adm2.courses.status.${s}`) } : info;
}

export const PARTICIPANT_STATUSES = ["REGISTERED", "ACTIVE", "COMPLETED", "DROPPED"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];
export const PARTICIPANT_STATUS: Record<ParticipantStatus, { label: string; tone: Tone }> = {
  REGISTERED: { label: "Angemeldet", tone: "neutral" },
  ACTIVE: { label: "Aktiv", tone: "accent" },
  COMPLETED: { label: "Abgeschlossen", tone: "ok" },
  DROPPED: { label: "Ausgetreten", tone: "outline" },
};
export function isParticipantStatus(s: string): s is ParticipantStatus {
  return (PARTICIPANT_STATUSES as readonly string[]).includes(s);
}
export function participantStatusInfo(s: string, t?: Tr) {
  const info = PARTICIPANT_STATUS[s as ParticipantStatus];
  if (!info) return { label: s, tone: "neutral" as Tone };
  return t ? { ...info, label: t(`adm2.courses.pstatus.${s}`) } : info;
}

/** Vorschlag Mindestteilnehmerzahl pro Kursart (nur Vorschlag, bitte prüfen). */
export const DEFAULT_MIN_PARTICIPANTS: Partial<Record<CourseKind, number>> = { JUNGSCHUETZEN: 5 };

export const CHECK_HINT = "Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.";
export const RESPONSIBILITY_HINT =
  "Die App unterstützt die Kursleitung bei Präsenz, Resultaten und Nachweisen. Die Verantwortung für die Einhaltung der Vorgaben (VBS, BASPO, SSV, Kanton) bleibt bei der Kursleitung bzw. dem Verein.";
export const QUAL_RESPONSIBILITY_HINT =
  "Der Nachweis bestätigt das erzielte Resultat gemäss den Regeln des Vereins bzw. Auftraggebers. Die Beurteilung der Eignung liegt beim verantwortlichen Ausbildner.";

// --- Validierung --------------------------------------------------------------------------------

const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v ?? null),
    z.string().max(max, msg("adm2.common.maxChars", { max })).nullable(),
  );

const optInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? v.replace(/['’\s]/g, "") : v), z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable());

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "adm2.courses.v.invalidDate").refine((s) => !Number.isNaN(Date.parse(s)), "adm2.courses.v.invalidDate");
const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), dateKeySchema.nullable());
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "adm2.courses.v.invalidTime");
const optTime = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), timeSchema.nullable());
const optEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v ?? null),
  z.string().max(191, "adm2.courses.v.emailMax").regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "adm2.courses.v.email").nullable(),
);
const idOpt = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().min(1).max(40).nullable());

export const courseSchema = z
  .object({
    name: z.string().trim().min(1, "adm2.courses.v.courseName").max(191, "adm2.courses.v.nameMax"),
    kind: z.enum(COURSE_KINDS, { message: "adm2.courses.v.kind" }),
    year: z.coerce.number().int().min(2000, "adm2.courses.v.year").max(2100, "adm2.courses.v.year"),
    startsOn: optDate,
    endsOn: optDate,
    leaderUserId: idOpt,
    minParticipants: optInt(0, 1000, "adm2.courses.v.minParticipants"),
    requiredProgramIds: z.array(z.string().min(1).max(40)).max(30, "adm2.courses.v.maxPrograms"),
    notes: optText(5000),
    status: z.enum(COURSE_STATUSES).default("PLANNED"),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { message: "adm2.courses.v.endBeforeStart", path: ["endsOn"] });
export type CourseInput = z.infer<typeof courseSchema>;

export const participantSchema = z.object({
  userId: idOpt,
  firstName: z.string().trim().min(1, "adm2.courses.v.firstName").max(191, "adm2.courses.v.firstNameMax"),
  lastName: z.string().trim().min(1, "adm2.courses.v.lastName").max(191, "adm2.courses.v.lastNameMax"),
  birthDate: optDate,
  email: optEmail,
  phone: optText(191),
  street: optText(191),
  zip: optText(191),
  city: optText(191),
  guardianName: optText(191),
  guardianEmail: optEmail,
  guardianPhone: optText(191),
  clubWeaponId: idOpt,
  status: z.enum(PARTICIPANT_STATUSES).default("REGISTERED"),
  note: optText(191),
});
export type ParticipantInput = z.infer<typeof participantSchema>;

export const sessionSchema = z
  .object({
    title: z.string().trim().min(1, "adm2.courses.v.title").max(191, "adm2.courses.v.titleMax"),
    date: dateKeySchema,
    startTime: timeSchema,
    endTime: optTime,
    createEvent: z.boolean(),
    location: optText(191),
  })
  .refine((v) => !v.endTime || v.endTime > v.startTime, { message: "adm2.courses.v.endAfter", path: ["endTime"] });
export type SessionInput = z.infer<typeof sessionSchema>;

const scoreSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? v.replace(",", ".").trim() : v),
  z.coerce.number({ message: "adm2.courses.v.score" }).min(0, "adm2.courses.v.scoreMin").max(100_000, "adm2.courses.v.scoreMax").nullable(),
);

export const resultSchema = z.object({
  participantId: z.string().min(1).max(40),
  programId: idOpt,
  label: optText(191),
  score: scoreSchema,
  passed: z.boolean(),
  date: dateKeySchema,
});

export const ruleSchema = z.object({
  programId: z.string().min(1, "adm2.courses.v.program").max(40),
  name: z.string().trim().min(1, "adm2.courses.v.name").max(191, "adm2.courses.v.nameMax"),
  kind: z.string().min(1).max(40),
  passScore: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".").trim() : v),
    z.coerce.number({ message: "adm2.courses.v.passScore" }).min(0, "adm2.courses.v.passScoreMin").max(100_000, "adm2.courses.v.passScoreMax"),
  ),
  maxZeros: optInt(0, 1000, "adm2.courses.v.maxZeros"),
  validityMonths: z.coerce.number().int("adm2.courses.v.validityInt").min(1, "adm2.courses.v.validityMin").max(240, "adm2.courses.v.validityMax"),
  requireInstructor: z.boolean(),
  isActive: z.boolean(),
});
export type RuleInput = z.infer<typeof ruleSchema>;

/** Spalten der Teilnehmer-Importvorlage (in dieser Reihenfolge). */
export const IMPORT_COLUMNS = [
  "Vorname",
  "Nachname",
  "Geburtsdatum",
  "E-Mail",
  "Telefon",
  "Erziehungsberechtigte",
  "E-Mail Erziehungsberechtigte",
  "Telefon Erziehungsberechtigte",
] as const;

/**
 * Qualifikationsarten, die die Kursleitung (nur «courses.manage») über Qualifikationsschiessen vergeben darf.
 * Sicherheits- und Leiterqualifikationen (Schützenmeister, Standchef, J+S-Leiter usw.) nur mit «qualifications.manage».
 */
export const TRAINER_QUAL_KINDS: readonly string[] = ["WEAPON_QUAL", "OTHER"];

/** Braucht diese Qualifikationsart «qualifications.manage» (Admin)? Unbekannte Arten gelten als geschützt. */
export function isProtectedQualKind(kind: string): boolean {
  return !TRAINER_QUAL_KINDS.includes(kind);
}

/** «1 Monat» / «12 Monate». */
export function monthsLabel(n: number, t?: Tr): string {
  if (t) return t(n === 1 ? "adm2.courses.months.one" : "adm2.courses.months.other", { n });
  return `${n} ${n === 1 ? "Monat" : "Monate"}`;
}
