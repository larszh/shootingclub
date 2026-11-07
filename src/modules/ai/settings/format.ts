/** Zahlenformate für die KI-Einstellungen (client-sicher). */
import { formatNumberL } from "@/lib/i18n/core";

export function fmtInt(n: number, locale: string | null | undefined): string {
  return formatNumberL(Math.round(n), locale, { maximumFractionDigits: 0 });
}

export function fmtChf(n: number, locale: string | null | undefined): string {
  return formatNumberL(n, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
