import { describe, expect, it } from "vitest";
import { assignRanks, computeRanking, isEligible, openSlots, podium, resultScore, type RankingConfig, type RankingResult } from "./ranking";
import { NO_CATEGORY, ageInYear, categoryForBirthYear, parseCategories } from "./types";

const base: RankingConfig = {
  year: 2026,
  startsOn: "2026-01-01",
  endsOn: "2026-12-31",
  bestOf: 2,
  officialOnly: false,
  programs: [
    { programId: "A", name: "Programm A", required: true, weight: 1, maxCount: null },
    { programId: "B", name: "Programm B", required: false, weight: 1, maxCount: null },
  ],
  categories: [],
};

let seq = 0;
function res(userId: string, programId: string, total: number | null, extra: Partial<RankingResult> = {}): RankingResult {
  seq += 1;
  return { participantId: `p${seq}`, userId, programId, matchId: `m${seq}`, day: "2026-05-01", finished: true, isOfficial: false, total, ...extra };
}

const members = [
  { userId: "u1", name: "Anna Muster", birthYear: 1990 },
  { userId: "u2", name: "Beat Keller", birthYear: 1960 },
  { userId: "u3", name: "Carla Frei", birthYear: null },
  { userId: "u4", name: "Dario Rossi", birthYear: 2010 },
];

describe("parseCategories", () => {
  it("liest Zeilen mit offenen Grenzen und Bonus", () => {
    const { categories, errors } = parseCategories("Junioren;0;20;0\n# Kommentar\n\nVeteranen;60;;2,5\nElite");
    expect(errors).toEqual([]);
    expect(categories).toEqual([
      { name: "Junioren", minAge: 0, maxAge: 20, bonus: 0 },
      { name: "Veteranen", minAge: 60, maxAge: null, bonus: 2.5 },
      { name: "Elite", minAge: null, maxAge: null, bonus: 0 },
    ]);
  });

  it("meldet Fehler mit Zeilennummer", () => {
    const { errors } = parseCategories("A;x;3;0\nB;50;40;0\n;1;2;3\nA2;1;2;abc\nC;1;2;3;4");
    expect(errors).toHaveLength(5);
    expect(errors[0]).toContain("Zeile 1");
    expect(errors[1]).toContain("Zeile 2");
  });

  it("verbietet doppelte und reservierte Namen", () => {
    expect(parseCategories("A;;;\na;;;").errors[0]).toContain("doppelt");
    expect(parseCategories("ohne Kategorie;;;").errors[0]).toContain("reserviert");
  });
});

describe("Kategorie aus Jahrgang", () => {
  const cats = parseCategories("Junioren;;20;0\nElite;21;59;0\nVeteranen;60;;3").categories;
  it("rechnet mit dem Alter am 31.12.", () => {
    expect(ageInYear(2006, 2026)).toBe(20);
    expect(categoryForBirthYear(cats, 2006, 2026)?.name).toBe("Junioren");
    expect(categoryForBirthYear(cats, 2005, 2026)?.name).toBe("Elite");
    expect(categoryForBirthYear(cats, 1966, 2026)?.name).toBe("Veteranen");
  });
  it("ohne Geburtsdatum keine Kategorie", () => {
    expect(categoryForBirthYear(cats, null, 2026)).toBeNull();
  });
});

describe("resultScore / isEligible", () => {
  it("nimmt Total, sonst Summe der Serien", () => {
    expect(resultScore({ total: 95.5 })).toBe(95.5);
    expect(resultScore({ total: null, stageTotals: [48.1, 47.2] })).toBe(95.3);
    expect(resultScore({ total: null, stageTotals: [] })).toBeNull();
  });
  it("prüft Status, Zeitraum und amtlich", () => {
    const cfg = { startsOn: "2026-03-01", endsOn: "2026-09-30", officialOnly: true };
    expect(isEligible(res("u1", "A", 1, { day: "2026-03-01", isOfficial: true }), cfg)).toBe(true);
    expect(isEligible(res("u1", "A", 1, { day: "2026-09-30", isOfficial: true }), cfg)).toBe(true);
    expect(isEligible(res("u1", "A", 1, { day: "2026-10-01", isOfficial: true }), cfg)).toBe(false);
    expect(isEligible(res("u1", "A", 1, { isOfficial: false }), cfg)).toBe(false);
    expect(isEligible(res("u1", "A", 1, { finished: false, isOfficial: true }), cfg)).toBe(false);
  });
});

