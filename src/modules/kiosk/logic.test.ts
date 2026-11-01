import { describe, expect, it } from "vitest";
import {
  canUndo, cartTotal, cashByDay, groupByCategory, groupForBilling, invoiceCategoryName, invoiceYear, isBatchId, isDayKey, lineClientId, normalizeCart,
  periodDays, periodLabel, periodPresets, periodToUtcRange, resolvePeriod, sumCents, validatePeriod,
} from "./logic";

describe("Zeiträume", () => {
  it("prüft Tagesschlüssel", () => {
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-2-1")).toBe(false);
    expect(isDayKey(undefined)).toBe(false);
  });

  it("validiert Zeitraum", () => {
    expect(validatePeriod({ from: "2026-10-01", to: "2026-10-31" })).toBeNull();
    expect(validatePeriod({ from: "2026-10-31", to: "2026-10-01" })).toMatch(/Startdatum/);
    expect(validatePeriod({ from: "2024-01-01", to: "2026-01-01" })).toMatch(/zu lang/);
    expect(validatePeriod({ from: "x", to: "2026-01-01" })).toMatch(/gültigen/);
  });

  it("zählt Tage inklusive", () => {
    expect(periodDays({ from: "2026-10-01", to: "2026-10-31" })).toBe(31);
    expect(periodDays({ from: "2026-10-05", to: "2026-10-05" })).toBe(1);
  });

  it("Bezeichnungen", () => {
    expect(periodLabel({ from: "2026-10-01", to: "2026-10-31" })).toBe("Oktober 2026");
    expect(periodLabel({ from: "2026-02-01", to: "2026-02-28" })).toBe("Februar 2026");
    expect(periodLabel({ from: "2026-07-01", to: "2026-09-30" })).toBe("Juli–September 2026");
    expect(periodLabel({ from: "2026-01-01", to: "2026-12-31" })).toBe("2026");
    expect(periodLabel({ from: "2025-12-01", to: "2026-01-31" })).toBe("Dezember 2025–Januar 2026");
    expect(periodLabel({ from: "2026-09-01", to: "2026-10-15" })).toBe("01.09.–15.10.2026");
    expect(periodLabel({ from: "2025-12-15", to: "2026-01-15" })).toBe("15.12.2025–15.01.2026");
    expect(periodLabel({ from: "2026-10-05", to: "2026-10-05" })).toBe("05.10.2026");
    expect(invoiceCategoryName({ from: "2026-10-01", to: "2026-10-31" })).toBe("Schützenstube Oktober 2026");
    expect(invoiceYear({ from: "2025-12-01", to: "2026-01-31" })).toBe(2026);
  });

  it("UTC-Grenzen in Schweizer Zeit (Sommer- und Winterzeit)", () => {
    const r = periodToUtcRange({ from: "2026-10-01", to: "2026-10-31" });
    expect(r.start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });

  it("Vorschläge ab heute", () => {
    const p = periodPresets("2026-01-15");
    const by = Object.fromEntries(p.map((x) => [x.key, x]));
    expect(by["last-month"]).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(by["this-month"]).toMatchObject({ from: "2026-01-01", to: "2026-01-15" });
    expect(by["last-quarter"]).toMatchObject({ from: "2025-10-01", to: "2025-12-31" });
    expect(by["this-year"]).toMatchObject({ from: "2026-01-01", to: "2026-01-15" });
    expect(by["last-year"]).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
    const q = Object.fromEntries(periodPresets("2026-11-01").map((x) => [x.key, x]));
    expect(q["last-quarter"]).toMatchObject({ from: "2026-07-01", to: "2026-09-30" });
    expect(q["last-month"]).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
  });

  it("löst Suchparameter auf", () => {
    expect(resolvePeriod({}, "2026-11-01")).toMatchObject({ key: "last-month", from: "2026-10-01" });
    expect(resolvePeriod({ preset: "last-year" }, "2026-11-01")).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
    expect(resolvePeriod({ from: "2026-09-01", to: "2026-09-15" }, "2026-11-01")).toMatchObject({ key: "custom" });
    expect(resolvePeriod({ from: "2026-10-01", to: "2026-10-31" }, "2026-11-01").key).toBe("last-month");
    expect(resolvePeriod({ from: "2026-10-31", to: "2026-10-01" }, "2026-11-01").key).toBe("last-month");
  });
});

describe("Beträge", () => {
  const products = [{ id: "a", name: "Bier", priceCents: 450 }, { id: "b", name: "Wurst", priceCents: 600 }];

  it("Warenkorb normalisieren und summieren", () => {
    const lines = normalizeCart([{ productId: "a", quantity: 2 }, { productId: "b", quantity: 0 }, { productId: "a", quantity: 1 }, { productId: "b", quantity: 1.7 }]);
    expect(lines).toEqual([{ productId: "a", quantity: 3 }, { productId: "b", quantity: 1 }]);
    expect(cartTotal(lines, products)).toBe(3 * 450 + 600);
    expect(cartTotal([{ productId: "x", quantity: 3 }], products)).toBe(0);
    expect(normalizeCart([{ productId: "a", quantity: 500 }])[0]!.quantity).toBe(99);
  });

  it("gruppiert nur unverrechnete Mitglieder-Einträge", () => {
    const d = (s: string) => new Date(s);
    const g = groupForBilling([
      { id: "1", userId: "u2", totalCents: 450, paidCash: false, billedInvoiceId: null, createdAt: d("2026-10-03T10:00:00Z") },
      { id: "2", userId: "u1", totalCents: 600, paidCash: false, billedInvoiceId: null, createdAt: d("2026-10-02T10:00:00Z") },
      { id: "3", userId: "u2", totalCents: 900, paidCash: false, billedInvoiceId: null, createdAt: d("2026-10-01T10:00:00Z") },
      { id: "4", userId: "u2", totalCents: 450, paidCash: true, billedInvoiceId: null },
      { id: "5", userId: "u1", totalCents: 450, paidCash: false, billedInvoiceId: "inv" },
      { id: "6", userId: null, totalCents: 450, paidCash: false, billedInvoiceId: null },
      { id: "7", userId: "u3", totalCents: 0, paidCash: false, billedInvoiceId: null },
    ]);
    expect(g.map((x) => x.userId)).toEqual(["u1", "u2"]);
    expect(g[1]).toMatchObject({ entryIds: ["1", "3"], count: 2, totalCents: 1350 });
    expect(g[1]!.firstAt!.toISOString()).toBe("2026-10-01T10:00:00.000Z");
    expect(g[1]!.lastAt!.toISOString()).toBe("2026-10-03T10:00:00.000Z");
    expect(sumCents(g)).toBe(1950);
  });

  it("Barverkäufe pro Tag in Schweizer Zeit", () => {
    const days = cashByDay([
      { createdAt: new Date("2026-10-03T22:30:00Z"), totalCents: 450, quantity: 1, productName: "Bier" }, // 04.10. in Zürich
      { createdAt: new Date("2026-10-03T12:00:00Z"), totalCents: 900, quantity: 2, productName: "Bier" },
      { createdAt: new Date("2026-10-03T13:00:00Z"), totalCents: 600, quantity: 1, productName: "Wurst" },
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-10-04", "2026-10-03"]);
    expect(days[1]).toMatchObject({ count: 2, totalCents: 1500 });
    expect(days[1]!.products).toEqual([{ name: "Bier", quantity: 2, totalCents: 900 }, { name: "Wurst", quantity: 1, totalCents: 600 }]);
  });

  it("Kategorien mit «Weitere» am Schluss", () => {
    const g = groupByCategory([
      { name: "Chips", category: null, sortOrder: 0 },
      { name: "Wasser", category: "Getränke", sortOrder: 2 },
      { name: "Bier", category: "Getränke", sortOrder: 1 },
      { name: "Wurst", category: "Essen", sortOrder: 0 },
    ]);
    // Kategorien in der Reihenfolge ihres ersten Produkts (sortOrder)
    expect(g.map((x) => x.category)).toEqual(["Essen", "Getränke", "Weitere"]);
    expect(g[1]!.items.map((x) => x.name)).toEqual(["Bier", "Wasser"]);
  });
});

describe("Erfassung", () => {
  it("Rückgängig innerhalb von 2 Minuten", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(canUndo(new Date("2026-10-01T09:58:30Z"), now)).toBe(true);
    expect(canUndo(new Date("2026-10-01T09:57:59Z"), now)).toBe(false);
  });

  it("clientIds", () => {
    expect(isBatchId("abcDEF12-3456-x")).toBe(true);
    expect(isBatchId("________")).toBe(false);
    expect(isBatchId("abc%def12")).toBe(false);
    expect(isBatchId("short")).toBe(false);
    expect(isBatchId("bad id with spaces")).toBe(false);
    expect(lineClientId("abcdefgh", 2)).toBe("abcdefgh:2");
  });
});
