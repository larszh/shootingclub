import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZONES,
  firedShots,
  maxShotValue,
  normalizeStages,
  penaltyValues,
  programInputSchema,
  programTotals,
  sanitizeShots,
  stageEntryLimit,
  stageTotal,
  validateZones,
  zoneForValue,
  type Stage,
} from "./types";
import { countZeros, participantTotals, plannedShotsForStages, totalsChanged } from "./totals";

const rings: Stage = { name: "S1", distanceM: 25, shots: 5, maxPerShot: 10 };
const zones: Stage = { name: "Z", distanceM: 10, shots: 4, maxPerShot: 5, zones: DEFAULT_ZONES };

describe("sanitizeShots", () => {
  it("Ringe: rundet, kappt am Maximum, verwirft negative und Ungültiges", () => {
    expect(sanitizeShots([10, 9.4, 12, -1, "x"], rings, "RINGS_INT")).toEqual([10, 9, 10]);
  });

  it("betrachtet höchstens so viele Einträge wie die Serie Schüsse hat", () => {
    expect(sanitizeShots([7, 8, 9, 10, 6, 5, 4], rings, "RINGS_INT")).toEqual([7, 8, 9, 10, 6]);
  });

  it("Zehntel: bis Maximalring + 0.9", () => {
    expect(sanitizeShots([10.94, 11.5, 9.35], { ...rings, shots: 3 }, "RINGS_DECIMAL")).toEqual([10.9, 10.9, 9.4]);
  });

  it("Treffer/Fehler: 1 oder 0", () => {
    expect(sanitizeShots([1, 0, 5, 0.2], { ...rings, shots: 4 }, "HITS")).toEqual([1, 0, 1, 0]);
  });

  it("Zonen: nur Zonenwerte, Strafen ohne Schuss belegen keinen Schussplatz", () => {
    // 4 Schüsse + 2 Verfahrensfehler (-5) erlaubt; Wert 2 ist keine Zone
    expect(sanitizeShots([5, -5, 3, 2, 1, -5, 0, 5], zones, "ZONES")).toEqual([5, -5, 3, 1, -5, 0]);
    expect(sanitizeShots([5.0, 3.5], zones, "ZONES")).toEqual([5]);
  });

  it("behält bereits gespeicherte Werte an derselben Stelle", () => {
    expect(sanitizeShots([12], rings, "RINGS_INT", [12])).toEqual([12]);
  });

  it("verwirft Nicht-Arrays", () => {
    expect(sanitizeShots("10,9", rings, "RINGS_INT")).toEqual([]);
  });
});

describe("Zonen-Hilfsfunktionen", () => {
  it("Strafen, abgegebene Schüsse und Limit", () => {
    expect([...penaltyValues(zones, "ZONES")]).toEqual([-5]);
    expect(penaltyValues(zones, "RINGS_INT").size).toBe(0);
    expect(firedShots(zones, [5, -5, 3, -10], "ZONES")).toBe(3);
    expect(stageEntryLimit(zones, "ZONES")).toBe(24);
    expect(stageEntryLimit(rings, "RINGS_INT")).toBe(5);
    expect(zoneForValue(zones, -10)?.key).toBe("NS");
    expect(maxShotValue(zones, "ZONES")).toBe(5);
  });

  it("validateZones", () => {
    expect(validateZones(DEFAULT_ZONES)).toBeNull();
    expect(validateZones([])).toMatch(/Mindestens/);
    expect(validateZones([{ key: "A", label: "A", points: 5 }, { key: "a", label: "B", points: 3 }])).toMatch(/Kürzel/);
    expect(validateZones([{ key: "A", label: "A", points: 5 }, { key: "B", label: "B", points: 5 }])).toMatch(/Punktwert/);
    expect(validateZones([{ key: "A", label: "A", points: 0 }])).toMatch(/positive/);
    expect(validateZones([{ key: "A", label: "A", points: 5 }, { key: "P", label: "P", points: 2, penalty: true }])).toMatch(/negative/);
  });

  it("normalizeStages setzt Zonen nur bei Zonenwertung", () => {
    const [z] = normalizeStages([{ ...rings }], "ZONES");
    expect(z!.zones).toHaveLength(DEFAULT_ZONES.length);
    expect(z!.maxPerShot).toBe(5);
    const [h] = normalizeStages([{ ...zones }], "HITS");
    expect(h!.zones).toBeUndefined();
    expect(h!.maxPerShot).toBe(1);
  });
});

describe("Totale", () => {
  it("stageTotal rundet auf Zehntel (inkl. Strafpunkte)", () => {
    expect(stageTotal([10.1, 10.2, 9.9])).toBe(30.2);
    expect(stageTotal([5, -5, 3])).toBe(3);
    expect(stageTotal([])).toBe(0);
  });

  it("programTotals je Wertung", () => {
    const stages = [rings, { ...rings, distanceM: 50 }];
    expect(programTotals(stages, "RINGS_INT")).toEqual({ shots: 10, max: 100, distances: [25, 50] });
    expect(programTotals(stages, "RINGS_DECIMAL").max).toBe(109);
    expect(programTotals([zones], "ZONES")).toEqual({ shots: 4, max: 20, distances: [10] });
  });

  it("programInputSchema normalisiert Serien", () => {
    const r = programInputSchema.safeParse({ name: "Test", discipline: "OTHER", scoringMode: "ZONES", stages: [{ name: "A", distanceM: 25, shots: 5, maxPerShot: 10 }] });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.stages[0]!.zones).toHaveLength(DEFAULT_ZONES.length);
      expect(r.data.stages[0]!.maxPerShot).toBe(5);
    }
    expect(programInputSchema.safeParse({ name: "T", discipline: "PISTOL", scoringMode: "RINGS_INT", stages: [] }).success).toBe(false);
  });
});

describe("participantTotals (gespeicherte Kennzahlen)", () => {
  it("summiert Serien und zählt Nuller", () => {
    const res = participantTotals([
      { shotsJson: "[10,0,9,0]", total: 19 },
      { shotsJson: "[8.5,0,10.1]", total: 18.6 },
    ]);
    expect(res).toEqual({ total: 37.6, zeros: 3 });
  });

  it("Zonen: Strafen (negativ) sind keine Nuller", () => {
    expect(participantTotals([{ shotsJson: "[5,-5,0,-10]", total: -10 }])).toEqual({ total: -10, zeros: 1 });
  });

  it("ohne Serien null, kaputtes JSON zählt keine Nuller", () => {
    expect(participantTotals([])).toEqual({ total: null, zeros: null });
    expect(participantTotals([{ shotsJson: "kaputt", total: 7 }])).toEqual({ total: 7, zeros: 0 });
  });

  it("countZeros, totalsChanged, plannedShotsForStages", () => {
    expect(countZeros([0, 1, 0, 0.0, -1])).toBe(3);
    expect(totalsChanged({ total: 1, zeros: 0 }, { total: 1, zeros: 0 })).toBe(false);
    expect(totalsChanged({ total: null, zeros: null }, { total: 0, zeros: 0 })).toBe(true);
    expect(plannedShotsForStages([0, 2, 5], [5, 10, 20])).toBe(25);
  });
});
