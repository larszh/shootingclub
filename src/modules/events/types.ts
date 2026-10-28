/**
 * Anlässe & News – Typen, Konstanten und reine Hilfsfunktionen.
 * Ohne DB und ohne "server-only", damit Komponenten, Routen und Seed sie nutzen können.
 */
import { z } from "zod";
import { addDays, zurichParts, zurichToUtc, APP_TZ } from "@/lib/time";

export const EVENT_KINDS = ["TRAINING", "COMPETITION", "OBLIGATORY", "MEETING", "SOCIAL", "WORK", "OTHER"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_META: Record<EventKind, { label: string; plural: string; chip: string; dot: string }> = {
  TRAINING: { label: "Training", plural: "Trainings", chip: "bg-sky-500/12 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  COMPETITION: { label: "Wettkampf", plural: "Wettkämpfe", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  OBLIGATORY: { label: "Obligatorisch", plural: "Obligatorisch", chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  MEETING: { label: "Versammlung", plural: "Versammlungen", chip: "bg-violet-500/12 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  SOCIAL: { label: "Geselliges", plural: "Geselliges", chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  WORK: { label: "Arbeitseinsatz", plural: "Arbeitseinsätze", chip: "bg-orange-500/12 text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  OTHER: { label: "Anderes", plural: "Andere", chip: "bg-surface-2 text-ink-2", dot: "bg-ink-3" },
};

export function isEventKind(k: string | null | undefined): k is EventKind {
  return !!k && (EVENT_KINDS as readonly string[]).includes(k);
}

export function kindMeta(k: string) {
  return EVENT_KIND_META[isEventKind(k) ? k : "OTHER"];
}

export const RSVP_STATUSES = ["YES", "MAYBE", "NO"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const RSVP_LABELS: Record<RsvpStatus, string> = { YES: "Zusage", MAYBE: "Vielleicht", NO: "Absage" };
export const RSVP_MY_LABELS: Record<RsvpStatus, string> = { YES: "Du bist dabei", MAYBE: "Vielleicht", NO: "Abgemeldet" };

export function isRsvpStatus(s: string | null | undefined): s is RsvpStatus {
  return !!s && (RSVP_STATUSES as readonly string[]).includes(s);
}

export const MAX_GUESTS = 10;
export const MAX_RECURRENCE = 52;

// ---------------------------------------------------------------------------
// Zeiten
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;

/** Ende für Anzeige/Logik: gespeichertes Ende, sonst Tagesende (ganztägig) bzw. +2 h. */
export function effectiveEnd(e: { startsAt: Date; endsAt: Date | null; allDay: boolean }) {
  if (e.endsAt) return e.endsAt;
  if (e.allDay) return zurichToUtc(addDays(zurichParts(e.startsAt).dateStr, 1), "00:00");
  return new Date(e.startsAt.getTime() + 2 * HOUR);
}

export type RsvpWindow = { open: boolean; reason: string | null };

/** Ist die An-/Abmeldung offen? Reine Funktion, `now` kommt vom Aufrufer. */
export function rsvpWindow(e: { rsvpEnabled: boolean; isCancelled: boolean; startsAt: Date; rsvpDeadline: Date | null }, now: Date): RsvpWindow {
  if (!e.rsvpEnabled) return { open: false, reason: "Für diesen Anlass gibt es keine Anmeldung." };
  if (e.isCancelled) return { open: false, reason: "Der Anlass wurde abgesagt." };
  if (e.startsAt.getTime() <= now.getTime()) return { open: false, reason: "Der Anlass hat bereits begonnen." };
  if (e.rsvpDeadline && e.rsvpDeadline.getTime() < now.getTime()) return { open: false, reason: "Die Anmeldefrist ist abgelaufen." };
  return { open: true, reason: null };
}

const monthFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, month: "long", year: "numeric" });
const monthShortFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, weekday: "short" });
const weekdayLongFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, hour: "2-digit", minute: "2-digit" });
const shortDateFmt = new Intl.DateTimeFormat("de-CH", { timeZone: APP_TZ, weekday: "short", day: "2-digit", month: "2-digit" });

export function monthKey(d: Date) {
  return zurichParts(d).dateStr.slice(0, 7);
}

