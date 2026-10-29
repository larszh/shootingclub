import type { TFunction } from "@/lib/i18n/core";
import type { DurationOption } from "./types";

export type PricingSettings = { lastMinuteDiscountPercent: number; lastMinuteWindowHours: number; personPricing?: boolean };

export type PriceQuote = {
  basePriceCents: number;
  discountCents: number;
  discountReason: string | null;
  totalCents: number;
  /** Anzahl Personen der Anfrage. */
  persons: number;
  /** Pauschalpreis (ab `flatFromPersons`). */
  isFlatRate: boolean;
  /** Kurzbeschrieb für die Anzeige, z.B. «3 Personen» oder «Pauschal ab 4 Personen»; null bei 1 Person ohne Besonderheit. */
  unitLabel: string | null;
  /** Rechenweg, wenn der Rückfallpreis pro Person verwendet wird, z.B. «3 × CHF 10.00». */
  detail: string | null;
};

export type BasePrice = { baseCents: number; isFlatRate: boolean; perPersonCents: number | null };

/**
 * Grundpreis einer Dauer für eine Gruppengrösse.
 * Ohne «Preise pro Person» gilt `priceCents` pro Buchung, unabhängig von der Anzahl Personen.
 * Mit «Preise pro Person» in dieser Reihenfolge:
 *   1. Pauschalpreis, wenn `flatFromPersons` gesetzt ist und erreicht wird,
 *   2. fester Preis für genau diese Gruppengrösse (`personPrices[persons - 1]`),
 *   3. sonst `priceCents × persons` (priceCents = Preis pro Person).
 */
export function basePriceFor(option: DurationOption, persons: number, personPricing: boolean): BasePrice {
  const n = Math.max(1, Math.floor(persons));
  if (!personPricing) return { baseCents: option.priceCents, isFlatRate: false, perPersonCents: null };
  if (option.flatFromPersons && option.flatPriceCents !== undefined && n >= option.flatFromPersons) {
    return { baseCents: option.flatPriceCents, isFlatRate: true, perPersonCents: null };
  }
  const explicit = option.personPrices?.[n - 1];
  if (typeof explicit === "number") return { baseCents: explicit, isFlatRate: false, perPersonCents: null };
  return { baseCents: option.priceCents * n, isFlatRate: false, perPersonCents: n > 1 ? option.priceCents : null };
}

function personWord(n: number) {
  return n === 1 ? "1 Person" : `${n} Personen`;
}

export function quotePrice(option: DurationOption, startsAt: Date, settings: PricingSettings, persons = 1, now = new Date()): PriceQuote {
  const n = Math.max(1, Math.floor(persons));
  const bp = basePriceFor(option, n, !!settings.personPricing);
  const base = bp.baseCents;
  let discount = 0;
  let reason: string | null = null;
  if (base > 0 && settings.lastMinuteDiscountPercent > 0) {
    const hoursAhead = (startsAt.getTime() - now.getTime()) / 3_600_000;
    // Nur für kommende Termine: rückwirkend erfasste Buchungen (Verwaltung) sind nicht «spontan».
    if (hoursAhead >= 0 && hoursAhead <= settings.lastMinuteWindowHours) {
      discount = Math.round((base * settings.lastMinuteDiscountPercent) / 100);
      reason = `Spontan-Rabatt ${settings.lastMinuteDiscountPercent}%`;
    }
  }
  const unitLabel = bp.isFlatRate ? `Pauschal ab ${personWord(option.flatFromPersons ?? n)}` : n > 1 ? personWord(n) : null;
  const detail = bp.perPersonCents !== null ? `${n} × ${formatShortMoney(bp.perPersonCents)}` : null;
  return { basePriceCents: base, discountCents: discount, discountReason: reason, totalCents: Math.max(0, base - discount), persons: n, isFlatRate: bp.isFlatRate, unitLabel, detail };
}

/** Kurzform für Preislisten: 1500 → «15.–», 1550 → «15.50». */
export function formatShortMoney(cents: number) {
  if (cents % 100 === 0) return `${(cents / 100).toLocaleString("de-CH")}.–`;
  return (cents / 100).toFixed(2);
}

