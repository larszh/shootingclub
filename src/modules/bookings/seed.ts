/**
 * Demo für Serienbuchungen und Beitritt mit Freigabe (prisma/seed.ts). Bewusst nur relative Imports
 * und kein "server-only", damit tsx das Skript ausserhalb von Next.js ausführen kann.
 *
 * - Serie «Training» jeden Dienstag 18–20 Uhr auf der ersten aktiven Ressource, acht Wochen ab
 *   nächstem Dienstag, angelegt durch userIds[0]. Belegte Termine werden übersprungen.
 * - Eine offene Beitrittsanfrage (Membership PENDING) einer Demo-Person ohne Zugang.
 * Idempotent: bestehende Demo-Serie bzw. -Anfrage wird nicht erneut angelegt.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { addDays, todayZurich } from "../../lib/time";
import { seriesOccurrences, isoWeekday } from "./series";

type Db = Pick<PrismaClient, "resource" | "booking" | "bookingSeries" | "bookingSettings" | "user" | "membership">;

const SERIES_NOTE = "Demo: Training (Serie)";
const PENDING_EMAIL = "anwaerter@demo.standchef.invalid";

export async function seedDemoBookingSeries(db: Db, tenantId: string, userIds: string[]) {
  const result = { series: 0, bookings: 0, joinRequests: 0 };
  const trainerId = userIds[0];
  if (!trainerId) return result;

  const resource = await db.resource.findFirst({ where: { tenantId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const exists = await db.bookingSeries.findFirst({ where: { tenantId, note: SERIES_NOTE }, select: { id: true } });
  if (resource && !exists) {
    const today = todayZurich();
    let from = addDays(today, 1);
    while (isoWeekday(from) !== 2) from = addDays(from, 1);
    const until = addDays(from, 7 * 7);
    const occurrences = seriesOccurrences({ fromDate: from, untilDate: until, weekdays: [2], startTime: "18:00", endTime: "20:00" });
    const settings = await db.bookingSettings.findUnique({ where: { tenantId }, select: { currency: true } });
    const series = await db.bookingSeries.create({
      data: {
        tenantId, resourceId: resource.id, userId: trainerId, weekdays: "2", startTime: "18:00", endTime: "20:00",
        fromDate: new Date(`${from}T00:00:00Z`), untilDate: new Date(`${until}T00:00:00Z`), persons: 1, note: SERIES_NOTE, status: "ACTIVE",
      },
    });
    result.series = 1;
    for (const o of occurrences) {
      const busy = await db.booking.count({ where: { resourceId: resource.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: o.endsAt }, endsAt: { gt: o.startsAt } } });
      if (busy >= resource.capacity) continue;
      await db.booking.create({
        data: {
          tenantId, resourceId: resource.id, userId: trainerId, seriesId: series.id, startsAt: o.startsAt, endsAt: o.endsAt,
          durationMinutes: 120, persons: 1, units: 1, isFlatRate: false, status: "CONFIRMED", paymentMethod: "NONE", paymentStatus: "NOT_REQUIRED",
          basePriceCents: 0, discountCents: 0, totalCents: 0, currency: settings?.currency ?? "CHF", note: SERIES_NOTE, adminNote: "Serie Di 18:00–20:00", confirmedAt: new Date(),
        },
      });
      result.bookings += 1;
    }
  }

  // Offene Beitrittsanfrage: Konto ohne verwendbares Passwort (Anmeldung nur nach «Passwort vergessen» möglich).
  const user = await db.user.upsert({
    where: { email: PENDING_EMAIL },
    update: {},
    create: { email: PENDING_EMAIL, name: "Demo Anwärterin", passwordHash: "!demo-no-login", locale: "de" },
  });
  const m = await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } }, select: { id: true } });
  if (!m) {
    await db.membership.create({ data: { userId: user.id, tenantId, role: "MEMBER", status: "PENDING" } });
    result.joinRequests = 1;
  }
  return result;
}