export function monthLabel(d: Date) {
  const s = monthFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Werte für das Kalenderblatt (Tag, Monat kurz, Wochentag). */
export function dateBadge(d: Date) {
  const { dateStr } = zurichParts(d);
  return { day: String(Number(dateStr.slice(8, 10))), month: monthShortFmt.format(d).replace(".", ""), weekday: weekdayFmt.format(d).replace(".", "") };
}

export function longDate(d: Date) {
  return weekdayLongFmt.format(d);
}

export function timeOf(d: Date) {
  return timeFmt.format(d);
}

/** Lesbare Zeitangabe, z.B. «18:30–20:30», «ab 19:30», «Ganztägig», «Sa 08.11. – So 09.11.». */
export function whenLabel(e: { startsAt: Date; endsAt: Date | null; allDay: boolean }) {
  if (e.allDay) {
    if (e.endsAt && zurichParts(e.endsAt).dateStr !== zurichParts(e.startsAt).dateStr) {
      return `${shortDateFmt.format(e.startsAt)} – ${shortDateFmt.format(e.endsAt)}`;
    }
    return "Ganztägig";
  }
  if (!e.endsAt) return `ab ${timeFmt.format(e.startsAt)} Uhr`;
  if (zurichParts(e.endsAt).dateStr !== zurichParts(e.startsAt).dateStr) {
    return `${timeFmt.format(e.startsAt)} – ${shortDateFmt.format(e.endsAt)} ${timeFmt.format(e.endsAt)}`;
  }
  return `${timeFmt.format(e.startsAt)}–${timeFmt.format(e.endsAt)} Uhr`;
}

export function deadlineLabel(d: Date) {
  return `${shortDateFmt.format(d)}, ${timeFmt.format(d)} Uhr`;
}

// ---------------------------------------------------------------------------
// Formular
// ---------------------------------------------------------------------------

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const optional = <T extends z.ZodTypeAny>(s: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());

export const eventFormSchema = z
  .object({
    id: optional(z.string().min(1).max(40)),
    title: z.string().trim().min(2, "Bitte einen Titel eingeben.").max(120, "Titel ist zu lang."),
    kind: z.enum(EVENT_KINDS),
    date: z.string().regex(dateRe, "Bitte ein Datum wählen."),
    allDay: z.boolean(),
    timeFrom: optional(z.string().regex(timeRe, "Ungültige Zeit.")),
    timeTo: optional(z.string().regex(timeRe, "Ungültige Zeit.")),
    endDate: optional(z.string().regex(dateRe, "Ungültiges Datum.")),
    location: optional(z.string().trim().max(160, "Ort ist zu lang.")),
    description: optional(z.string().trim().max(5000, "Beschreibung ist zu lang.")),
    rsvpEnabled: z.boolean(),
    capacity: optional(z.coerce.number().int().min(1, "Mindestens 1 Platz.").max(10000)),
    deadlineDate: optional(z.string().regex(dateRe, "Ungültiges Datum.")),
    deadlineTime: optional(z.string().regex(timeRe, "Ungültige Zeit.")),
    repeat: z.enum(["NONE", "WEEKLY", "BIWEEKLY"]).default("NONE"),
    repeatMode: z.enum(["COUNT", "UNTIL"]).default("COUNT"),
    repeatCount: optional(z.coerce.number().int().min(2, "Mindestens 2 Termine.").max(MAX_RECURRENCE, `Höchstens ${MAX_RECURRENCE} Termine.`)),
    repeatUntil: optional(z.string().regex(dateRe, "Ungültiges Datum.")),
  });
export type EventFormInput = z.infer<typeof eventFormSchema>;

export type EventTimes = { startsAt: Date; endsAt: Date | null; rsvpDeadline: Date | null };

/** Berechnet Start/Ende/Frist für ein Datum; Fehlertext bei ungültiger Kombination. */
export function computeTimes(input: EventFormInput, date: string, deadlineOffsetDays: number | null): EventTimes | { error: string; field: string } {
  let startsAt: Date;
  let endsAt: Date | null = null;
  if (input.allDay) {
    startsAt = zurichToUtc(date, "00:00");
    if (input.endDate) {
      const span = daysBetween(input.date, input.endDate);
      if (span < 0) return { error: "Das Enddatum liegt vor dem Startdatum.", field: "endDate" };
      if (span > 0) endsAt = zurichToUtc(addDays(date, span), "23:59");
    }
  } else {
    if (!input.timeFrom) return { error: "Bitte eine Startzeit angeben oder «Ganztägig» wählen.", field: "timeFrom" };
    startsAt = zurichToUtc(date, input.timeFrom);
    if (input.timeTo) {
      // Ende vor Start = über Mitternacht (z.B. 20:00–01:00)
      const endDate = input.timeTo <= input.timeFrom ? addDays(date, 1) : date;
      if (input.timeTo === input.timeFrom) return { error: "Die Endzeit muss nach der Startzeit liegen.", field: "timeTo" };
      endsAt = zurichToUtc(endDate, input.timeTo);
    }
  }
  let rsvpDeadline: Date | null = null;
  if (input.rsvpEnabled && deadlineOffsetDays !== null) {
    rsvpDeadline = zurichToUtc(addDays(date, deadlineOffsetDays), input.deadlineTime ?? "23:59");
    if (deadlineOffsetDays > 0 || rsvpDeadline.getTime() > startsAt.getTime()) {
      return { error: "Die Anmeldefrist muss vor dem Beginn liegen.", field: "deadlineDate" };
    }
  }
  return { startsAt, endsAt, rsvpDeadline };
}

export function daysBetween(from: string, to: string) {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** Datumsliste für Serien (wöchentlich / alle 2 Wochen). */
export function recurrenceDates(input: Pick<EventFormInput, "date" | "repeat" | "repeatMode" | "repeatCount" | "repeatUntil">): string[] | { error: string; field: string } {
  if (input.repeat === "NONE") return [input.date];
  const step = input.repeat === "WEEKLY" ? 7 : 14;
  const out: string[] = [];
  if (input.repeatMode === "COUNT") {
    const n = input.repeatCount;
    if (!n) return { error: "Bitte die Anzahl Termine angeben.", field: "repeatCount" };
    for (let i = 0; i < n; i++) out.push(addDays(input.date, i * step));
  } else {
    if (!input.repeatUntil) return { error: "Bitte ein Enddatum für die Serie angeben.", field: "repeatUntil" };
    if (input.repeatUntil < input.date) return { error: "Das Serienende liegt vor dem ersten Termin.", field: "repeatUntil" };
    for (let d = input.date; d <= input.repeatUntil; d = addDays(d, step)) {
      out.push(d);
      if (out.length > MAX_RECURRENCE) return { error: `Höchstens ${MAX_RECURRENCE} Termine pro Serie.`, field: "repeatUntil" };
    }
  }
  return out;
}

export const announcementSchema = z.object({
  id: optional(z.string().min(1).max(40)),
  title: z.string().trim().min(2, "Bitte einen Titel eingeben.").max(140, "Titel ist zu lang."),
  body: z.string().trim().min(1, "Bitte einen Text eingeben.").max(5000, "Text ist zu lang."),
  pinned: z.boolean(),
  expiresOn: optional(z.string().regex(dateRe, "Ungültiges Datum.")),
});

export const rsvpSchema = z.object({
  eventId: z.string().min(1).max(40),
  status: z.enum(RSVP_STATUSES),
  guests: z.coerce.number().int().min(0).max(MAX_GUESTS).default(0),
  note: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(191, "Bemerkung ist zu lang (max. 191 Zeichen).").optional()),
});

// ---------------------------------------------------------------------------
// Text: Zeilenumbrüche und Links ohne HTML
// ---------------------------------------------------------------------------

export type TextSegment = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_RE = /\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

/** Zerlegt Text in Text- und Link-Teile. React escaped den Rest, es wird kein HTML erzeugt. */
export function linkify(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    // Satzzeichen am Ende gehören nicht zum Link
    const trail = url.match(/[.,;:!?)\]]+$/);
    if (trail) url = url.slice(0, -trail[0].length);
    const start = m.index ?? 0;
    if (start > last) out.push({ type: "text", value: text.slice(last, start) });
    const href = url.toLowerCase().startsWith("www.") ? `https://${url}` : url;
    out.push({ type: "link", value: url, href });
    last = start + url.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export function webcalUrl(httpsUrl: string) {
  return httpsUrl.replace(/^https?:\/\//i, "webcal://");
}
