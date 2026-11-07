/**
 * Übersetzte Bezeichnungen der Munitionsverwaltung (Admin). Ohne Server-Abhängigkeiten:
 * Server-Seiten und Client-Komponenten rufen die Helfer mit ihrer `t`-Funktion auf.
 * Wörterbuch: src/lib/i18n/extra/admin1/ammo.ts (Namensraum «adm1.ammo.»).
 */
import { formatNumberL, type TFunction } from "@/lib/i18n/core";
import { FUNDING_TYPES, STOCK_KINDS } from "@/modules/ammo/stock";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/modules/ammo/types";

const has = (list: readonly string[], v: string) => list.includes(v);

/** Bestellstatus aus Sicht der Verwaltung (ORDER_STATUS[...].label). */
export function adminOrderStatusT(status: string, t: TFunction) {
  return has(ORDER_STATUSES, status) ? t(`adm1.ammo.status.${status}`) : status;
}

/** Zahlungsstatus einer Munitionsrechnung. */
export function adminPaymentStatusT(status: string, t: TFunction) {
  return has(PAYMENT_STATUSES, status) ? t(`adm1.ammo.pay.${status}`) : status;
}

/** Art einer Bestandsbewegung (lang, z.B. «Wareneingang»). */
export function stockKindLabelT(kind: string, t: TFunction) {
  return has(STOCK_KINDS, kind) ? t(`adm1.ammo.kind.${kind}`) : kind;
}

/** Art einer Bestandsbewegung (kurz, z.B. «Eingang»). */
export function stockKindShortT(kind: string, t: TFunction) {
  return has(STOCK_KINDS, kind) ? t(`adm1.ammo.kindShort.${kind}`) : kind;
}

/** Finanzierungsart (lang, z.B. «Bund (gratis)»); Unbekanntes gilt als kommerziell. */
export function fundingLabelT(f: string, t: TFunction) {
  return t(`adm1.ammo.funding.${has(FUNDING_TYPES, f) ? f : "COMMERCIAL"}`);
}

/** Finanzierungsart (kurz, z.B. «Bund gratis»). */
export function fundingShortT(f: string, t: TFunction) {
  return t(`adm1.ammo.fundingShort.${has(FUNDING_TYPES, f) ? f : "COMMERCIAL"}`);
}

/** Schuss-Anzahl in der Sprache der Person («1'000 Schuss», «1 000 cartouches»). */
export function roundsT(n: number, locale: string | null | undefined, t: TFunction) {
  const num = formatNumberL(n, locale);
  return t(n === 1 || n === -1 ? "money.ammo.rounds.one" : "money.ammo.rounds.other", { n: num });
}

/** Ganze Zahl in der Sprache der Person. */
export function numT(n: number, locale: string | null | undefined) {
  return formatNumberL(n, locale);
}
