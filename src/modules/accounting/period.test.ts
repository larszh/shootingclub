import { describe, expect, it } from "vitest";
import { formatDateCh, isIsoDate, resolvePeriod, validateRange } from "./period";

const TODAY = "2026-10-31";

describe("resolvePeriod", () => {
  it("Standard: laufendes Jahr", () => {
    expect(resolvePeriod({}, TODAY)).toMatchObject({ kind: "year", from: "2026-01-01", to: "2026-12-31", label: "Jahr 2026" });
  });

  it("Quartal", () => {
    expect(resolvePeriod({ period: "quarter", year: "2025", q: "1" }, TODAY)).toMatchObject({ from: "2025-01-01", to: "2025-03-31" });
    expect(resolvePeriod({ period: "quarter", year: "2025", q: "4" }, TODAY)).toMatchObject({ from: "2025-10-01", to: "2025-12-31", label: "4. Quartal 2025" });
    // ohne Angabe: aktuelles Quartal
    expect(resolvePeriod({ period: "quarter" }, TODAY)).toMatchObject({ quarter: 4, from: "2026-10-01" });
  });

  it("Monat inkl. Schaltjahr", () => {
    expect(resolvePeriod({ period: "month", year: "2028", m: "2" }, TODAY)).toMatchObject({ from: "2028-02-01", to: "2028-02-29", label: "Februar 2028" });
    expect(resolvePeriod({ period: "month", year: "2026", m: "2" }, TODAY).to).toBe("2026-02-28");
    expect(resolvePeriod({ period: "month", m: "13" }, TODAY)).toMatchObject({ month: 10, from: "2026-10-01", to: "2026-10-31" });
  });

  it("freier Zeitraum, ungültig → Jahresbeginn bis heute", () => {
    expect(resolvePeriod({ period: "custom", from: "2026-03-15", to: "2026-04-15" }, TODAY)).toMatchObject({ from: "2026-03-15", to: "2026-04-15", label: "15.03.2026 – 15.04.2026" });
    expect(resolvePeriod({ period: "custom", from: "2026-05-01", to: "2026-04-01" }, TODAY)).toMatchObject({ from: "2026-01-01", to: TODAY });
  });
});

describe("validateRange / isIsoDate", () => {
  it("prüft Format, Reihenfolge und Länge", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(validateRange("2026-01-01", "2026-01-01")).toEqual({ ok: true, from: "2026-01-01", to: "2026-01-01" });
    expect(validateRange("2026-02-01", "2026-01-01").ok).toBe(false);
    expect(validateRange("2020-01-01", "2026-01-01").ok).toBe(false);
    expect(validateRange(null, "2026-01-01").ok).toBe(false);
  });

  it("formatDateCh", () => {
    expect(formatDateCh("2026-03-05")).toBe("05.03.2026");
  });
});
