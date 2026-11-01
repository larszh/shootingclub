import { addDays, todayZurich, zurichToUtc } from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Zeitraum aus ?from&to (Schweizer Kalendertage, beide inklusive). Standard: laufender Monat.
 * Liefert null bei ungültigem oder zu langem Zeitraum (max. 3 Jahre).
 */
export function parsePeriod(qFrom: string | null | undefined, qTo: string | null | undefined) {
  const today = todayZurich();
  const monthStart = `${today.slice(0, 7)}-01`;
  const fromStr = qFrom && DATE_RE.test(qFrom) ? qFrom : monthStart;
  const toStr = qTo && DATE_RE.test(qTo) ? qTo : addDays(`${addDays(monthStart, 32).slice(0, 7)}-01`, -1);
  if (toStr < fromStr) return null;
  const from = zurichToUtc(fromStr, "00:00");
  const to = zurichToUtc(addDays(toStr, 1), "00:00");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  if (to.getTime() - from.getTime() > 3 * 366 * 86_400_000) return null;
  return { fromStr, toStr, from, to };
}
