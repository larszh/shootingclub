import { describe, expect, it } from "vitest";
import {
  buildSatCsv,
  daysBetween,
  dayToDbDate,
  dbDateToDay,
  dueDeadlineReminders,
  formatDbDate,
  groupDaysByYear,
  mergeShootingDays,
  nachweisRange,
  opStatusByUser,
  parseYear,
  rankFs,
  satRowCells,
  splitName,
  summarizeOp,
} from "./types";

describe("Datum", () => {
  it("wandelt Kalendertage um", () => {
    expect(dayToDbDate("2026-03-01")?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(dayToDbDate("2026-02-30")).toBeNull();
    expect(dayToDbDate("")).toBeNull();
    expect(dbDateToDay(new Date("2026-03-01T00:00:00Z"))).toBe("2026-03-01");
    expect(formatDbDate(new Date("1980-12-24T00:00:00Z"))).toBe("24.12.1980");
    expect(daysBetween("2026-10-29", "2026-11-12")).toBe(14);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("prüft das Jahr", () => {
    expect(parseYear("2025", 2026)).toBe(2025);
    expect(parseYear("2030", 2026)).toBe(2026);
    expect(parseYear(undefined, 2026)).toBe(2026);
  });
});

describe("dueDeadlineReminders", () => {
  const deadlines = { registrationDeadline: "2026-11-12", shootingDeadline: "2026-11-01", reportDeadline: "2027-01-31" };

  it("liefert die passende Stufe pro Frist", () => {
    const due = dueDeadlineReminders(deadlines, "2026-10-29");
    expect(due.map((d) => [d.key, d.stage, d.daysLeft])).toEqual([
      ["registrationDeadline", 14, 14],
      ["shootingDeadline", 3, 3],
    ]);
  });

  it("ignoriert vergangene und ferne Fristen", () => {
    expect(dueDeadlineReminders(deadlines, "2026-11-13")).toEqual([]);
    expect(dueDeadlineReminders({ reportDeadline: "2027-01-31" }, "2026-10-29")).toEqual([]);
  });

  it("erinnert am Fristtag noch (Stufe 3)", () => {
    expect(dueDeadlineReminders({ shootingDeadline: "2026-11-01" }, "2026-11-01")[0]?.stage).toBe(3);
  });
});

describe("Obligatorisch-Status", () => {
  const d = (s: string) => new Date(s);
  const results = [
    { userId: "a", passed: false, attempt: 1, date: d("2026-05-01T08:00:00Z") },
    { userId: "a", passed: true, attempt: 2, date: d("2026-06-01T08:00:00Z") },
    { userId: "b", passed: false, attempt: 1, date: d("2026-05-01T08:00:00Z") },
    { userId: "b", passed: false, attempt: 2, date: d("2026-06-01T08:00:00Z") },
    { userId: "c", passed: null, attempt: 1, date: d("2026-05-01T08:00:00Z") },
    { userId: null, passed: true, attempt: 1, date: d("2026-05-01T08:00:00Z") },
  ];

  it("erkennt bestanden, verblieben und ohne Regel", () => {
    const map = opStatusByUser(results);
    expect(map.get("a")?.status).toBe("passed");
    expect(map.get("b")?.status).toBe("failed");
    expect(map.get("b")?.attempts).toBe(2);
    expect(map.get("c")?.status).toBe("unknown");
    expect(map.size).toBe(3);
  });

  it("zählt zusammen", () => {
    expect(summarizeOp(results)).toEqual({ confirmed: 6, shooters: 3, passed: 1, failed: 1, unknown: 1 });
  });
});

describe("mergeShootingDays", () => {
  it("führt Tage zusammen, Durchgänge haben Vorrang", () => {
    const matches = [new Date("2026-05-01T18:00:00Z"), new Date("2026-05-01T08:00:00Z"), new Date("2026-06-30T22:30:00Z")];
    const visits = [new Date("2026-05-01T00:00:00Z"), new Date("2026-05-02T00:00:00Z"), new Date("2026-07-01T00:00:00Z")];
    const days = mergeShootingDays(matches, visits);
    expect(days.map((x) => [dbDateToDay(x.date), x.source])).toEqual([
      ["2026-05-01", "match"],
      ["2026-05-02", "visit"],
      // 30.6. 22:30 UTC ist in Zürich bereits der 1.7.
      ["2026-07-01", "match"],
    ]);
  });

  it("begrenzt auf den Zeitraum", () => {
    const days = mergeShootingDays([new Date("2020-01-05T10:00:00Z")], [new Date("2026-01-05T00:00:00Z")], { from: new Date("2021-10-29T10:00:00Z"), to: new Date("2026-10-29T10:00:00Z") });
    expect(days.map((x) => dbDateToDay(x.date))).toEqual(["2026-01-05"]);
  });

  it("gruppiert nach Jahr, neueste zuerst", () => {
    const g = groupDaysByYear(mergeShootingDays([new Date("2025-05-01T10:00:00Z"), new Date("2026-05-01T10:00:00Z"), new Date("2026-06-01T10:00:00Z")], []));
    expect(g.map((x) => [x.year, x.days.map((d) => dbDateToDay(d.date))])).toEqual([
      [2026, ["2026-06-01", "2026-05-01"]],
      [2025, ["2025-05-01"]],
    ]);
  });
});

describe("rankFs", () => {
  it("vergibt gleiche Ränge bei Gleichstand", () => {
    const r = rankFs([
      { id: "1", name: "B", total: 70, zeros: 0 },
      { id: "2", name: "A", total: 72, zeros: 1 },
      { id: "3", name: "C", total: 70, zeros: 0 },
      { id: "4", name: "D", total: 70, zeros: 2 },
    ]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([["2", 1], ["1", 2], ["3", 2], ["4", 4]]);
  });
});

describe("SAT-Export", () => {
  it("teilt Namen", () => {
    expect(splitName("Anna Maria Muster")).toEqual({ firstName: "Anna Maria", lastName: "Muster" });
    expect(splitName("Muster")).toEqual({ firstName: "", lastName: "Muster" });
  });

  it("baut Zeilen ohne AHV-Nummer", () => {
    const cells = satRowCells({ name: "Beat Beispiel", birthDate: new Date("1975-04-03T00:00:00Z"), street: "Bahnhofstrasse 12", zip: "8001", city: "Zürich", program: "Gewehr 300 m – Obligatorisch", total: 45, zeros: 2, attempt: 1, passed: true, date: new Date("2026-05-02T07:00:00Z") });
    expect(cells).toEqual(["Beispiel", "Beat", "03.04.1975", "Bahnhofstrasse 12", "8001", "Zürich", "Gewehr 300 m – Obligatorisch", "45", "2", "1", "ja", "02.05.2026"]);
  });

  it("schützt vor Formel-Injection und setzt BOM und Semikolon", () => {
    const csv = buildSatCsv([{ name: "=HYPERLINK(x) Test", birthDate: null, street: "+41 Strasse", zip: null, city: "@Ort", program: "-Prog", total: null, zeros: null, attempt: null, passed: false, date: new Date("2026-05-02T07:00:00Z") }]);
    expect(csv.startsWith("﻿")).toBe(true);
    const line = csv.split("\r\n")[1]!;
    expect(line.split(";")[1]).toBe("'=HYPERLINK(x)");
    expect(line).toContain("'+41 Strasse");
    expect(line).toContain("'@Ort");
    expect(line).toContain("'-Prog");
    expect(line).toContain(";nein;");
  });
});

describe("nachweisRange", () => {
  it("schaut fünf Jahre zurück", () => {
    const r = nachweisRange(new Date("2026-10-29T10:00:00Z"));
    expect(r.fromDay).toBe("2021-10-29");
    expect(r.today).toBe("2026-10-29");
  });

  it("weicht beim 29. Februar auf den 1. März aus", () => {
    expect(nachweisRange(new Date("2028-02-29T10:00:00Z")).fromDay).toBe("2023-03-01");
  });
});
