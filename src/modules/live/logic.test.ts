import { describe, expect, it } from "vitest";
import { diffLive, formatLiveScore, guestDisplayName, isExpired, isPlausibleToken, rankLiveRows, shortName, shortNames, snapshotKey, type LiveRow, type LiveSnapshot } from "./logic";

const row = (id: string, total: number, extra: Partial<LiveRow> = {}): Omit<LiveRow, "rank"> => ({
  id, name: id, isGuest: false, total, shots: 10, maxShots: 10, finished: true, program: null, ...extra,
});

describe("shortName", () => {
  it("kürzt auf Vorname und Initiale", () => {
    expect(shortName("Anna Muster")).toBe("Anna M.");
    expect(shortName("  Anna   Maria  von Gunten ")).toBe("Anna G.");
    expect(shortName("Beat")).toBe("Beat");
    expect(shortName("")).toBe("Unbekannt");
    expect(shortName("élodie über")).toBe("élodie Ü.");
  });
  it("mit mehr Buchstaben", () => {
    expect(shortName("Anna Muster", 2)).toBe("Anna Mu.");
  });
});

describe("shortNames", () => {
  it("unterscheidet gleiche Kürzel", () => {
    expect(shortNames(["Anna Muster", "Anna Meier", "Beat Keller"])).toEqual(["Anna Mu.", "Anna Me.", "Beat K."]);
    expect(shortNames(["Anna Müller", "Anna Mülli"])).toEqual(["Anna Mülle.", "Anna Mülli."]);
  });
  it("lässt gleiche volle Namen gleich", () => {
    expect(shortNames(["Anna Muster", "anna muster"])).toEqual(["Anna M.", "anna M."]);
  });
});

describe("guestDisplayName", () => {
  it("zeigt den Gastnamen oder «Gast»", () => {
    expect(guestDisplayName("  Max  Gast ")).toBe("Max Gast");
    expect(guestDisplayName(null)).toBe("Gast");
  });
});

describe("rankLiveRows", () => {
  it("sortiert nach Total und teilt Ränge", () => {
    const r = rankLiveRows([row("a", 90), row("b", 95), row("c", 90, { finished: false, shots: 8 }), row("d", 80)]);
    expect(r.map((x) => [x.id, x.rank])).toEqual([["b", 1], ["a", 2], ["c", 2], ["d", 4]]);
  });
});

describe("diffLive", () => {
  const a = rankLiveRows([row("a", 90), row("b", 80)]);
  it("erste Liste gilt als geändert, ohne «neu»-Markierung", () => {
    const d = diffLive(null, a);
    expect(d.changed).toBe(true);
    expect(d.added).toEqual([]);
  });
  it("erkennt keine Änderung", () => {
    expect(diffLive(a, rankLiveRows([row("a", 90), row("b", 80)])).changed).toBe(false);
  });
  it("erkennt Überholen, neue und entfernte Zeilen", () => {
    const next = rankLiveRows([row("a", 90), row("b", 95), row("c", 10)]);
    const d = diffLive(a, next);
    expect(d.changed).toBe(true);
    expect(d.movedUp).toEqual(["b"]);
    expect(d.movedDown).toEqual(["a"]);
    expect(d.updated).toEqual(["b"]);
    expect(d.added).toEqual(["c"]);
    const d2 = diffLive(next, rankLiveRows([row("a", 90)]));
    expect(d2.removed.sort()).toEqual(["b", "c"]);
  });
});

describe("snapshotKey", () => {
  it("ignoriert den Zeitstempel", () => {
    const s: LiveSnapshot = { title: "T", clubName: "C", subtitle: "S", showDecimals: false, rows: [], ticker: [], updatedAt: "2026-01-01T00:00:00Z", expiresAt: null };
    expect(snapshotKey(s)).toBe(snapshotKey({ ...s, updatedAt: "2026-01-02T00:00:00Z" }));
    expect(snapshotKey(s)).not.toBe(snapshotKey({ ...s, title: "X" }));
  });
});

describe("Hilfen", () => {
  it("formatLiveScore", () => {
    expect(formatLiveScore(95.44, true)).toBe("95.4");
    expect(formatLiveScore(95.5, false)).toBe("96");
  });
  it("isExpired", () => {
    const now = new Date("2026-05-01T12:00:00Z");
    expect(isExpired(null, now)).toBe(false);
    expect(isExpired(new Date("2026-05-01T11:59:59Z"), now)).toBe(true);
    expect(isExpired("2026-05-02T00:00:00Z", now)).toBe(false);
  });
  it("isPlausibleToken", () => {
    expect(isPlausibleToken("abcdefghijABCDEFGHIJ_-0123456789abcdefghijk")).toBe(true);
    expect(isPlausibleToken("../etc")).toBe(false);
    expect(isPlausibleToken(undefined)).toBe(false);
  });
});
