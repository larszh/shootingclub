import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { formatDateTime } from "@/lib/i18n/core";
import { zurichParts } from "@/lib/time";
import { reminderDay, reminderDue, REMINDER_LEAD_HOURS, REMINDER_HOURS } from "./reminder-logic";

const HOUR = 3_600_000;

/**
 * Erinnerung 24 Stunden vor einer bestätigten Reservation (Push + E-Mail gemäss Einstellungen,
 * Thema «bookings», Sprache des Mitglieds). Stündlich aufrufen (Job-Registry, Erinnerungs-Hooks).
 *
 * Idempotent: Booking.reminderSentAt wird vor dem Versand bedingt gesetzt (nur wer die Zeile von
 * null auf jetzt setzt, verschickt), zusätzlich dedupeKey pro Buchung. Nachts (22–7 Uhr) wird nichts
 * verschickt; fällige Erinnerungen folgen um 7 Uhr. Kurzfristige Buchungen (weniger als 6 Stunden
 * vor Beginn erfasst) erhalten keine Erinnerung, werden aber als erledigt markiert.
 */
export async function bookingReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
  const result = { sent: 0, skipped: 0 };
  const hour = Number(zurichParts(now).timeStr.slice(0, 2));
  if (hour < REMINDER_HOURS.from || hour > REMINDER_HOURS.to) return result;

  const due = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      userId: { not: null },
      startsAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_HOURS * HOUR) },
      tenant: { deletedAt: null },
    },
    select: {
      id: true, tenantId: true, viaTenantId: true, userId: true, startsAt: true, endsAt: true, createdAt: true, confirmedAt: true, seriesId: true,
      resource: { select: { name: true } }, tenant: { select: { name: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 500,
  });

  for (const b of due) {
    // Zuerst markieren: parallele Läufe (oder ein Neustart mitten im Versand) verschicken nichts doppelt.
    const claimed = await db.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count === 0) continue;
    if (!b.userId || !reminderDue(b, now)) {
      result.skipped += 1;
      continue;
    }
    const resource = b.viaTenantId ? `${b.resource.name} (${b.tenant.name})` : b.resource.name;
    const date = formatDateTime(b.startsAt, "de");
    const today = reminderDay(b.startsAt, now) === "today";
    await notify({
      tenantId: b.viaTenantId ?? b.tenantId,
      userIds: [b.userId],
      topic: "bookings",
      title: today ? "Erinnerung: Reservation heute" : "Erinnerung: Reservation morgen",
      body: `«${resource}» am ${date}.`,
      url: `/bookings/${b.id}`,
      tag: `booking:${b.id}`,
      i18n: {
        title: today ? "bookings.notify.reminder.titleToday" : "bookings.notify.reminder.title",
        body: "bookings.notify.reminder.body",
        emailBody: "bookings.notify.reminder.email",
        vars: { resource, date },
        localeVars: (locale) => ({ date: formatDateTime(b.startsAt, locale) }),
      },
      dedupeKey: `booking-reminder:${b.id}`,
    });
    result.sent += 1;
  }
  return result;
}
