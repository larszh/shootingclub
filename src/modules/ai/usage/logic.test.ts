import { describe, expect, it } from "vitest";
import {
  addMonths, blendedChfPerMillion, buildUsageTable, chfForTokens, estimateChf, isMonthKey, limitPercent,
  monthKeyZurich, monthRangeZurich, pickMonth, recentMonths, tokensForChf,
} from "./logic";

describe("Monate (Europe/Zurich)", () => {
  it("Monatsschlüssel in Schweizer Zeit", () => {
    // 31.10.2026 23:30 UTC = 1.11.2026 00:30 in Zürich (Winterzeit)
    expect(monthKeyZurich(new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
    expect(monthKeyZurich(new Date("2026-10-31T22:30:00Z"))).toBe("2026-10");
  });
  it("addMonths über Jahresgrenzen", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-05", -17)).toBe("2024-12");
  });
  it("Monatsbereich", () => {
    const { from, to } = monthRangeZurich("2026-11");
    expect(from.toISOString()).toBe("2026-10-31T23:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-30T23:00:00.000Z");
    expect(monthRangeZurich("2026-03").to.toISOString()).toBe("2026-03-31T22:00:00.000Z"); // Sommerzeit ab April
  });
  it("letzte Monate, neuester zuerst", () => {
    expect(recentMonths(3, new Date("2026-01-15T12:00:00Z"))).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
  it("pickMonth", () => {
    const now = new Date("2026-11-07T10:00:00Z");
    expect(isMonthKey("2026-13")).toBe(false);
    expect(pickMonth("2026-09", now)).toBe("2026-09");
    expect(pickMonth("2027-01", now)).toBe("2026-11");
    expect(pickMonth("abc", now)).toBe("2026-11");
    expect(pickMonth(undefined, now)).toBe("2026-11");
    expect(pickMonth("2026-01", now, 5)).toBe("2026-11");
    expect(pickMonth("2026-06", now, 5)).toBe("2026-06");
  });
});

describe("CHF-Schätzung", () => {
  it("Kosten nach Token-Art", () => {
    const u = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(estimateChf(u, "claude-opus-5-5")).toBeCloseTo(4.5);
    expect(estimateChf({ ...u, inputTokens: 0, outputTokens: 1_000_000 }, "claude-opus-5-5")).toBeCloseTo(22.5);
    expect(estimateChf({ ...u, inputTokens: 0, cacheReadTokens: 1_000_000 }, "claude-opus-5-5")).toBeCloseTo(0.45);
    expect(estimateChf({ ...u, inputTokens: 0, cacheWriteTokens: 1_000_000 }, "claude-opus-5-5")).toBeCloseTo(5.625);
    // unbekanntes Modell → Standardmodell
    expect(estimateChf(u, "unknown")).toBeCloseTo(4.5);
  });
  it("Budget-Umrechnung hin und zurück", () => {
    expect(blendedChfPerMillion("claude-opus-5-5")).toBeCloseTo(8.1);
    const tokens = tokensForChf(81, "claude-opus-5-5");
    expect(tokens).toBe(10_000_000);
    expect(chfForTokens(tokens, "claude-opus-5-5")).toBe(81);
    expect(tokensForChf(-1, "claude-opus-5-5")).toBe(0);
    expect(chfForTokens(0, "claude-opus-5-5")).toBe(0);
  });
});

describe("buildUsageTable", () => {
  const g = (key: string, ok: boolean, requests: number, input: number, model = "claude-opus-5-5") => ({
    key, model, ok, requests, inputTokens: input, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0,
  });
  it("fasst Modelle und Fehler zusammen", () => {
    const t = buildUsageTable([g("help", true, 3, 100), g("help", false, 1, 0), g("help", true, 2, 50, "claude-haiku-5-5"), g("coach", true, 1, 500)]);
    expect(t.rows.map((r) => r.key)).toEqual(["coach", "help"]); // nach Tokens
    expect(t.rows[1]).toMatchObject({ key: "help", requests: 6, failed: 1, tokens: 150 });
    expect(t.total).toMatchObject({ requests: 7, failed: 1, tokens: 650 });
    expect(t.total.chf).toBeGreaterThan(0);
  });
  it("feste Reihenfolge", () => {
    const t = buildUsageTable([g("b", true, 1, 1), g("x", true, 1, 999), g("a", true, 1, 1)], ["a", "b"]);
    expect(t.rows.map((r) => r.key)).toEqual(["a", "b", "x"]);
  });
  it("leer", () => {
    expect(buildUsageTable([])).toEqual({ rows: [], total: { key: "total", requests: 0, failed: 0, tokens: 0, chf: 0 } });
  });
});

describe("limitPercent", () => {
  it("rechnet und kappt", () => {
    expect(limitPercent(50, 200)).toBe(25);
    expect(limitPercent(500, 200)).toBe(100);
    expect(limitPercent(5, null)).toBeNull();
    expect(limitPercent(5, 0)).toBeNull();
  });
});
