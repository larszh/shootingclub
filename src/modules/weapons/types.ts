import { z } from "zod";
import { msg } from "@/lib/i18n/extra/admin2/msg";

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

/** Status mit Bezeichnung; mit `t` in der Sprache der Seite (Schlüssel «adm2.weapons.status.<S>»). */
export function weaponStatusInfo(s: string, t?: (key: string) => string) {
  const info = WEAPON_STATUS[s as WeaponStatus];
  if (!info) return { label: s, tone: "neutral" as Tone };
  return t ? { ...info, label: t(`adm2.weapons.status.${s}`) } : info;
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
export function serviceKindLabel(k: string, t?: (key: string) => string) {
  const de = SERVICE_KIND_LABEL[k as ServiceKind];
  if (!de) return k;
  return t ? t(`adm2.weapons.kind.${k}`) : de;
}

export const DISCIPLINE_SUGGESTIONS = ["Gewehr 300 m", "Gewehr 50 m", "Gewehr 10 m", "Pistole 50 m", "Pistole 25 m", "Pistole 10 m", "Armbrust"];

/** Vorschläge für die Disziplin in der Sprache der Seite (Schlüssel «adm2.weapons.disc.<i>»). */
export const disciplineSuggestions = (t: (key: string) => string) => DISCIPLINE_SUGGESTIONS.map((_, i) => t(`adm2.weapons.disc.${i}`));

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
    z.string().max(max, msg("adm2.common.maxChars", { max })).nullable(),
  );

const optInt = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? v.replace(/['’\s]/g, "") : v), z.coerce.number().int(msg).min(min, msg).max(max, msg).nullable());

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "adm2.weapons.v.invalidDate").refine((s) => !Number.isNaN(Date.parse(s)), "adm2.weapons.v.invalidDate");
const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), dateKeySchema.nullable());

export const weaponSchema = z.object({
  name: z.string().trim().min(1, "adm2.weapons.v.nameMissing").max(191, "adm2.weapons.v.nameMax"),
  discipline: optText(191),
  manufacturer: optText(191),
  model: optText(191),
  caliber: optText(191),
  serialNumber: optText(191),
  shotCount: optInt(0, 100_000_000, "adm2.weapons.v.shotCount").transform((v) => v ?? 0),
  serviceEveryShots: optInt(1, 10_000_000, "adm2.weapons.v.serviceEvery"),
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
    reportDays: optInt(1, 365, "adm2.weapons.v.reportDays"),
    note: optText(191),
  })
  .refine((v) => !!v.userId || !!v.borrowerName, { message: "adm2.weapons.v.borrower", path: ["borrowerName"] });
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

export const shotsSchema = z.number().int("adm2.weapons.v.shotsInt").min(0, "adm2.weapons.v.shotsMin").max(100_000, "adm2.weapons.v.shotsMax").nullable();

export const blockReasonSchema = z.string().trim().min(1, "adm2.weapons.v.reason").max(191, "adm2.weapons.v.reasonMax");

/** Einstellungen pro Verein (WeaponSettings). Fehlt der Datensatz, gelten die Standardwerte. */
export const weaponSettingsSchema = z.object({
  minorReportDays: optInt(1, 365, "adm2.weapons.v.reportDays").transform((v) => v ?? DEFAULT_MINOR_REPORT_DAYS),
  serviceEveryShotsDefault: optInt(1, 10_000_000, "adm2.weapons.v.serviceEvery"),
});
export type WeaponSettingsInput = z.infer<typeof weaponSettingsSchema>;
export type WeaponSettingsView = { minorReportDays: number; serviceEveryShotsDefault: number | null; saved: boolean };

/** Datensatz → Einstellungen mit Rückfall auf die Standardwerte. */
export function resolveWeaponSettings(row: { minorReportDays: number; serviceEveryShotsDefault: number | null } | null | undefined): WeaponSettingsView {
  const days = row && Number.isInteger(row.minorReportDays) && row.minorReportDays >= 1 && row.minorReportDays <= 365 ? row.minorReportDays : DEFAULT_MINOR_REPORT_DAYS;
  const every = row?.serviceEveryShotsDefault && row.serviceEveryShotsDefault > 0 ? row.serviceEveryShotsDefault : null;
  return { minorReportDays: days, serviceEveryShotsDefault: every, saved: !!row };
}
