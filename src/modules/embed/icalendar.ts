/**
 * iCalendar-Feeds (RFC 5545) mit Zeitzone – reiner Generator ohne DB.
 *
 * Unterschiede zum einfachen Generator in events/ics.ts (Einzeltermine):
 * - VTIMEZONE-Block für Europe/Zurich, Termine mit Uhrzeit als DTSTART;TZID=Europe/Zurich (Lokalzeit),
 *   damit Kalender-Apps Sommer-/Winterzeit korrekt anzeigen und Serien stabil bleiben.
 * - SEQUENCE aus updatedAt (Sekunden seit 1.1.2024), damit Clients Änderungen sicher übernehmen.
 * - Abgesagte Termine bleiben als STATUS:CANCELLED im Feed (Aufräumen entscheidet der Aufrufer).
 * Ganztägige Termine als VALUE=DATE, Zeilen nach 75 Oktetten gefaltet (UTF-8-sicher), CRLF.
 */
import { addDays, APP_TZ, zurichParts } from "@/lib/time";
import { foldLine, icsEscape } from "@/modules/events/ics";
import { effectiveEnd } from "@/modules/events/types";

export type FeedEvent = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  url?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  categories?: string[];
  /** Letzte Änderung: DTSTAMP, LAST-MODIFIED und SEQUENCE */
  updatedAt: Date;
  created?: Date | null;
};

export type FeedCalendar = {
  name: string;
  description?: string;
  events: FeedEvent[];
};

/** Referenz für SEQUENCE: Sekunden seit 1.1.2024 (UTC) – klein genug für 32-Bit-Clients. */
const SEQUENCE_EPOCH = Date.UTC(2024, 0, 1);

export function sequenceOf(updatedAt: Date) {
  return Math.max(0, Math.floor((updatedAt.getTime() - SEQUENCE_EPOCH) / 1000));
}

/** VTIMEZONE für Europe/Zurich (MEZ/MESZ, Regeln seit 1996: letzter Sonntag im März/Oktober). */
export const VTIMEZONE_ZURICH = [
  "BEGIN:VTIMEZONE",
  `TZID:${APP_TZ}`,
  `X-LIC-LOCATION:${APP_TZ}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
] as const;

export function utcStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lokalzeit Zürich als «YYYYMMDDTHHMMSS» (für DTSTART;TZID=Europe/Zurich). */
export function zurichLocalStamp(d: Date) {
  const p = zurichParts(d);
  return `${p.dateStr.replace(/-/g, "")}T${p.timeStr.replace(":", "")}00`;
}

/** Werte ohne Zeilenumbrüche (URI, UID). */
function plain(v: string) {
  return v.replace(/[\r\n]+/g, "");
}

export function feedEventLines(e: FeedEvent): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${plain(e.uid)}`, `DTSTAMP:${utcStamp(e.updatedAt)}`];
  if (e.allDay) {
    const startDate = zurichParts(e.startsAt).dateStr;
    const endDate = e.endsAt ? zurichParts(e.endsAt).dateStr : startDate;
    lines.push(`DTSTART;VALUE=DATE:${startDate.replace(/-/g, "")}`);
    // DTEND ist exklusiv: Tag nach dem letzten Tag
    lines.push(`DTEND;VALUE=DATE:${addDays(endDate < startDate ? startDate : endDate, 1).replace(/-/g, "")}`);
  } else {
    const end = e.endsAt && e.endsAt.getTime() > e.startsAt.getTime() ? e.endsAt : effectiveEnd({ startsAt: e.startsAt, endsAt: null, allDay: false });
    lines.push(`DTSTART;TZID=${APP_TZ}:${zurichLocalStamp(e.startsAt)}`);
    lines.push(`DTEND;TZID=${APP_TZ}:${zurichLocalStamp(end)}`);
  }
  lines.push(`SEQUENCE:${sequenceOf(e.updatedAt)}`);
  lines.push(`SUMMARY:${icsEscape(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  const desc = [e.description?.trim(), e.url ? `Details: ${plain(e.url)}` : null].filter(Boolean).join("\n\n");
  if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  if (e.url) lines.push(`URL:${plain(e.url)}`);
  if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(icsEscape).join(",")}`);
  lines.push(`STATUS:${e.status ?? "CONFIRMED"}`);
  if (e.created) lines.push(`CREATED:${utcStamp(e.created)}`);
  lines.push(`LAST-MODIFIED:${utcStamp(e.updatedAt)}`);
  lines.push(`TRANSP:${e.status === "CANCELLED" ? "TRANSPARENT" : "OPAQUE"}`, "END:VEVENT");
  return lines;
}

/** Ganzer Kalender als Text (CRLF, gefaltet). Termine ohne Uhrzeit brauchen keine Zeitzone. */
export function buildFeedIcs(cal: FeedCalendar) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Standchef//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(cal.name)}`,
    `X-WR-TIMEZONE:${APP_TZ}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  if (cal.description) lines.push(`X-WR-CALDESC:${icsEscape(cal.description)}`);
  if (cal.events.some((e) => !e.allDay)) lines.push(...VTIMEZONE_ZURICH);
  for (const e of cal.events) lines.push(...feedEventLines(e));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Wie lange abgesagte Termine im Feed bleiben (ab der Absage = letzte Änderung). */
export const CANCELLED_RETENTION_DAYS = 30;

/** Abgesagte Termine nur behalten, wenn die Absage höchstens 30 Tage zurückliegt. */
export function keepInFeed(e: { isCancelled: boolean; updatedAt: Date }, now: Date) {
  if (!e.isCancelled) return true;
  return now.getTime() - e.updatedAt.getTime() <= CANCELLED_RETENTION_DAYS * 86_400_000;
}

/** «?kind=TRAINING,COMPETITION» → bekannte Arten; leer = alle. */
export function parseKindFilter(raw: string | null | undefined, known: readonly string[]): string[] {
  if (!raw) return [];
  const set = new Set(known);
  return [...new Set(raw.split(/[,\s]+/).map((k) => k.trim().toUpperCase()).filter((k) => set.has(k)))];
}
