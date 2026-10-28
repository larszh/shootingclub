/** Kleine Zeit-Helfer ausserhalb von Komponenten (reine Funktionen dürfen hier «jetzt» lesen). */
import { addDays, todayZurich, zurichParts, zurichToUtc } from "@/lib/time";

export function nowDate() {
  return new Date();
}

export function addDaysFromNow(days: number) {
  return new Date(Date.now() + days * 86_400_000);
}

/**
 * Fälligkeit in `days` Tagen: Ende des Kalendertags in Schweizer Zeit (23:59:59.999), damit
 * «zahlbar bis 27.11.» den ganzen 27.11. umfasst.
 */
export function dueDateInDays(days: number) {
  return new Date(zurichToUtc(addDays(todayZurich(), days + 1), "00:00").getTime() - 1);
}

/** Überfällig erst ab dem Tag nach dem Fälligkeitsdatum (Kalendertag in Schweizer Zeit). */
export function isOverdue(dueAt: Date, now: Date = new Date()) {
  return zurichParts(dueAt).dateStr < zurichParts(now).dateStr;
}
