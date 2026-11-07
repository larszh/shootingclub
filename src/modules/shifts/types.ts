/**
 * Helfereinsätze – Typen, Schemas und Texte (ohne DB, ohne "server-only").
 */
import { z } from "zod";
import { msg } from "@/lib/i18n/extra/admin2/msg";

export const CHECK_HINT = "Werte bitte mit den Vorgaben des Vereins (Statuten, GV-Beschluss) prüfen.";

export const ASSIGNMENT_LABELS: Record<string, { label: string; tone: "neutral" | "ok" | "danger" | "accent" }> = {
  ASSIGNED: { label: "eingeteilt", tone: "accent" },
  DONE: { label: "erledigt", tone: "ok" },
  NO_SHOW: { label: "nicht erschienen", tone: "danger" },
};

/** Status, für die eine Arbeitsstundenpflicht wählbar ist (ohne «Ausgetreten»). */
export const WORK_STATUS_OPTIONS = ["ACTIVE", "JUNIOR", "PASSIVE", "HONORARY", "SUPPORTER"] as const;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "adm2.shifts.v.date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "adm2.shifts.v.time");
const optText = (max: number) => z.string().trim().max(max, msg("adm2.common.maxChars", { max })).transform((v) => v || null);
/** Zahl aus Formulartext («2,5» oder «2.5»); leer = `empty` (null) oder Fehler. */
function decimal(o: { min: number; max: number; empty?: number | null; required?: string; gt?: boolean }) {
  return z.string().trim().transform((raw, c) => {
    const v = raw.replace(",", ".");
    if (v === "") {
      if (o.empty !== undefined) return o.empty;
      c.addIssue({ code: "custom", message: o.required ?? "adm2.shifts.v.number" });
      return z.NEVER;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) {
      c.addIssue({ code: "custom", message: "adm2.shifts.v.number" });
      return z.NEVER;
    }
    if (o.gt ? n <= o.min : n < o.min) {
      c.addIssue({ code: "custom", message: o.gt ? (o.required ?? "adm2.shifts.v.gt0") : "adm2.shifts.v.negative" });
      return z.NEVER;
    }
    if (n > o.max) {
      c.addIssue({ code: "custom", message: msg("adm2.shifts.v.max", { max: o.max }) });
      return z.NEVER;
    }
    return n;
  });
}
const optHours = decimal({ min: 0, max: 24, empty: null });

export const shiftSchema = z.object({
  title: z.string().trim().min(1, "adm2.shifts.v.title").max(191, msg("adm2.common.maxChars", { max: 191 })),
  eventId: optText(40),
  date: day,
  startTime: time,
  endTime: time,
  capacity: z.coerce.number({ message: "adm2.shifts.v.number" }).int("adm2.shifts.v.int").min(1, "adm2.shifts.v.min1").max(500, msg("adm2.shifts.v.max", { max: 500 })),
  requiredQualification: optText(40),
  hoursCredit: optHours,
  note: optText(191),
});
export type ShiftInput = z.infer<typeof shiftSchema>;

export const copySchema = z.object({
  from: day,
  to: day,
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "adm2.shifts.v.weekday"),
  everyWeeks: z.coerce.number().int().min(1).max(8),
});

export const workLogSchema = z.object({
  date: day,
  hours: decimal({ min: 0, gt: true, max: 24, required: "adm2.shifts.v.hours" }).transform((n) => n ?? 0),
  description: z.string().trim().min(2, "adm2.shifts.v.describe").max(191, msg("adm2.common.maxChars", { max: 191 })),
});

export const settingsSchema = z.object({
  enabled: z.boolean(),
  /** Soll anteilig bei Eintritt/Austritt im Lauf des Jahres (Monate/12, auf 0.5 h gerundet) */
  proRata: z.boolean(),
  requiredHours: decimal({ min: 0, max: 1000, empty: 0 }).transform((n) => n ?? 0),
  rate: decimal({ min: 0, max: 10_000, empty: 0 }).transform((n) => n ?? 0),
  statuses: z.array(z.enum(WORK_STATUS_OPTIONS)),
});

export const WEEKDAYS = [
  { value: 1, short: "Mo", label: "Montag" },
  { value: 2, short: "Di", label: "Dienstag" },
  { value: 3, short: "Mi", label: "Mittwoch" },
  { value: 4, short: "Do", label: "Donnerstag" },
  { value: 5, short: "Fr", label: "Freitag" },
  { value: 6, short: "Sa", label: "Samstag" },
  { value: 0, short: "So", label: "Sonntag" },
] as const;

export function firstIssue(err: z.ZodError) {
  const i = err.issues[0];
  return { message: i?.message ?? "adm2.common.invalidInput", field: i?.path[0] != null ? String(i.path[0]) : undefined };
}
