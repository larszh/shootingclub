import { zurichParts, zurichToUtc } from "@/lib/time";

/** Beginn des laufenden Kalendermonats in Schweizer Zeit (als UTC-Date) – für Monatslimiten. */
export function startOfMonthZurich(at: Date = new Date()): Date {
  const [y, m] = zurichParts(at).dateStr.split("-");
  return zurichToUtc(`${y}-${m}-01`, "00:00");
}
