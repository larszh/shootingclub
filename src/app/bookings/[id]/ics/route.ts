import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/tenant";
import { slugify } from "@/lib/utils";
import { formatDuration, BOOKING_STATUS } from "@/modules/bookings/types";

export const dynamic = "force-dynamic";

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Zeilen nach RFC 5545 auf 75 Oktette falten. */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, "utf8");
    if (size + len > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Einzelne Reservation als .ics-Datei (für Besitzer und Verwaltung). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  const ctx = await getAppContext();
  if (!ctx.tenant || !ctx.hasModule("bookings")) return new NextResponse("Nicht gefunden", { status: 404 });
  const { id } = await params;
  const b = await db.booking.findUnique({ where: { id }, include: { resource: { select: { name: true } }, tenant: { select: { name: true, city: true } }, user: { select: { name: true } } } });
  if (!b || b.tenantId !== ctx.tenant.id || (b.userId !== user.id && !ctx.can("tenant.manage"))) return new NextResponse("Nicht gefunden", { status: 404 });

  const appUrl = (process.env.APP_URL ?? "https://standchef.ch").replace(/\/$/, "");
  const cancelled = b.status === "CANCELLED" || b.status === "REJECTED";
  const description = [
    `${b.resource.name} · ${formatDuration(b.durationMinutes)}`,
    b.user && b.userId !== user.id ? `Gebucht für ${b.user.name}` : null,
    `Status: ${BOOKING_STATUS[b.status]?.label ?? b.status}`,
    b.note ? `Bemerkung: ${b.note}` : null,
    `${appUrl}/bookings/${b.id}`,
  ].filter(Boolean).join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Standchef//Reservationen//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:booking-${b.id}@standchef.ch`,
    `DTSTAMP:${icsDate(b.updatedAt)}`,
    `LAST-MODIFIED:${icsDate(b.updatedAt)}`,
    `DTSTART:${icsDate(b.startsAt)}`,
    `DTEND:${icsDate(b.endsAt)}`,
    `SUMMARY:${icsText(`${cancelled ? "Abgesagt: " : ""}${b.resource.name} (${b.tenant.name})`)}`,
    `LOCATION:${icsText([b.resource.name, b.tenant.name, b.tenant.city].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${appUrl}/bookings/${b.id}`,
    `STATUS:${cancelled ? "CANCELLED" : b.status === "PENDING" ? "TENTATIVE" : "CONFIRMED"}`,
    ...(cancelled ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(b.resource.name)}`, "TRIGGER:-PT1H", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const body = lines.map(fold).join("\r\n") + "\r\n";
  const filename = `reservation-${slugify(b.resource.name) || "termin"}-${b.startsAt.toISOString().slice(0, 10)}.ics`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
