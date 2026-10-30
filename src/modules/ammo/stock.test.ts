import { describe, expect, it } from "vitest";
import { applyStock, inventoryDelta, parseSummaryYear, signedUnits, yearSummary } from "./stock";

describe("Bestandsrechnung", () => {
  it("Vorzeichen je Art", () => {
    expect(signedUnits("RECEIPT", 5)).toBe(5);
    expect(signedUnits("ISSUE", 5)).toBe(-5);
    expect(signedUnits("SALE", -5)).toBe(-5);
    expect(signedUnits("RETURN", 2)).toBe(2);
    expect(signedUnits("CORRECTION", 3, -1)).toBe(-3);
    expect(signedUnits("INVENTORY", 3)).toBe(3);
  });
  it("nie unter null", () => {
    expect(applyStock(10, -4)).toEqual({ ok: true, next: 6 });
    expect(applyStock(10, -10)).toEqual({ ok: true, next: 0 });
    expect(applyStock(3, -4).ok).toBe(false);
    expect(applyStock(null, 5)).toEqual({ ok: true, next: 5 });
    expect(applyStock(null, -1).ok).toBe(false);
    expect(applyStock(1, 0.5).ok).toBe(false);
  });
  it("Inventurdifferenz", () => {
    expect(inventoryDelta(40, 37)).toBe(-3);
    expect(inventoryDelta(null, 12)).toBe(12);
    expect(inventoryDelta(5, 5)).toBe(0);
  });
});

describe("Jahresübersicht", () => {
  const products = [
    { id: "a", name: "GP 11", caliber: "7.5", unitLabel: "Schachtel", roundsPerUnit: 60, fundingType: "FEDERAL_FREE", stockUnits: 30 },
    { id: "b", name: "GP 90", caliber: "5.6", unitLabel: "Packung", roundsPerUnit: 20, fundingType: "SUBSIDIZED", stockUnits: 100 },
    { id: "c", name: ".22", caliber: ".22", unitLabel: "Schachtel", roundsPerUnit: 50, fundingType: "UNKNOWN", stockUnits: null },
  ];
  const inYear = [
    { productId: "a", kind: "RECEIPT", units: 50 },
    { productId: "a", kind: "ISSUE", units: -25 },
    { productId: "a", kind: "RETURN", units: 2 },
    { productId: "a", kind: "INVENTORY", units: -1 },
    { productId: "b", kind: "SALE", units: -10 },
    { productId: "x", kind: "SALE", units: -10 },
  ];
  const afterYear = [{ productId: "a", kind: "RECEIPT", units: 10 }];
  const res = yearSummary(products, inYear, afterYear);

  it("rechnet Anfangs- und Endbestand zurück", () => {
    const fed = res.find((r) => r.fundingType === "FEDERAL_FREE")!;
    expect(fed.products[0]).toMatchObject({ receipt: 50, issue: 25, returned: 2, adjust: -1, closing: 20, opening: -6 });
    expect(fed.rounds.receipt).toBe(3000);
    expect(fed.rounds.closing).toBe(1200);
  });
  it("gruppiert nach Finanzierung, Unbekanntes als kommerziell", () => {
    expect(res.map((r) => r.fundingType)).toEqual(["FEDERAL_FREE", "SUBSIDIZED", "COMMERCIAL"]);
    const sub = res.find((r) => r.fundingType === "SUBSIDIZED")!;
    expect(sub.units).toMatchObject({ sale: 10, closing: 100, opening: 110 });
    const com = res.find((r) => r.fundingType === "COMMERCIAL")!;
    expect(com.products[0]).toMatchObject({ tracked: false, closing: 0, opening: 0 });
  });
});

describe("Jahr aus URL", () => {
  it("nur gültige Jahre", () => {
    expect(parseSummaryYear("2025", 2026)).toBe(2025);
    expect(parseSummaryYear("2027", 2026)).toBe(2026);
    expect(parseSummaryYear("abc", 2026)).toBe(2026);
    expect(parseSummaryYear(null, 2026)).toBe(2026);
  });
});
