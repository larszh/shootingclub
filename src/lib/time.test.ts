import { describe, expect, it } from "vitest";
import { addDays, formatTimeRange, tzOffsetMinutes, zurichParts, zurichToUtc } from "./time";

describe("time (Europe/Zurich)", () => {
  it("rechnet Winter- und Sommerzeit korrekt in UTC um", () => {
    expect(zurichToUtc("2026-01-15", "10:00").toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(zurichToUtc("2026-07-01", "10:00").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zurichToUtc("2026-12-31", "23:30").toISOString()).toBe("2026-12-31T22:30:00.000Z");
  });

  it("behandelt die Umstellungstage", () => {
    // 29.03.2026: 02:00 → 03:00 (Sommerzeit beginnt)
    expect(zurichToUtc("2026-03-29", "01:30").toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(zurichToUtc("2026-03-29", "03:30").toISOString()).toBe("2026-03-29T01:30:00.000Z");
    // 25.10.2026: 03:00 → 02:00 (Winterzeit beginnt)
    expect(zurichToUtc("2026-10-25", "04:00").toISOString()).toBe("2026-10-25T03:00:00.000Z");
    expect(zurichToUtc("2026-10-25", "00:00").toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("liefert Offsets in Minuten", () => {
    expect(tzOffsetMinutes(new Date("2026-01-01T12:00:00Z"))).toBe(60);
    expect(tzOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(120);
  });

  it("zerlegt Zeitpunkte in Schweizer Kalenderwerte", () => {
    const p = zurichParts(new Date("2026-10-31T23:30:00Z"));
    expect(p.dateStr).toBe("2026-11-01");
    expect(p.timeStr).toBe("00:30");
    expect(p.weekday).toBe(0); // Sonntag
  });

  it("zählt Tage über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("formatiert Zeitspannen", () => {
    expect(formatTimeRange(new Date("2026-07-01T16:00:00Z"), new Date("2026-07-01T18:30:00Z"))).toBe("18:00–20:30");
  });
});
