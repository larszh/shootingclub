import { z } from "zod";

/**
 * Vereinswaffen (Modul «weapons»). Ohne Server-Abhängigkeiten (Client und Server).
 * Hinweis: Die App unterstützt den Verein bei Ausleihe und Wartung, ersetzt aber nicht die
 * Verantwortung der zuständigen Person (Schützenmeister/Waffenverantwortliche).
 */

export const WEAPON_STATUSES = ["AVAILABLE", "LOANED", "SERVICE", "BLOCKED", "RETIRED"] as const;
export type WeaponStatus = (typeof WEAPON_STATUSES)[number];

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger" | "outline";

export const WEAPON_STATUS: Record<WeaponStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Verfügbar", tone: "ok" },
  LOANED: { label: "Ausgeliehen", tone: "accent" },
  SERVICE: { label: "In Wartung", tone: "warn" },
  BLOCKED: { label: "Gesperrt", tone: "danger" },
  RETIRED: { label: "Ausgemustert", tone: "outline" },
};

export function weaponStatusInfo(s: string) {
  return WEAPON_STATUS[s as WeaponStatus] ?? { label: s, tone: "neutral" as Tone };
}

export function isWeaponStatus(s: string): s is WeaponStatus {
  return (WEAPON_STATUSES as readonly string[]).includes(s);
}

export const SERVICE_KINDS = ["SERVICE", "REPAIR", "INSPECTION"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
export const SERVICE_KIND_LABEL: Record<ServiceKind, string> = {
  SERVICE: "Wartung",
  REPAIR: "Reparatur",
  INSPECTION: "Kontrolle",
};
export function serviceKindLabel(k: string) {
  return SERVICE_KIND_LABEL[k as ServiceKind] ?? k;
}

export const DISCIPLINE_SUGGESTIONS = ["Gewehr 300 m", "Gewehr 50 m", "Gewehr 10 m", "Pistole 50 m", "Pistole 25 m", "Pistole 10 m", "Armbrust"];

/** Standardfrist (Tage) für die Meldung einer Abgabe an Minderjährige – nur ein Vorschlag, bitte prüfen. */
export const DEFAULT_MINOR_REPORT_DAYS = 30;
/** Erinnerung, wenn die Meldefrist in so vielen Tagen oder weniger abläuft. */
export const MINOR_REPORT_WARN_DAYS = 5;

export const MINOR_HINT =
  "Abgabe an Minderjährige: Meldepflicht gemäss Waffengesetz prüfen (Frist und zuständige Stelle beim Kanton erfragen).";
export const CHECK_HINT = "Werte bitte mit den aktuellen Vorgaben (VBS/SSV/Kanton) prüfen.";
export const RESPONSIBILITY_HINT =
  "Die App unterstützt bei Ausleihe, Kontrolle und Wartung. Die Verantwortung für die Einhaltung der gesetzlichen Vorgaben bleibt bei der zuständigen Person im Verein.";

const optText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v ?? null),
    z.string().max(max, `Maximal ${max} Zeichen.`).nullable(),
  );

const optInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? v.replace(/['’\s]/g, "") : v), z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable());

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum.").refine((s) => !Number.isNaN(Date.parse(s)), "Ungültiges Datum.");
const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), dateKeySchema.nullable());

export const weaponSchema = z.object({
  name: z.string().trim().min(1, "Name fehlt.").max(191, "Name: maximal 191 Zeichen."),
  discipline: optText(191),
  manufacturer: optText(191),
  model: optText(191),
  caliber: optText(191),
  serialNumber: optText(191),
  shotCount: optInt(0, 100_000_000, "Schusszähler: ganze Zahl ab 0.").transform((v) => v ?? 0),
  serviceEveryShots: optInt(1, 10_000_000, "Wartungsintervall: ganze Zahl ab 1."),
  nextServiceAt: optDate,
  notes: optText(5000),
});
export type WeaponInput = z.infer<typeof weaponSchema>;

export const loanSchema = z
  .object({
    weaponId: z.string().min(1).max(40),
    userId: z.string().max(40).nullable(),
    borrowerName: optText(191),
    isMinor: z.boolean(),
    onSiteOnly: z.boolean(),
    dueDate: optDate,
    reportDays: optInt(1, 365, "Meldefrist: 1 bis 365 Tage."),
    note: optText(191),
  })
  .refine((v) => !!v.userId || !!v.borrowerName, { message: "Bitte ein Mitglied wählen oder einen Namen eingeben.", path: ["borrowerName"] });
export type LoanInput = z.infer<typeof loanSchema>;

export const serviceSchema = z.object({
  weaponId: z.string().min(1).max(40),
  date: dateKeySchema,
  kind: z.enum(SERVICE_KINDS),
  note: optText(191),
  cost: optText(20),
  byName: optText(191),
  release: z.boolean(),
  nextServiceAt: optDate,
});

export const shotsSchema = z.number().int("Schusszahl: ganze Zahl.").min(0, "Schusszahl ab 0.").max(100_000, "Schusszahl zu gross.").nullable();

export const blockReasonSchema = z.string().trim().min(1, "Bitte einen Grund angeben.").max(191, "Grund: maximal 191 Zeichen.");
