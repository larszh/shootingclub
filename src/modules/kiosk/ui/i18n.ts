/**
 * Sprachhilfen der Schützenstube-Verwaltung (ohne Server-Abhängigkeiten, auch im Client nutzbar):
 * Monatsnamen in der Anzeigesprache und übersetzte Zeitraum-Vorschläge.
 */
import { INTL_LOCALE, normalizeLocale, type TFunction } from "@/lib/i18n/core";
import { periodLabel, type Period, type PeriodPreset } from "@/modules/kiosk/logic";

/** Zwölf Monatsnamen («Januar» … / «janvier» …) für die Sprache. */
export function monthNames(locale: string | null | undefined): string[] {
  const fmt = new Intl.DateTimeFormat(INTL_LOCALE[normalizeLocale(locale)], { timeZone: "UTC", month: "long" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 15, 12))));
}

/** Bezeichnung eines Zeitraums in der Anzeigesprache. */
export function periodText(p: Period, locale: string | null | undefined): string {
  return periodLabel(p, monthNames(locale));
}

/** Vorschläge mit übersetzter Beschriftung (Schlüssel adm1.kiosk.preset.<key>). */
export function localizePresets<T extends PeriodPreset>(t: TFunction, presets: T[]): T[] {
  return presets.map((p) => ({ ...p, label: t(`adm1.kiosk.preset.${p.key}`) }));
}
