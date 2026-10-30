import { z } from "zod";

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
export function courseKindLabel(k: string) {
  return isCourseKind(k) ? COURSE_KIND[k].label : k;
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
export function courseStatusInfo(s: string) {
  return COURSE_STATUS[s as CourseStatus] ?? { label: s, tone: "neutral" as Tone };
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
export function participantStatusInfo(s: string) {
  return PARTICIPANT_STATUS[s as ParticipantStatus] ?? { label: s, tone: "neutral" as Tone };
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
    z.string().max(max, `Maximal ${max} Zeichen.`).nullable(),
  );

const optInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? v.replace(/['’\s]/g, "") : v), z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable());

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.").refine((s) => !Number.isNaN(Date.parse(s)), "Ungültiges Datum.");
const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), dateKeySchema.nullable());
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ungültige Uhrzeit.");
const optTime = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), timeSchema.nullable());
const optEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v ?? null),
  z.string().max(191, "E-Mail: maximal 191 Zeichen.").regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Ungültige E-Mail-Adresse.").nullable(),
);
const idOpt = z.preprocess((v) => (v === "" || v === undefined ? null : v), z.string().min(1).max(40).nullable());

export const courseSchema = z
  .object({
    name: z.string().trim().min(1, "Bitte einen Kursnamen angeben.").max(191, "Name: maximal 191 Zeichen."),
    kind: z.enum(COURSE_KINDS, { message: "Bitte eine Kursart wählen." }),
    year: z.coerce.number().int().min(2000, "Ungültiges Jahr.").max(2100, "Ungültiges Jahr."),
    startsOn: optDate,
    endsOn: optDate,
    leaderUserId: idOpt,
    minParticipants: optInt(0, 1000, "Mindestanzahl: ganze Zahl ab 0."),
    requiredProgramIds: z.array(z.string().min(1).max(40)).max(30, "Höchstens 30 Pflichtprogramme."),
    notes: optText(5000),
    status: z.enum(COURSE_STATUSES).default("PLANNED"),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { message: "Das Enddatum liegt vor dem Startdatum.", path: ["endsOn"] });
export type CourseInput = z.infer<typeof courseSchema>;

export const participantSchema = z.object({
  userId: idOpt,
  firstName: z.string().trim().min(1, "Vorname fehlt.").max(191, "Vorname: maximal 191 Zeichen."),
  lastName: z.string().trim().min(1, "Nachname fehlt.").max(191, "Nachname: maximal 191 Zeichen."),
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
    title: z.string().trim().min(1, "Bitte einen Titel angeben.").max(191, "Titel: maximal 191 Zeichen."),
    date: dateKeySchema,
    startTime: timeSchema,
    endTime: optTime,
    createEvent: z.boolean(),
    location: optText(191),
  })
  .refine((v) => !v.endTime || v.endTime > v.startTime, { message: "Ende muss nach dem Beginn liegen.", path: ["endTime"] });
export type SessionInput = z.infer<typeof sessionSchema>;

const scoreSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? v.replace(",", ".").trim() : v),
  z.coerce.number({ message: "Ungültige Punktzahl." }).min(0, "Punktzahl ab 0.").max(100_000, "Punktzahl zu gross.").nullable(),
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
  programId: z.string().min(1, "Bitte ein Programm wählen.").max(40),
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(191, "Name: maximal 191 Zeichen."),
  kind: z.string().min(1).max(40),
  passScore: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(",", ".").trim() : v),
    z.coerce.number({ message: "Mindestpunktzahl fehlt." }).min(0, "Mindestpunktzahl ab 0.").max(100_000, "Mindestpunktzahl zu gross."),
  ),
  maxZeros: optInt(0, 1000, "Max. Nuller: ganze Zahl ab 0."),
  validityMonths: z.coerce.number().int("Gültigkeit: ganze Monate.").min(1, "Gültigkeit: mindestens 1 Monat.").max(240, "Gültigkeit: höchstens 240 Monate."),
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
export function monthsLabel(n: number): string {
  return `${n} ${n === 1 ? "Monat" : "Monate"}`;
}
