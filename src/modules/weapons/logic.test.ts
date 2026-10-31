import { describe, expect, it } from "vitest";
import {
  ageOn, blockReasonOf, inferReportDays, isLoanOverdue, isMinorOn, isoWeekKey, minorReportState, parseCostToCents, reportDueFrom,
  serviceInfo, statusAfterReturn, stripBlockReason, withBlockReason,
} from "./logic";

const d = (s: string) => new Date(s);

describe("ageOn / isMinorOn", () => {
  it("zählt ganze Jahre", () => {
    expect(ageOn("2008-10-30", "2026-10-29")).toBe(17);
    expect(ageOn("2008-10-29", "2026-10-29")).toBe(18);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
  });
  it("Minderjährigkeit aus @db.Date", () => {
    expect(isMinorOn(d("2010-05-01T00:00:00Z"), "2026-10-29")).toBe(true);
    expect(isMinorOn(d("1980-05-01T00:00:00Z"), "2026-10-29")).toBe(false);
    expect(isMinorOn(null, "2026-10-29")).toBeNull();
  });
});

describe("Meldefrist Minderjährige", () => {
  const loanedAt = d("2026-10-01T10:00:00Z");
  it("berechnet und erkennt die Frist", () => {
    const due = reportDueFrom(loanedAt, 30);
    expect(due.toISOString()).toBe("2026-10-31T10:00:00.000Z");
    expect(inferReportDays(loanedAt, due)).toBe(30);
    expect(inferReportDays(loanedAt, null)).toBeNull();
  });
  it("Zustände", () => {
    const base = { isMinor: true, reportDueAt: d("2026-10-31T10:00:00Z"), reportedAt: null };
    expect(minorReportState({ ...base, isMinor: false }, d("2026-10-29T10:00:00Z")).state).toBe("none");
    expect(minorReportState({ ...base, reportedAt: d("2026-10-02T10:00:00Z") }, d("2026-10-29T10:00:00Z")).state).toBe("reported");
    expect(minorReportState(base, d("2026-10-10T10:00:00Z"))).toEqual({ state: "open", daysLeft: 21 });
    expect(minorReportState(base, d("2026-10-26T10:00:00Z"))).toEqual({ state: "soon", daysLeft: 5 });
    expect(minorReportState(base, d("2026-10-31T09:00:00Z")).state).toBe("soon");
    expect(minorReportState(base, d("2026-11-02T10:00:00Z")).state).toBe("overdue");
    expect(minorReportState({ ...base, reportDueAt: null }, d("2026-11-02T10:00:00Z")).state).toBe("open");
  });
});

describe("Überfällige Leihe", () => {
  it("nur wenn Datum vorbei und nicht zurück", () => {
    const now = d("2026-10-29T12:00:00Z");
    expect(isLoanOverdue({ dueAt: d("2026-10-28T22:59:00Z"), returnedAt: null }, now)).toBe(true);
    expect(isLoanOverdue({ dueAt: d("2026-10-30T22:59:00Z"), returnedAt: null }, now)).toBe(false);
    expect(isLoanOverdue({ dueAt: d("2026-10-28T22:59:00Z"), returnedAt: now }, now)).toBe(false);
    expect(isLoanOverdue({ dueAt: null, returnedAt: null }, now)).toBe(false);
  });
});

describe("Wartung", () => {
  const w = { status: "AVAILABLE", serviceEveryShots: 1000, nextServiceAt: null as Date | null, shotsSinceService: 400 };
  it("nach Schusszahl", () => {
    expect(serviceInfo(w, "2026-10-29")).toMatchObject({ due: false, shotsLeft: 600 });
    expect(serviceInfo({ ...w, shotsSinceService: 1000 }, "2026-10-29")).toMatchObject({ due: true, byShots: true, shotsLeft: 0 });
  });
  it("nach Datum", () => {
    expect(serviceInfo({ ...w, nextServiceAt: d("2026-10-29T00:00:00Z") }, "2026-10-29")).toMatchObject({ due: true, byDate: true, daysLeft: 0 });
    expect(serviceInfo({ ...w, nextServiceAt: d("2026-11-08T00:00:00Z") }, "2026-10-29")).toMatchObject({ due: false, daysLeft: 10 });
  });
  it("Status SERVICE immer fällig, ausgemustert nie", () => {
    expect(serviceInfo({ ...w, status: "SERVICE" }, "2026-10-29").due).toBe(true);
    expect(serviceInfo({ ...w, status: "RETIRED", shotsSinceService: 5000 }, "2026-10-29").due).toBe(false);
  });
  it("ohne Intervall nie nach Schuss", () => {
    expect(serviceInfo({ ...w, serviceEveryShots: null, shotsSinceService: 99999 }, "2026-10-29").due).toBe(false);
  });
  it("Status nach Rückgabe", () => {
    expect(statusAfterReturn("LOANED", 999, 1000)).toBe("AVAILABLE");
    expect(statusAfterReturn("LOANED", 1000, 1000)).toBe("SERVICE");
    expect(statusAfterReturn("LOANED", 5000, null)).toBe("AVAILABLE");
    expect(statusAfterReturn("BLOCKED", 5000, 1000)).toBe("BLOCKED");
  });
});

describe("Sperrgrund", () => {
  it("setzt, liest und entfernt", () => {
    const n = withBlockReason("Griff links", "Abzug  klemmt");
    expect(n).toBe("Sperrgrund: Abzug klemmt\nGriff links");
    expect(blockReasonOf(n)).toBe("Abzug klemmt");
    expect(stripBlockReason(n)).toBe("Griff links");
    expect(withBlockReason(n, "Lauf")).toBe("Sperrgrund: Lauf\nGriff links");
    expect(blockReasonOf("Griff links")).toBeNull();
    expect(stripBlockReason("Sperrgrund: x")).toBeNull();
  });
});

describe("Hilfsfunktionen", () => {
  it("ISO-Woche", () => {
    expect(isoWeekKey("2026-10-29")).toBe("2026-W44");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2025-12-29")).toBe("2026-W01");
  });
  it("Kosten", () => {
    expect(parseCostToCents("45")).toBe(4500);
    expect(parseCostToCents("45,5")).toBe(4550);
    expect(parseCostToCents("CHF 1'200.05")).toBe(120005);
    expect(parseCostToCents("")).toBeNull();
    expect(parseCostToCents("abc")).toBeUndefined();
  });
});
