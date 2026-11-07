import { formatDate, formatDateTime } from "@/lib/i18n/core";

/**
 * Buchungsdatum einer Bestandsbewegung in der Sprache der Person (wie formatMovementDate):
 * «jetzt» gebuchte Bewegungen mit Uhrzeit, rückdatierte nur mit Kalendertag.
 */
export function movementDateT(date: Date, createdAt: Date, locale: string | null | undefined) {
  return Math.abs(date.getTime() - createdAt.getTime()) < 5 * 60_000 ? formatDateTime(date, locale) : formatDate(date, locale);
}
