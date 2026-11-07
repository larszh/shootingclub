/**
 * Übersetzte Anzeigetexte des Munitionsverkaufs (Mitgliederseite /ammo). Ohne Server-Abhängigkeiten:
 * Server-Seiten und Client-Komponenten rufen die Helfer mit `getT(locale)` auf.
 * Wörterbuch: src/lib/i18n/extra/money.ts (Namensraum «money.ammo.»).
 */
import { INTL_LOCALE, normalizeLocale, type TFunction } from "@/lib/i18n/core";

/** Wie formatRounds() in ./types, in der Sprache der Person («1'000 Schuss», «1 000 cartouches»). */
export function formatRoundsT(n: number, locale: string | null | undefined, t: TFunction) {
  const num = new Intl.NumberFormat(INTL_LOCALE[normalizeLocale(locale)]).format(n);
  return t(n === 1 ? "money.ammo.rounds.one" : "money.ammo.rounds.other", { n: num });
}

/** Status einer Bestellung aus Sicht des Mitglieds (ORDER_STATUS[...].memberLabel). */
export function orderStatusLabelT(status: string, t: TFunction) {
  return ["ORDERED", "APPROVED", "ISSUED", "CANCELLED"].includes(status) ? t(`money.ammo.status.${status}`) : status;
}

/** Zahlungsstatus einer Munitionsrechnung (PAYMENT_STATUS[...].label). */
export function paymentStatusLabelT(status: string, t: TFunction) {
  return ["UNPAID", "PAID", "CANCELLED"].includes(status) ? t(`money.ammo.pay.${status}`) : status;
}
