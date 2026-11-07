import { describe, expect, it } from "vitest";
import {
  buildAssociationRanking,
  buildRankingCsv,
  buildStatsCsv,
  deadlineViews,
  fsStats,
  isJunior,
  memberCounts,
  nextDeadline,
  normalizePeriod,
  opStats,
  parseDayParam,
  parseRankingParams,
  rankingQuery,
  passRate,
  sumClubStats,
  type ClubStatsRow,
} from "./stats";

describe("Mitglieder", () => {
  it("zählt Junioren nach Status oder Alter", () => {
    expect(isJunior({ status: "JUNIOR", birthYear: null }, 2026)).toBe(true);
    expect(isJunior({ status: "ACTIVE", birthYear: 2006 }, 2026)).toBe(true);
    expect(isJunior({ status: "ACTIVE", birthYear: 2005 }, 2026)).toBe(false);
    expect(isJunior({ status: "ACTIVE", birthYear: null }, 2026)).toBe(false);
  });
  it("zählt aktive Mitglieder und Junioren", () => {
    const c = memberCounts([
      { status: "ACTIVE", birthYear: 1980 },
      { status: "JUNIOR", birthYear: 2010 },
      { status: "PASSIVE", birthYear: 2008 },
      { status: "HONORARY", birthYear: 1950 },
    ], 2026);
    expect(c).toEqual({ total: 4, active: 2, juniors: 2 });
  });
});

describe("Obligatorisch und Feldschiessen", () => {
  it("fasst amtliche OP-Resultate zusammen", () => {
    const d = new Date("2026-05-01");
    const s = opStats([
      { userId: "u1", passed: false, attempt: 1, date: d },
      { userId: "u1", passed: true, attempt: 2, date: d },
      { userId: "u2", passed: false, attempt: 1, date: d },
      { userId: "u2", passed: false, attempt: 2, date: d },
      { userId: "u3", passed: null, attempt: 1, date: d },
      { userId: null, passed: true, attempt: 1, date: d },
    ]);
    expect(s).toEqual({ results: 6, shooters: 3, passed: 1, notPassedResults: 3, remaining: 1, unknown: 1 });
    expect(passRate(s)).toBe(33);
    expect(passRate({ shooters: 0, passed: 0 })).toBeNull();
  });
  it("zählt FS-Teilnahmen pro Mitglied einmal, Gäste pro Resultat", () => {
    expect(fsStats([
      { userId: "u1", isOfficial: true },
      { userId: "u1", isOfficial: false },
      { userId: "u2", isOfficial: false },
      { userId: null, isOfficial: true },
      { userId: null, isOfficial: false },
    ])).toEqual({ participants: 4, members: 2, guests: 2, confirmed: 2 });
  });
});

describe("Fristen", () => {
  it("bewertet Fristen relativ zu heute", () => {
    const v = deadlineViews({ registrationDeadline: "2026-03-31", shootingDeadline: "2026-08-31", reportDeadline: "2026-08-20" }, "2026-08-10");
    expect(v.map((x) => [x.key, x.status, x.daysLeft])).toEqual([
      ["registrationDeadline", "past", -132],
      ["reportDeadline", "soon", 10],
      ["shootingDeadline", "upcoming", 21],
    ]);
    expect(nextDeadline(v)?.key).toBe("reportDeadline");
    expect(deadlineViews({ reportDeadline: "2026-08-10" }, "2026-08-10")[0]!.status).toBe("today");
    expect(nextDeadline(deadlineViews({ reportDeadline: "2026-01-01" }, "2026-08-10"))).toBeNull();
  });
});

function row(p: Partial<ClubStatsRow> & { tenantId: string; clubName: string }): ClubStatsRow {
  return {
    members: { total: 10, active: 8, juniors: 2 },
    op: { results: 5, shooters: 4, passed: 3, notPassedResults: 2, remaining: 1, unknown: 0 },
    fs: { participants: 6, members: 5, guests: 1, confirmed: 4 },
    unconfirmed: 1,
    deadlines: [],
    ...p,
  };
}

