import { describe, expect, it } from "vitest";
import {
  assignRanks,
  compareEntries,
  countTopShots,
  isValidDay,
  matchPeriodRange,
  parseDayEnd,
  parseDayStart,
  parsePeriod,
  periodRange,
  round1,
  toCsv,
  weekMonday,
  weekStreaks,
} from "./analytics";
import { DEFAULT_ZONES, type Stage } from "./types";

const d = (s: string) => new Date(s);

describe("Zeiträume", () => {
  const now = d("2026-10-29T12:00:00Z");

  it("periodRange in Schweizer Zeit", () => {
    expect(periodRange("month", now)).toEqual({ from: d("2026-09-30T22:00:00Z"), label: "Oktober 2026" });
    expect(periodRange("year", now)).toEqual({ from: d("2025-12-31T23:00:00Z"), label: "Jahr 2026" });
    expect(periodRange("all", now).from).toBeNull();
  });

  it("parsePeriod mit Rückfall", () => {
    expect(parsePeriod("month")).toBe("month");
    expect(parsePeriod("x")).toBe("year");
    expect(parsePeriod(null, "all")).toBe("all");
  });

  it("matchPeriodRange", () => {
    expect(matchPeriodRange("lastyear", now)).toEqual({ from: d("2024-12-31T23:00:00Z"), to: d("2025-12-31T23:00:00Z") });
    expect(matchPeriodRange("30d", now).from).toEqual(d("2026-09-28T22:00:00Z"));
    expect(matchPeriodRange(undefined, now)).toEqual({});
  });

  it("Tagesgrenzen und gültige Daten", () => {
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("26-01-01")).toBe(false);
    expect(parseDayStart("2026-07-01")).toEqual(d("2026-06-30T22:00:00Z"));
    expect(parseDayEnd("2026-07-01")).toEqual(d("2026-07-01T22:00:00Z"));
    expect(parseDayStart("kaputt")).toBeUndefined();
  });
});

describe("Ranglisten", () => {
  const e = (total: number, topShots: number, lastStage: number, date: string) => ({ total, topShots, lastStage, date: d(date) });

  it("sortiert nach Total, Höchstwerten, letzter Serie, Datum", () => {
    const list = [
      e(90, 3, 45, "2026-05-02"),
      e(95, 1, 40, "2026-05-03"),
      e(90, 4, 40, "2026-05-04"),
      e(90, 3, 46, "2026-05-05"),
      e(90, 3, 45, "2026-05-01"),
    ];
    const sorted = [...list].sort(compareEntries);
    expect(sorted.map((x) => x.date.toISOString().slice(5, 10))).toEqual(["05-03", "05-04", "05-05", "05-01", "05-02"]);
  });

  it("gleiche Werte erhalten den gleichen Rang", () => {
    const ranked = assignRanks([e(95, 1, 40, "2026-05-03"), e(90, 3, 45, "2026-05-01"), e(90, 3, 45, "2026-05-02"), e(80, 0, 40, "2026-05-02")]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
  });

  it("countTopShots: Zehner, Zonen und Treffer/Fehler", () => {
    const ten: Stage = { name: "A", distanceM: 25, shots: 5, maxPerShot: 10 };
    const z: Stage = { name: "Z", distanceM: 10, shots: 3, maxPerShot: 5, zones: DEFAULT_ZONES };
    expect(countTopShots([[10, 9, 10.4], [10]], [ten, ten], "RINGS_DECIMAL")).toBe(3);
    expect(countTopShots([[5, 3, 5, -5]], [z], "ZONES")).toBe(2);
    expect(countTopShots([[1, 1, 1]], [ten], "HITS")).toBe(0);
  });

  it("round1", () => {
    expect(round1(0.1 + 0.2)).toBe(0.3);
    expect(round1(94.95)).toBe(95);
  });
});

describe("Wochen-Serien", () => {
  it("weekMonday", () => {
    expect(weekMonday("2026-10-29")).toBe("2026-10-26");
    expect(weekMonday("2026-11-01")).toBe("2026-10-26");
    expect(weekMonday("2026-10-26")).toBe("2026-10-26");
  });

  it("zählt aktuelle und längste Serie", () => {
    const now = d("2026-10-29T12:00:00Z");
    const dates = ["2026-10-27", "2026-10-20", "2026-10-13", "2026-09-01", "2026-08-25"].map((s) => d(`${s}T10:00:00Z`));
    expect(weekStreaks(dates, now)).toEqual({ current: 3, longest: 3, activeThisWeek: true });
    expect(weekStreaks(dates.slice(1), now)).toEqual({ current: 2, longest: 2, activeThisWeek: false });
    expect(weekStreaks([], now)).toEqual({ current: 0, longest: 0, activeThisWeek: false });
  });
});

describe("CSV", () => {
  it("schützt vor Formeln, behält negative Zahlen", () => {
    const csv = toCsv([["=SUMME(A1)", -5, "-12.5", "a;b", 'x"y', null]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=SUMME(A1);-5;-12.5;\"a;b\";\"x\"\"y\";\r\n");
  });
});
