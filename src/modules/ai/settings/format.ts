/** Zahlenformate für die KI-Einstellungen (client-sicher). */
import { INTL_LOCALE, normalizeLocale } from "@/lib/i18n/core";

export function fmtInt(n: number, locale: string | null | undefined): string {
  return new Intl.NumberFormat(INTL_LOCALE[normalizeLocale(locale)], { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function fmtChf(n: number, locale: string | null | undefined): string {
  return new Intl.NumberFormat(INTL_LOCALE[normalizeLocale(locale)], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
