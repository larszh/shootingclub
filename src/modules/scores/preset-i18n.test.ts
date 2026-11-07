import { describe, expect, it } from "vitest";
import { PROGRAM_PRESETS } from "./presets";
import { localizeProgram, localizedProgramDescription, localizedProgramName, localizedStageName, PRESET_TRANSLATION_KEYS } from "./preset-i18n";

const DISTANCE_ONLY = /^\d+ m$/;
const SAME_IN_IT = /^(\d+ s – )?Serie( \d+( s)?)?$/;

describe("Übersetzung der eingebauten Programme", () => {
  it("jede Vorlage hat Name und Beschreibung auf Französisch, Italienisch und Englisch", () => {
    expect(PROGRAM_PRESETS.map((p) => p.name).filter((n) => !PRESET_TRANSLATION_KEYS.includes(n))).toEqual([]);
    for (const p of PROGRAM_PRESETS) {
      for (const lang of ["fr", "it", "en"] as const) {
        expect(localizedProgramName(p.name, lang)).not.toBe(p.name);
        if (p.description) expect(localizedProgramDescription(p.name, p.description, lang)).not.toBe(p.description);
      }
    }
  });

  it("alle Seriennamen der Vorlagen werden übersetzt (reine Distanzen bleiben)", () => {
    const missing: string[] = [];
    for (const p of PROGRAM_PRESETS) {
      for (const s of p.stages) {
        if (DISTANCE_ONLY.test(s.name)) continue;
        if (localizedStageName(s.name, "fr") === s.name) missing.push(`fr:${s.name}`);
        // «Serie» heisst auf Italienisch gleich
        if (!SAME_IN_IT.test(s.name) && localizedStageName(s.name, "it") === s.name) missing.push(`it:${s.name}`);
        if (localizedStageName(s.name, "en") === s.name) missing.push(`en:${s.name}`);
      }
    }
    expect(missing).toEqual([]);
    expect(localizedStageName("Serie 3", "fr")).toBe("Série 3");
    expect(localizedStageName("20 s – Serie 1", "it")).toBe("20 s – serie 1");
    expect(localizedStageName("Durchgang 2", "fr")).toBe("Passage 2");
    expect(localizedStageName("Serie 3", "en")).toBe("Series 3");
    expect(localizedStageName("20 s – Serie 1", "en")).toBe("20 s – series 1");
    expect(localizedStageName("Einzelschüsse", "en")).toBe("Single shots");
  });

  it("Deutsch und eigene/geänderte Texte bleiben unverändert", () => {
    expect(localizedProgramName("Freies Training – 10 Schuss", "de")).toBe("Freies Training – 10 Schuss");
    expect(localizedProgramName("Freies Training – 10 Schuss", "fr")).toBe("Entraînement libre – 10 coups");
    expect(localizedProgramName("Mein Vereinsprogramm", "fr")).toBe("Mein Vereinsprogramm");
    expect(localizedProgramDescription("Freies Training – 10 Schuss", "Eigene Beschreibung", "it")).toBe("Eigene Beschreibung");
    expect(localizedStageName("Eigene Serie", "fr")).toBe("Eigene Serie");
  });

  it("Französisch: schmale geschützte Leerzeichen vor dem Doppelpunkt, kein «vous»", () => {
    for (const p of PROGRAM_PRESETS) {
      const d = localizedProgramDescription(p.name, p.description ?? null, "fr") ?? "";
      expect(d).not.toMatch(/ [!?;:]/);
      expect(d).not.toMatch(/\b(vous|votre|vos)\b/i);
    }
  });

  it("localizeProgram übersetzt Name, Beschreibung und Serien und lässt den Rest", () => {
    const preset = PROGRAM_PRESETS.find((p) => p.key === "crossbow-10-30")!;
    const view = { id: "x", name: preset.name, description: preset.description ?? null, stages: preset.stages, scoringMode: preset.scoringMode };
    const fr = localizeProgram(view, "fr");
    expect(fr.name).toBe("Arbalète 10 m – 30 coups");
    expect(fr.description).toContain("Arbalète 10 m\u202f: 3 séries");
    expect(fr.stages.map((s) => s.name)).toEqual(["Série 1", "Série 2", "Série 3"]);
    expect(fr.scoringMode).toBe(view.scoringMode);
    expect(localizeProgram(view, "de")).toBe(view);
    const en = localizeProgram(view, "en");
    expect(en.name).toBe("Crossbow 10 m – 30 shots");
    expect(en.stages.map((s) => s.name)).toEqual(["Series 1", "Series 2", "Series 3"]);
  });
});
