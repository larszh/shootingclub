import { describe, expect, it } from "vitest";
import { PROGRAM_PRESETS, presetNames, presetOfficialUpdate } from "./presets";
import { programInputSchema } from "./types";

describe("PROGRAM_PRESETS", () => {
  it("sind gültige Programme", () => {
    for (const p of PROGRAM_PRESETS) {
      const r = programInputSchema.safeParse(p);
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
    // Keine vorbelegte Grenze: 42 Punkte / 3 Nuller passen nicht zur Ringwertung (10er) der Vorlage
    expect(op?.passMinScore ?? null).toBeNull();
    expect(op?.passMaxZeros ?? null).toBeNull();
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
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: null, passMaxZeros: null }, op)).toEqual({ officialKind: "OP" });
  });

  it("entfernt die früher vorbelegte Grenze 42/3, aber keine eigenen Grenzen", () => {
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: 42, passMaxZeros: 3 }, op)).toEqual({ passMinScore: null, passMaxZeros: null });
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: 42, passMaxZeros: 3 }, op)).toEqual({ officialKind: "OP", passMinScore: null, passMaxZeros: null });
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: 42, passMaxZeros: 2 }, op)).toBeNull();
  });

  it("überschreibt keine Anpassungen und ist idempotent", () => {
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: 40, passMaxZeros: 2 }, op)).toBeNull();
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: 45, passMaxZeros: null }, op)).toEqual({ officialKind: "OP" });
  });

  it("ersetzt nur eine unveränderte frühere Beschreibung", () => {
    const old = op.legacyDescriptions![0]!;
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: null, passMaxZeros: null, description: old }, op)).toEqual({ description: op.description });
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: null, passMaxZeros: null, description: "Eigener Text" }, op)).toBeNull();
    expect(presetOfficialUpdate({ officialKind: "OP", passMinScore: null, passMaxZeros: null, description: op.description }, op)).toBeNull();
  });

  it("ändert nichts bei Vorlagen ohne amtliche Art", () => {
    const free = PROGRAM_PRESETS.find((p) => !p.officialKind)!;
    expect(presetOfficialUpdate({ officialKind: null, passMinScore: null, passMaxZeros: null }, free)).toBeNull();
  });
});
