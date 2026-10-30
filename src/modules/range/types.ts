import { z } from "zod";

/**
 * Standbetrieb (Modul «range»). Ohne Server-Abhängigkeiten (Client und Server).
 */

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "outline";

export const CHECK_HINT = "Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.";
export const RESPONSIBILITY_HINT =
  "Die App unterstützt die verantwortliche Person (Schützenmeister/Standchef), ersetzt aber nicht deren Verantwortung für einen sicheren Schiessbetrieb.";
export const INCIDENT_HINT = "Bei Unfällen zuerst Notruf, dann Versicherung (z.B. USS) gemäss deren Vorgaben melden.";
export const MINOR_GUEST_HINT = "Minderjährig: nur mit Begleitung bzw. gemäss den geltenden Vorgaben schiessen lassen.";

export const EMERGENCY_NUMBERS = [
  { number: "144", label: "Sanität" },
  { number: "117", label: "Polizei" },
  { number: "118", label: "Feuerwehr" },
  { number: "145", label: "Tox Info" },
] as const;

export const INCIDENT_KINDS = [
  { key: "ACCIDENT", label: "Unfall" },
  { key: "NEAR_MISS", label: "Beinahe-Unfall" },
  { key: "DAMAGE", label: "Sachschaden" },
  { key: "OTHER", label: "Anderes" },
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number]["key"];

export const INCIDENT_SEVERITIES = [
  { key: "LOW", label: "Gering", tone: "neutral" as Tone },
  { key: "MEDIUM", label: "Mittel", tone: "warn" as Tone },
  { key: "HIGH", label: "Hoch", tone: "danger" as Tone },
] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number]["key"];

export const INCIDENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Offen", tone: "accent" },
  CLOSED: { label: "Abgeschlossen", tone: "ok" },
};

export const kindLabel = (k: string) => INCIDENT_KINDS.find((x) => x.key === k)?.label ?? k;
export const severityInfo = (s: string) => INCIDENT_SEVERITIES.find((x) => x.key === s) ?? INCIDENT_SEVERITIES[0];

export const DISCIPLINE_SUGGESTIONS = ["Gewehr 300 m", "Pistole 25 m", "Pistole 50 m", "Kleinkaliber 50 m", "Luftgewehr 10 m", "Luftpistole 10 m", "Armbrust"];

export const HALF_DAY_LABELS = { usedAm: "Vormittag", usedPm: "Nachmittag", usedEvening: "Abend" } as const;

// --- Validierung -----------------------------------------------------------------------

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .transform((v) => (v ? v : null));

export const idSchema = z.string().min(1).max(40);
export const clientIdSchema = z.string().min(8).max(64).regex(/^[\w-]+$/);

export const guestSchema = z.object({
  guestName: z.string().trim().min(2, "Name fehlt.").max(191),
  guestBirthYear: z.coerce.number().int().min(1900).max(2100).optional(),
  guestPhone: optText(40),
  guestEmail: z
    .string()
    .trim()
    .max(191)
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Ungültige E-Mail."),
  hostUserId: optText(40),
  guestIdChecked: z.boolean(),
  rulesExplained: z.boolean(),
  lane: optText(40),
  discipline: optText(80),
  note: optText(191),
});

export const visitUpdateSchema = z.object({
  lane: optText(40),
  discipline: optText(80),
  note: optText(191),
});

export const rulesSchema = z.object({
  title: z.string().trim().min(2, "Titel fehlt.").max(191),
  // Browser senden Textarea-Inhalte mit CRLF; einheitlich mit LF speichern (sonst bleibt der Editor «ungespeichert»).
  body: z.string().transform(normalizeRulesBody).pipe(z.string().min(10, "Text fehlt.").max(30000, "Text zu lang.")),
});

/** Zeilenenden auf LF vereinheitlichen und trimmen (Server und Editor vergleichen so dasselbe). */
export function normalizeRulesBody(s: string): string {
  return s.replace(/\r\n?/g, "\n").trim();
}

export const windowSchema = z.object({
  resourceId: optText(40),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Mindestens einen Wochentag wählen."),
  start: z.string().regex(/^\d{1,2}:\d{2}$/, "Zeit im Format HH:MM."),
  end: z.string().regex(/^\d{1,2}:\d{2}$/, "Zeit im Format HH:MM."),
  note: optText(191),
});

export const quotaSchema = z.object({
  resourceId: optText(40),
  year: z.coerce.number().int().min(2000).max(2100),
  maxHalfDays: z.coerce.number().int().min(0, "Ungültige Zahl.").max(1000, "Ungültige Zahl."),
  note: optText(191),
});

export const incidentSchema = z.object({
  kind: z.enum(["ACCIDENT", "NEAR_MISS", "DAMAGE", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum fehlt."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Zeit fehlt."),
  location: optText(191),
  description: z.string().trim().min(5, "Bitte beschreiben, was passiert ist.").max(10000),
  persons: optText(5000),
  measures: optText(5000),
  clientId: clientIdSchema.optional(),
});

export const closeFlagsSchema = z.object({
  usedAm: z.boolean(),
  usedPm: z.boolean(),
  usedEvening: z.boolean(),
  notes: z.string().trim().max(5000).optional().transform((v) => (v ? v : null)),
});

/** Kurze Zufalls-ID für Check-ins (Doppeltipps und Offline-Wiederholungen ergeben keinen zweiten Eintrag). */
export function newClientId(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Ältere Browser ohne randomUUID (z.B. ohne HTTPS im lokalen Netz)
  const bytes = c.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b: number) => b.toString(16).padStart(2, "0")).join("");
}