describe("computeRanking", () => {
  it("zählt die besten N und streicht den Rest", () => {
    const r = computeRanking(base, members, [res("u1", "A", 90), res("u1", "A", 95), res("u1", "A", 80), res("u1", "B", 50)]);
    const anna = r.ranked[0]!;
    const a = anna.programs.find((p) => p.programId === "A")!;
    expect(a.counted.map((x) => x.score)).toEqual([95, 90]);
    expect(a.struck.map((x) => x.score)).toEqual([80]);
    expect(anna.total).toBe(235);
    expect(anna.countedResults).toBe(3);
  });

  it("maxCount pro Programm überschreibt bestOf; ohne beides zählen alle", () => {
    const cfg: RankingConfig = { ...base, bestOf: null, programs: [{ ...base.programs[0]!, maxCount: 1 }, base.programs[1]!] };
    const r = computeRanking(cfg, members, [res("u1", "A", 90), res("u1", "A", 95), res("u1", "B", 10), res("u1", "B", 20), res("u1", "B", 30)]);
    expect(r.ranked[0]!.total).toBe(95 + 60);
  });

  it("gewichtet die Programme", () => {
    const cfg: RankingConfig = { ...base, programs: [{ ...base.programs[0]!, weight: 2 }, { ...base.programs[1]!, weight: 0.5 }] };
    const r = computeRanking(cfg, members, [res("u1", "A", 90), res("u1", "B", 50)]);
    expect(r.ranked[0]!.base).toBe(205);
  });

  it("listet Mitglieder ohne Pflichtprogramm als nicht klassiert", () => {
    const r = computeRanking(base, members, [res("u1", "A", 90), res("u2", "B", 99)]);
    expect(r.ranked.map((e) => e.userId)).toEqual(["u1"]);
    expect(r.unclassified.map((e) => e.userId)).toEqual(["u2"]);
    expect(r.unclassified[0]!.missingRequired).toEqual(["Programm A"]);
    expect(r.unclassified[0]!.rank).toBeNull();
  });

  it("ignoriert Gäste/Fremde, offene Durchgänge und fremde Programme", () => {
    const r = computeRanking(base, members, [res("x", "A", 100), res("u1", "A", 99, { finished: false }), res("u1", "Z", 99)]);
    expect(r.ranked).toEqual([]);
    expect(r.unclassified).toEqual([]);
  });

  it("nutzt die Seriensumme, wenn das Total fehlt", () => {
    const r = computeRanking(base, members, [res("u1", "A", null, { stageTotals: [40, 45] })]);
    expect(r.ranked[0]!.total).toBe(85);
  });

  it("vergibt Bonus pro Kategorie und rangiert je Kategorie", () => {
    const cfg: RankingConfig = { ...base, categories: parseCategories("Jugend;;20;5\nElite;21;59;0\nVeteranen;60;;3").categories };
    const r = computeRanking(cfg, members, [res("u1", "A", 90), res("u2", "A", 88), res("u3", "A", 92), res("u4", "A", 80)]);
    const by = Object.fromEntries(r.ranked.map((e) => [e.userId, e]));
    expect(by.u2!.category).toBe("Veteranen");
    expect(by.u2!.total).toBe(91);
    expect(by.u3!.category).toBe(NO_CATEGORY);
    expect(by.u4!.category).toBe("Jugend");
    expect(by.u4!.total).toBe(85);
    expect(r.ranked.map((e) => e.userId)).toEqual(["u3", "u2", "u1", "u4"]);
    expect(r.categories.map((c) => c.name)).toEqual(["Jugend", "Elite", "Veteranen", NO_CATEGORY]);
    expect(r.categories.every((c) => c.entries[0]!.categoryRank === 1)).toBe(true);
  });

  it("Gleichstand: bestes Einzelresultat, dann mehr Resultate, sonst gleicher Rang", () => {
    // u1: 50+50 = 100, bestes 50 · u2: 60+40 = 100, bestes 60 → u2 vor u1
    const r1 = computeRanking(base, members, [res("u1", "A", 50), res("u1", "A", 50), res("u2", "A", 60), res("u2", "A", 40)]);
    expect(r1.ranked.map((e) => [e.userId, e.rank])).toEqual([["u2", 1], ["u1", 2]]);

    // u1: 60+40 (2 Resultate) · u2: 60 + B 40 (2) · u3: 60+40 in A und B 0 (3 Resultate) → u3 vor den anderen
    const r2 = computeRanking(base, members, [
      res("u1", "A", 60), res("u1", "A", 40),
      res("u2", "A", 60), res("u2", "B", 40),
      res("u3", "A", 60), res("u3", "A", 40), res("u3", "B", 0),
    ]);
    expect(r2.ranked.map((e) => [e.userId, e.rank])).toEqual([["u3", 1], ["u1", 2], ["u2", 2]]);
  });

  it("Podest umfasst bei Gleichstand mehr als drei", () => {
    const r = computeRanking(base, members, [res("u1", "A", 90), res("u2", "A", 90), res("u3", "A", 80), res("u4", "A", 80)]);
    expect(r.ranked.map((e) => e.rank)).toEqual([1, 1, 3, 3]);
    expect(podium(r.ranked)).toHaveLength(4);
  });

  it("openSlots zeigt freie Plätze und das schwächste gezählte Resultat", () => {
    const r = computeRanking(base, members, [res("u1", "A", 90), res("u1", "A", 70), res("u1", "B", 50)]);
    const slots = openSlots(r.ranked[0]!);
    expect(slots.find((s) => s.programId === "A")).toMatchObject({ counted: 2, open: 0, weakest: 70 });
    expect(slots.find((s) => s.programId === "B")).toMatchObject({ counted: 1, open: 1, weakest: null });
  });
});

describe("assignRanks", () => {
  it("sortiert bei vollständigem Gleichstand nach Name", () => {
    const out = assignRanks([
      { name: "Zora", total: 10, bestSingle: 5, countedResults: 2 },
      { name: "Adam", total: 10, bestSingle: 5, countedResults: 2 },
    ]);
    expect(out.map((e) => [e.name, e.position])).toEqual([["Adam", 1], ["Zora", 1]]);
  });
});
