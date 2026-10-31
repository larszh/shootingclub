import { describe, expect, it } from "vitest";
import { autoAttempt, clampAttempt, evaluatePass, hasPassRule, passLabel, swissYear } from "./official";

describe("evaluatePass", () => {
  const op = { passMinScore: 42, passMaxZeros: 3 };

  it("gibt null ohne Regel zurück", () => {
    expect(hasPassRule({ passMinScore: null, passMaxZeros: null })).toBe(false);
    expect(evaluatePass({ total: 80, zeros: 0 }, { passMinScore: null, passMaxZeros: undefined })).toBeNull();
  });

  it("gibt null ohne Total zurück", () => {
    expect(evaluatePass({ total: null, zeros: 0 }, op)).toBeNull();
  });

  it("prüft Mindestpunkte und Nuller", () => {
    expect(evaluatePass({ total: 42, zeros: 3 }, op)).toBe(true);
    expect(evaluatePass({ total: 41, zeros: 0 }, op)).toBe(false);
    expect(evaluatePass({ total: 60, zeros: 4 }, op)).toBe(false);
    expect(evaluatePass({ total: 42, zeros: null }, op)).toBe(true);
  });

  it("rundet Zehntel vor dem Vergleich", () => {
    expect(evaluatePass({ total: 41.99999, zeros: 0 }, op)).toBe(true);
  });

  it("funktioniert mit nur einer Regel", () => {
    expect(evaluatePass({ total: 10, zeros: 0 }, { passMinScore: null, passMaxZeros: 0 })).toBe(true);
    expect(evaluatePass({ total: 10, zeros: 1 }, { passMinScore: null, passMaxZeros: 0 })).toBe(false);
    expect(evaluatePass({ total: 10, zeros: 9 }, { passMinScore: 10, passMaxZeros: null })).toBe(true);
  });

  it("liefert lesbare Texte", () => {
    expect(passLabel(true)).toBe("bestanden");
    expect(passLabel(false)).toBe("nicht bestanden");
    expect(passLabel(null)).toBe("ohne Bestehensregel");
  });
});

describe("autoAttempt", () => {
  const d = (s: string) => new Date(s);
  const cur = { id: "c", date: d("2026-06-10T08:00:00Z"), createdAt: d("2026-06-10T08:00:00Z") };

  it("ist 1 ohne frühere Teilnahmen", () => {
    expect(autoAttempt(cur, [])).toBe(1);
  });

  it("zählt frühere Teilnahmen im selben Jahr", () => {
    const others = [
      { id: "a", date: d("2026-05-01T08:00:00Z"), createdAt: d("2026-05-01T08:00:00Z") },
      { id: "b", date: d("2026-06-10T08:00:00Z"), createdAt: d("2026-06-10T07:00:00Z") },
      { id: "late", date: d("2026-07-01T08:00:00Z"), createdAt: d("2026-07-01T08:00:00Z") },
      { id: "old", date: d("2025-08-01T08:00:00Z"), createdAt: d("2025-08-01T08:00:00Z") },
      { id: "c", date: d("2026-06-10T08:00:00Z"), createdAt: d("2026-06-10T08:00:00Z") },
    ];
    expect(autoAttempt(cur, others)).toBe(3);
  });

  it("verwendet das Schweizer Kalenderjahr", () => {
    // 31.12.2025 23:30 UTC ist in Zürich bereits 2026
    expect(swissYear(d("2025-12-31T23:30:00Z"))).toBe(2026);
    const others = [{ id: "x", date: d("2025-12-31T23:30:00Z"), createdAt: d("2025-12-31T23:30:00Z") }];
    expect(autoAttempt({ id: "y", date: d("2026-01-05T10:00:00Z"), createdAt: d("2026-01-05T10:00:00Z") }, others)).toBe(2);
  });
});

describe("clampAttempt", () => {
  it("akzeptiert 1 bis 20", () => {
    expect(clampAttempt("2")).toBe(2);
    expect(clampAttempt(0)).toBeNull();
    expect(clampAttempt(21)).toBeNull();
    expect(clampAttempt("x")).toBeNull();
  });
});
