import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents } from "./money";

describe("money", () => {
  it("liest Beträge mit Punkt oder Komma", () => {
    expect(parseMoneyToCents("12.50")).toBe(1250);
    expect(parseMoneyToCents("12,5")).toBe(1250);
    expect(parseMoneyToCents("CHF 45.00")).toBe(4500);
    expect(parseMoneyToCents(7)).toBe(700);
    expect(parseMoneyToCents("0.1")).toBe(10);
    expect(parseMoneyToCents("19.99")).toBe(1999);
  });

  it("gibt bei leer oder ungültig 0 zurück", () => {
    expect(parseMoneyToCents("")).toBe(0);
    expect(parseMoneyToCents(null)).toBe(0);
    expect(parseMoneyToCents(undefined)).toBe(0);
    expect(parseMoneyToCents("abc")).toBe(0);
    expect(parseMoneyToCents(Number.NaN)).toBe(0);
  });

  it("formatiert in Schweizer Franken", () => {
    const s = formatMoney(123450);
    expect(s).toContain("CHF");
    expect(s).toMatch(/1.?234\.50/);
    expect(formatMoney(5)).toMatch(/0\.05/);
    expect(formatMoney(100, "EUR")).toContain("EUR");
  });
});
