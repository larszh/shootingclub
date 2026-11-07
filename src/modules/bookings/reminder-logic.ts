/** Regeln für die Erinnerung vor einer Reservation (rein, testbar). */

import { zurichParts } from "@/lib/time";

/** Erinnerung so viele Stunden vor Beginn. */
export const REMINDER_LEAD_HOURS = 24;
/** Mindestabstand zwischen Buchung und Beginn, damit eine Erinnerung sinnvoll ist. */
export const REMINDER_MIN_NOTICE_HOURS = 6;
/** Versand nur zwischen diesen Stunden (Schweizer Zeit, inklusive). */
export const REMINDER_HOURS = { from: 7, to: 21 } as const;

const HOUR = 3_600_000;

/**
 * Soll für diese (bestätigte, noch nicht erinnerte) Buchung jetzt erinnert werden?
 * Beginn in den nächsten 24 Stunden und nicht kurzfristig gebucht bzw. bestätigt.
 */
export function reminderDue(b: { startsAt: Date; createdAt: Date; confirmedAt?: Date | null }, now: Date): boolean {
  const ahead = b.startsAt.getTime() - now.getTime();
  if (ahead <= 0 || ahead > REMINDER_LEAD_HOURS * HOUR) return false;
  const decidedAt = b.confirmedAt && b.confirmedAt > b.createdAt ? b.confirmedAt : b.createdAt;
  return b.startsAt.getTime() - decidedAt.getTime() >= REMINDER_MIN_NOTICE_HOURS * HOUR;
}

/**
 * «heute» oder «morgen» für den Erinnerungstitel, nach Kalendertag in Schweizer Zeit. Erinnerungen
 * gehen auch am Tag selbst raus (kurzfristiger gebucht, oder Beginn nachts/früh morgens – dann
 * wartet die Erinnerung bis 7 Uhr).
 */
export function reminderDay(startsAt: Date, now: Date): "today" | "tomorrow" {
  return zurichParts(startsAt).dateStr === zurichParts(now).dateStr ? "today" : "tomorrow";
}
