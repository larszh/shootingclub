/**
 * iCalendar (RFC 5545) – reiner Generator ohne DB.
 * Zeiten mit Uhrzeit werden konsequent in UTC («Z») ausgegeben, ganztägige
 * Termine als VALUE=DATE (Schweizer Kalendertag). Zeilen enden mit CRLF und
 * werden nach 75 Oktetten gefaltet (UTF-8-sicher).
 */
import { addDays, zurichParts } from "@/lib/time";

export type IcsEvent = {
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
  stamp: Date; // DTSTAMP / LAST-MODIFIED (stabil: updatedAt)
  created?: Date | null;
};

export type IcsCalendar = {
  name: string;
  description?: string;
  events: IcsEvent[];
  method?: "PUBLISH";
};

const encoder = new TextEncoder();

/** Escaping für TEXT-Werte (RFC 5545 3.3.11). */
export function icsEscape(v: string) {
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Faltet eine Inhaltszeile auf max. 75 Oktette pro Zeile, ohne UTF-8-Zeichen zu trennen. */
export function foldLine(line: string) {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75; // erste Zeile 75, Folgezeilen 74 + führendes Leerzeichen
  for (const ch of line) {
    const len = encoder.encode(ch).length;
    if (bytes + len > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += ch;
    bytes += len;
  }
  if (current) parts.push(current);
  return parts.join("\r\n ");
}

function utcStamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function dateValue(dateStr: string) {
  return dateStr.replace(/-/g, "");
}

function eventLines(e: IcsEvent): string[] {
  const lines = ["BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${utcStamp(e.stamp)}`];
  if (e.allDay) {
    const startDate = zurichParts(e.startsAt).dateStr;
    const endDate = e.endsAt ? zurichParts(e.endsAt).dateStr : startDate;
    lines.push(`DTSTART;VALUE=DATE:${dateValue(startDate)}`);
    // DTEND ist exklusiv: Tag nach dem letzten Tag
    lines.push(`DTEND;VALUE=DATE:${dateValue(addDays(endDate < startDate ? startDate : endDate, 1))}`);
  } else {
    lines.push(`DTSTART:${utcStamp(e.startsAt)}`);
    const end = e.endsAt && e.endsAt.getTime() > e.startsAt.getTime() ? e.endsAt : new Date(e.startsAt.getTime() + 3_600_000);
    lines.push(`DTEND:${utcStamp(end)}`);
  }
  lines.push(`SUMMARY:${icsEscape(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  const desc = [e.description?.trim(), e.url ? `Details und Anmeldung: ${e.url}` : null].filter(Boolean).join("\n\n");
  if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  if (e.url) lines.push(`URL:${e.url.replace(/[\r\n]/g, "")}`);
  if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(icsEscape).join(",")}`);
  lines.push(`STATUS:${e.status ?? "CONFIRMED"}`);
  if (e.created) lines.push(`CREATED:${utcStamp(e.created)}`);
  lines.push(`LAST-MODIFIED:${utcStamp(e.stamp)}`);
  lines.push("TRANSP:OPAQUE", "END:VEVENT");
  return lines;
}

export function buildIcs(cal: IcsCalendar) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Standchef//Anlaesse//DE",
    "CALSCALE:GREGORIAN",
    `METHOD:${cal.method ?? "PUBLISH"}`,
    `X-WR-CALNAME:${icsEscape(cal.name)}`,
    "X-WR-TIMEZONE:Europe/Zurich",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  if (cal.description) lines.push(`X-WR-CALDESC:${icsEscape(cal.description)}`);
  for (const e of cal.events) lines.push(...eventLines(e));
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function icsHeaders(filename: string, download: boolean) {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
    "Cache-Control": "private, max-age=900",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
  };
}

export function eventUid(id: string) {
  return `event-${id}@standchef.ch`;
}

export function bookingUid(id: string) {
  return `booking-${id}@standchef.ch`;
}
