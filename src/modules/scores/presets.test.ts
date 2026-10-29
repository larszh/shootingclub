import { describe, expect, it } from "vitest";
import { PROGRAM_PRESETS, presetNames, presetOfficialUpdate } from "./presets";
import { programInputSchema } from "./types";

describe("PROGRAM_PRESETS", () => {
  it("sind gültige Programme", () => {
    for (const p of PROGRAM_PRESETS) {
      const { key: _key, aliases: _aliases, ...input } = p;
      const r = programInputSchema.safeParse(input);
      expect(r.success, `${p.name}: ${r.success ? "" : r.error.issues[0]?.message}`).toBe(true);
    }
  });

  it("haben eindeutige Namen und Schlüssel", () => {
    const names = PROGRAM_PRESETS.flatMap(presetNames);
    expect(new Set(names).size).toBe(names.length);
    const keys = PROGRAM_PRESETS.map((p) => p.key).filter(Boolean);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("markieren Obligatorisch und Feldschiessen", () => {
    const op = PROGRAM_PRESETS.find((p) => p.key === "op-300");
    expect(op?.officialKind).toBe("OP");
    expect(op?.passMinScore).toBe(42);
    expect(op?.passMaxZeros).toBe(3);
    const pistol = PROGRAM_PRESETS.find((p) => p.key === "op-25-pistol");
    expect(pistol?.officialKind).toBe("OP");
    expect(pistol?.passMinScore ?? null).toBeNull();
    expect(PROGRAM_PRESETS.filter((p) => p.officialKind === "FS").length).toBeGreaterThanOrEqual(2);
    for (const fs of PROGRAM_PRESETS.filter((p) => p.officialKind === "FS")) expect(fs.passMinScore ?? null).toBeNull();
  });

  it("enthalten Armbrust-Vorschläge", () => {
    const xb = PROGRAM_PRESETS.filter((p) => p.discipline === "CROSSBOW");
    expect(xb.map((p) => p.name)).toEqual(["Armbrust 10 m – 30 Schuss", "Armbrust 30 m – 30 Schuss", "Armbrust 10 m – Probe + 20"]);
    for (const p of xb) expect(p.description).toContain("bitte Reglement prüfen");
  });
});

describe("presetOfficialUpdate", () => {
  const op = PROGRAM_PRESETS.find((p) => p.key === "op-300")!;

  it("setzt die amtliche Art bei bestehenden Programmen ohne Art", () => {
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: null, passMaxZeros: null }, op)).toEqual({ officialKind: "OP", passMinScore: 42, passMaxZeros: 3 });
  });

  it("überschreibt keine Anpassungen und ist idempotent", () => {
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: 40, passMaxZeros: 2 }, op)).toBeNull();
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: 45, passMaxZeros: null }, op)).toEqual({ officialKind: "OP", passMinScore: 45, passMaxZeros: 3 });
  });

  it("ändert nichts bei Vorlagen ohne amtliche Art", () => {
    const free = PROGRAM_PRESETS.find((p) => !p.officialKind)!;
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: null, passMaxZeros: null }, free)).toBeNull();
  });
});