/**
 * Vorschau der Preistabelle einer Dauer, z.B. «1 Pers. 15.–, 2 Pers. 25.–, 3 Pers. 33.–, ab 4 Pers. 40.– pauschal».
 */
export function priceTablePreview(option: DurationOption, maxPersons: number, personPricing: boolean) {
  if (!personPricing) return option.priceCents ? `${formatShortMoney(option.priceCents)} pro Buchung` : "gratis";
  const parts: string[] = [];
  const flatFrom = option.flatFromPersons && option.flatPriceCents !== undefined ? option.flatFromPersons : null;
  const last = flatFrom ? Math.min(maxPersons, flatFrom - 1) : maxPersons;
  for (let n = 1; n <= last; n++) parts.push(`${n} Pers. ${formatShortMoney(basePriceFor(option, n, true).baseCents)}`);
  if (flatFrom) {
    parts.push(flatFrom <= maxPersons
      ? `ab ${flatFrom} Pers. ${formatShortMoney(option.flatPriceCents!)} pauschal`
      : `Pauschale ab ${flatFrom} Pers. wird bei max. ${maxPersons} nie erreicht`);
  }
  return parts.join(", ");
}

/**
 * Personen-Zusatz für Rechnung, Kalender und Export: «3 Personen», «Pauschal (5 Personen)»; null bei 1 Person.
 * Mit `t` in der Sprache des Vereins (z.B. für die Rechnung), sonst Deutsch.
 */
export function personsSuffix(b: { persons: number; isFlatRate: boolean }, t?: TFunction) {
  const word = (n: number) => (t ? t(n === 1 ? "invoice.persons.one" : "invoice.persons.many", { count: n }) : personWord(n));
  if (b.isFlatRate) return t ? t("invoice.flatRate", { persons: word(b.persons) }) : `Pauschal (${word(b.persons)})`;
  return b.persons > 1 ? word(b.persons) : null;
}

export type CapacitySettings = { maxPersons: number; flatExclusive: boolean; capacityPerPerson: boolean };

/** Höchstzahl Personen pro Buchung für eine Ressource (mindestens 1). */
export function maxPersonsFor(resource: { capacity: number; maxPersons: number | null }, settings: CapacitySettings) {
  let max = resource.maxPersons ?? settings.maxPersons;
  if (settings.capacityPerPerson) max = Math.min(max, resource.capacity);
  return Math.max(1, max);
}

/**
 * Belegte Kapazitätseinheiten einer Buchung: Pauschal exklusiv = ganze Ressource,
 * sonst eine Einheit pro Person (wenn jede Person einen Platz belegt) oder eine pro Buchung.
 */
export function bookingUnits(b: { persons: number; isFlatRate: boolean }, capacity: number, settings: Pick<CapacitySettings, "flatExclusive" | "capacityPerPerson">) {
  if (b.isFlatRate && settings.flatExclusive) return Math.max(1, capacity);
  return settings.capacityPerPerson ? Math.max(1, b.persons) : 1;
}

/** «den ganzen Raum», «die ganze Anlage» usw. für Hinweise zur Pauschale. */
export function wholeResourceLabel(kind: string) {
  switch (kind) {
    case "ROOM": return "den ganzen Raum";
    case "RANGE": return "die ganze Anlage";
    case "LANE": return "die ganze Bahn";
    default: return "die ganze Ressource";
  }
}

/** Pauschal ja/nein und belegte Einheiten für eine Anfrage (gleiche Regeln wie beim Preis). */
export function planRequest(
  option: DurationOption,
  resource: { capacity: number },
  settings: Pick<CapacitySettings, "flatExclusive" | "capacityPerPerson"> & { personPricing: boolean },
  persons: number,
) {
  const n = Math.max(1, Math.floor(persons));
  const { isFlatRate } = basePriceFor(option, n, settings.personPricing);
  return { persons: n, isFlatRate, units: bookingUnits({ persons: n, isFlatRate }, resource.capacity, settings) };
}
