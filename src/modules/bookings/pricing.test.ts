import { describe, expect, it } from "vitest";
import { basePriceFor, bookingUnits, formatShortMoney, maxPersonsFor, personsSuffix, planRequest, priceTablePreview, quotePrice } from "./pricing";
import type { DurationOption } from "./types";

const now = new Date("2026-06-01T10:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);
const noDiscount = { lastMinuteDiscountPercent: 0, lastMinuteWindowHours: 24 };

const option: DurationOption = { minutes: 60, priceCents: 1000, personPrices: [1500, 2500, null], flatFromPersons: 5, flatPriceCents: 4000 };

describe("basePriceFor", () => {
  it("ohne Personenpreise gilt der Preis pro Buchung", () => {
    expect(basePriceFor(option, 4, false)).toEqual({ baseCents: 1000, isFlatRate: false, perPersonCents: null });
  });

  it("nutzt feste Preise je Gruppengrösse", () => {
    expect(basePriceFor(option, 1, true).baseCents).toBe(1500);
    expect(basePriceFor(option, 2, true).baseCents).toBe(2500);
  });

  it("fällt auf Preis × Personen zurück (null oder fehlend)", () => {
    expect(basePriceFor(option, 3, true)).toEqual({ baseCents: 3000, isFlatRate: false, perPersonCents: 1000 });
    expect(basePriceFor(option, 4, true)).toEqual({ baseCents: 4000, isFlatRate: false, perPersonCents: 1000 });
  });

  it("wechselt ab flatFromPersons auf den Pauschalpreis", () => {
    expect(basePriceFor(option, 5, true)).toEqual({ baseCents: 4000, isFlatRate: true, perPersonCents: null });
    expect(basePriceFor(option, 12, true).baseCents).toBe(4000);
  });

  it("rundet ungültige Personenzahlen auf mindestens 1", () => {
    expect(basePriceFor(option, 0, true).baseCents).toBe(1500);
    expect(basePriceFor(option, 2.7, true).baseCents).toBe(2500);
  });
});

describe("quotePrice", () => {
  it("ohne Rabatt", () => {
    const q = quotePrice(option, inHours(72), noDiscount, 1, now);
    expect(q).toMatchObject({ basePriceCents: 1000, discountCents: 0, discountReason: null, totalCents: 1000, persons: 1, isFlatRate: false, unitLabel: null, detail: null });
  });

  it("mit Personenpreisen und Rechenweg", () => {
    const q = quotePrice(option, inHours(72), { ...noDiscount, personPricing: true }, 3, now);
    expect(q.totalCents).toBe(3000);
    expect(q.unitLabel).toBe("3 Personen");
    expect(q.detail).toBe("3 × 10.–");
  });

  it("Pauschale ab 5 Personen", () => {
    const q = quotePrice(option, inHours(72), { ...noDiscount, personPricing: true }, 6, now);
    expect(q.isFlatRate).toBe(true);
    expect(q.totalCents).toBe(4000);
    expect(q.unitLabel).toBe("Pauschal ab 5 Personen");
    expect(q.detail).toBeNull();
  });

  it("Spontan-Rabatt nur im Zeitfenster und nur für kommende Termine", () => {
    const settings = { lastMinuteDiscountPercent: 20, lastMinuteWindowHours: 24, personPricing: true };
    const soon = quotePrice(option, inHours(3), settings, 2, now);
    expect(soon.discountCents).toBe(500);
    expect(soon.totalCents).toBe(2000);
    expect(soon.discountReason).toBe("Spontan-Rabatt 20%");
    expect(quotePrice(option, inHours(24), settings, 2, now).discountCents).toBe(500);
    expect(quotePrice(option, inHours(25), settings, 2, now).discountCents).toBe(0);
    expect(quotePrice(option, inHours(-1), settings, 2, now).discountCents).toBe(0);
  });

  it("rundet Rabatte auf Rappen und gibt nie einen negativen Betrag", () => {
    const q = quotePrice({ minutes: 30, priceCents: 999 }, inHours(1), { lastMinuteDiscountPercent: 33, lastMinuteWindowHours: 2 }, 1, now);
    expect(q.discountCents).toBe(330);
    expect(q.totalCents).toBe(669);
    const all = quotePrice({ minutes: 30, priceCents: 999 }, inHours(1), { lastMinuteDiscountPercent: 100, lastMinuteWindowHours: 2 }, 1, now);
    expect(all.totalCents).toBe(0);
  });

  it("gratis bleibt gratis (kein Rabatttext)", () => {
    const q = quotePrice({ minutes: 30, priceCents: 0 }, inHours(1), { lastMinuteDiscountPercent: 50, lastMinuteWindowHours: 2 }, 1, now);
    expect(q.totalCents).toBe(0);
    expect(q.discountReason).toBeNull();
  });
});

describe("Hilfsfunktionen", () => {
  it("formatShortMoney", () => {
    expect(formatShortMoney(1500)).toBe("15.–");
    expect(formatShortMoney(1550)).toBe("15.50");
    expect(formatShortMoney(5)).toBe("0.05");
  });

  it("priceTablePreview", () => {
    expect(priceTablePreview({ minutes: 60, priceCents: 1500 }, 4, false)).toBe("15.– pro Buchung");
    expect(priceTablePreview({ minutes: 60, priceCents: 0 }, 4, false)).toBe("gratis");
    expect(priceTablePreview(option, 6, true)).toBe("1 Pers. 15.–, 2 Pers. 25.–, 3 Pers. 30.–, 4 Pers. 40.–, ab 5 Pers. 40.– pauschal");
    expect(priceTablePreview(option, 3, true)).toContain("wird bei max. 3 nie erreicht");
  });

  it("personsSuffix", () => {
    expect(personsSuffix({ persons: 1, isFlatRate: false })).toBeNull();
    expect(personsSuffix({ persons: 3, isFlatRate: false })).toBe("3 Personen");
    expect(personsSuffix({ persons: 5, isFlatRate: true })).toBe("Pauschal (5 Personen)");
  });

  it("maxPersonsFor und bookingUnits", () => {
    const s = { maxPersons: 8, flatExclusive: true, capacityPerPerson: true };
    expect(maxPersonsFor({ capacity: 4, maxPersons: null }, s)).toBe(4);
    expect(maxPersonsFor({ capacity: 10, maxPersons: 6 }, s)).toBe(6);
    expect(maxPersonsFor({ capacity: 0, maxPersons: 0 }, { ...s, capacityPerPerson: false })).toBe(1);
    expect(bookingUnits({ persons: 3, isFlatRate: true }, 6, s)).toBe(6);
    expect(bookingUnits({ persons: 3, isFlatRate: false }, 6, s)).toBe(3);
    expect(bookingUnits({ persons: 3, isFlatRate: false }, 6, { flatExclusive: false, capacityPerPerson: false })).toBe(1);
  });

  it("planRequest", () => {
    expect(planRequest(option, { capacity: 6 }, { flatExclusive: true, capacityPerPerson: true, personPricing: true }, 5)).toEqual({ persons: 5, isFlatRate: true, units: 6 });
    expect(planRequest(option, { capacity: 6 }, { flatExclusive: true, capacityPerPerson: true, personPricing: false }, 5)).toEqual({ persons: 5, isFlatRate: false, units: 5 });
  });
});