describe("Summen und CSV", () => {
  it("summiert Vereine", () => {
    const s = sumClubStats([row({ tenantId: "t1", clubName: "A" }), row({ tenantId: "t2", clubName: "B" })]);
    expect(s.clubs).toBe(2);
    expect(s.members).toEqual({ total: 20, active: 16, juniors: 4 });
    expect(s.op.remaining).toBe(2);
    expect(s.fs.participants).toBe(12);
    expect(s.unconfirmed).toBe(2);
  });
  it("schreibt die Statistik als CSV mit BOM, Semikolon und Formelschutz", () => {
    const csv = buildStatsCsv([row({ tenantId: "t1", clubName: "=SG Test", deadlines: deadlineViews({ reportDeadline: "2026-08-20" }, "2026-08-10") })]);
    expect(csv.startsWith("﻿Verein;Mitglieder")).toBe(true);
    expect(csv).toContain("'=SG Test;10;8;2;4;3;2;1;0;6;5;1;4;1;Abschluss / Meldung der Resultate;20.08.2026");
  });
});

describe("Verbandsrangliste", () => {
  const entries = [
    { tenantId: "t1", clubName: "SG Alpha", userId: "u1", name: "Anna Muster", total: 90, zeros: 0 },
    { tenantId: "t1", clubName: "SG Alpha", userId: "u1", name: "Anna Muster", total: 95, zeros: 1 },
    { tenantId: "t1", clubName: "SG Alpha", userId: "u2", name: "Beat Beispiel", total: 95, zeros: 0 },
    { tenantId: "t2", clubName: "FSG Beta", userId: "u3", name: "Geheim", total: 99, zeros: 0 },
    { tenantId: "t2", clubName: "FSG Beta", userId: "u3", name: "Geheim", total: 80, zeros: 0 },
    { tenantId: "t2", clubName: "FSG Beta", userId: "u4", name: "Geheim 2", total: 70, zeros: 0 },
    { tenantId: "t9", clubName: "Fremd", userId: "u9", name: "Nicht freigegeben", total: 100, zeros: 0 },
  ];
  it("rangiert nur Vereine mit Namensfreigabe, bestes Resultat pro Schütze", () => {
    const r = buildAssociationRanking(entries, ["t1", "t2"], ["t1", "t9"]);
    expect(r.ranked.map((e) => [e.rank, e.name, e.total, e.results])).toEqual([
      [1, "Beat Beispiel", 95, 1],
      [2, "Anna Muster", 95, 2],
    ]);
    expect(r.anonymous).toEqual([{ tenantId: "t2", clubName: "FSG Beta", shooters: 2, results: 3 }]);
    const flat = JSON.stringify(r);
    expect(flat).not.toContain("Geheim");
    expect(flat).not.toContain("Nicht freigegeben");
  });
  it("liefert ohne lesbare Vereine nichts", () => {
    expect(buildAssociationRanking(entries, [], ["t1"])).toEqual({ ranked: [], anonymous: [] });
  });
  it("schreibt die Rangliste als CSV", () => {
    const csv = buildRankingCsv(buildAssociationRanking(entries, ["t1", "t2"], ["t1"]), false);
    expect(csv).toContain("1;Beat Beispiel;SG Alpha;95;0;1");
    expect(csv).toContain(";FSG Beta;2;3;;");
    expect(csv).not.toContain("Geheim");
  });
});

describe("Parameter", () => {
  it("prüft Tage und ordnet Zeiträume", () => {
    expect(parseDayParam("2026-02-30", "x")).toBe("x");
    expect(parseDayParam("2026-02-28", "x")).toBe("2026-02-28");
    expect(parseDayParam(undefined, "x")).toBe("x");
    expect(normalizePeriod("2026-12-31", "2026-01-01")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(normalizePeriod("2020-01-01", "2026-12-31")).toEqual({ from: "2024-12-30", to: "2026-12-31" });
  });
});

describe("Ranglisten-Parameter", () => {
  it("nimmt nur bekannte Programme und setzt Standardzeitraum", () => {
    const p = parseRankingParams({ program: "fremd", from: null, to: "kaputt", official: "1" }, ["p1", "p2"], "2026-11-07");
    expect(p).toEqual({ programId: "p1", from: "2026-01-01", to: "2026-11-07", officialOnly: true });
    expect(parseRankingParams({ program: "p2", from: "2026-03-01", to: "2026-02-01" }, ["p1", "p2"], "2026-11-07")).toEqual({ programId: "p2", from: "2026-02-01", to: "2026-03-01", officialOnly: false });
    expect(parseRankingParams({}, [], "2026-11-07").programId).toBeNull();
    expect(rankingQuery({ programId: "p1", from: "2026-01-01", to: "2026-11-07", officialOnly: true })).toBe("program=p1&from=2026-01-01&to=2026-11-07&official=1");
  });
});
