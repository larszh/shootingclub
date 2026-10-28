import { addDays, todayZurich, zurichParts } from "@/lib/time";

/**
 * Ziel für «Wiederholen»: gleiche Uhrzeit eine Woche später. Liegt das in der Vergangenheit,
 * der nächste gleiche Wochentag ab heute.
 */
export function repeatTarget(startsAt: Date) {
  const { dateStr, timeStr } = zurichParts(startsAt);
  const today = todayZurich();
  let date = addDays(dateStr, 7);
  while (date < today) date = addDays(date, 7);
  return { date, time: timeStr };
}
