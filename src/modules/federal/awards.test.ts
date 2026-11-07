import { describe, expect, it } from "vitest";
import { fsAwardExample } from "@/modules/scores/presets";
import {
  awardFor,
  awardLimitsToText,
  awardLinesToRows,
  bestPerShooter,
  buildAwardsCsv,
  countAwards,
  formatAwardCategory,
  parseAwardCategory,
  parseAwardLines,
  type AwardLimitLite,
} from "./awards";

describe("Kategorien", () => {
  it("formatiert und liest Altersgrenzen", () => {
    const cases = [
      { name: "U21", minAge: null, maxAge: 20 },
      { name: "Elite", minAge: 21, maxAge: 59 },
      { name: "Veteranen", minAge: 60, maxAge: null },
      { name: "Alle", minAge: null, maxAge: null },
      { name: "Jg 2010", minAge: 16, maxAge: 16 },
    ];
    expect(cases.map(formatAwardCategory)).toEqual(["U21 (bis 20)", "Elite (21–59)", "Veteranen (ab 60)", "Alle", "Jg 2010 (16)"]);
    for (const c of cases) expect(parseAwardCategory(formatAwardCategory(c))).toEqual(c);
  });

  it("nimmt unbekannte Formate als Namen ohne Alter", () => {
    expect(parseAwardCategory("Sturmgewehr 90")).toEqual({ name: "Sturmgewehr 90", minAge: null, maxAge: null });
    expect(parseAwardCategory("Elite (21-59)")).toEqual({ name: "Elite", minAge: 21, maxAge: 59 });
  });
});

describe("parseAwardLines", () => {
  it("liest gültige Zeilen und ignoriert Kommentare", () => {
    const r = parseAwardLines("# Beispiel\nElite;21;59;57;Kranz\n\nElite;21;59;54,5;Anerkennungskarte\nAlle;;;50;Karte", 90);
    expect(r.errors).toEqual([]);
    expect(r.lines).toEqual([
      { name: "Elite", minAge: 21, maxAge: 59, minScore: 57, award: "Kranz" },
      { name: "Elite", minAge: 21, maxAge: 59, minScore: 54.5, award: "Anerkennungskarte" },
      { name: "Alle", minAge: null, maxAge: null, minScore: 50, award: "Karte" },
    ]);
  });

  it("meldet Fehler mit Zeilennummer", () => {
    const r = parseAwardLines(
      ["Elite;21;59;57", "Elite;21;59;x;Kranz", "Elite;30;20;50;Kranz", "Elite;21;59;95;Kranz", "Elite;21;59;57;Kranz", "Elite;20;59;55;Karte", "Elite;21;59;56;kranz", "U(21);;20;50;Kranz", ";;;50;Kranz", "Jugend;;20;50;"].join("\n"),
      90,
    );
    expect(r.lines).toHaveLength(1);
    expect(r.errors).toEqual([
      expect.stringContaining("Zeile 1: genau fünf Felder"),
      "Zeile 2: Limite als Zahl angeben.",
      "Zeile 3: «Alter von» ist grösser als «Alter bis».",
      expect.stringContaining("Zeile 4: Limite 95 ist höher"),
      "Zeile 6: Kategorie «Elite» ist schon mit einem anderen Alter erfasst.",
      "Zeile 7: «kranz» in der Kategorie «Elite» doppelt.",
      expect.stringContaining("Zeile 8: Kategorie ohne Klammern"),
      "Zeile 9: Kategorie fehlt.",
      expect.stringContaining("Zeile 10: Auszeichnung fehlt"),
    ]);
  });

  it("Rundreise Text → Datensätze → Text", () => {
    const text = "Jugend;;20;55;Kranz\nElite;21;59;57;Kranz\nVeteranen;60;;54.5;Kranz";
    const rows = awardLinesToRows(parseAwardLines(text).lines);
    expect(rows.map((r) => r.category)).toEqual(["Jugend (bis 20)", "Elite (21–59)", "Veteranen (ab 60)"]);
    expect(awardLimitsToText(rows)).toBe(text);
  });

  it("Beispiel-Vorbelegung ist als Beispiel markiert und gültig", () => {
    const ex = fsAwardExample(90);
    expect(ex.split("\n")[0]).toContain("Beispiel, bitte prüfen");
    const r = parseAwardLines(ex, 90);
    expect(r.errors).toEqual([]);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(parseAwardLines(fsAwardExample(180), 180).errors).toEqual([]);
  });
});

describe("awardFor", () => {
  const limits: AwardLimitLite[] = awardLinesToRows(
    parseAwardLines("Jugend;;20;55;Kranz\nJugend;;20;51;Anerkennungskarte\nElite;21;59;57;Kranz\nElite;21;59;53;Anerkennungskarte\nVeteranen;60;;55;Kranz").lines,
  );

  it("wählt Kategorie nach Jahrgang und die höchste erreichte Limite", () => {
    expect(awardFor(limits, 58, 1990, 2026)).toMatchObject({ status: "award", award: "Kranz", category: "Elite (21–59)" });
    expect(awardFor(limits, 56, 1990, 2026)).toMatchObject({ status: "award", award: "Anerkennungskarte" });
    expect(awardFor(limits, 52, 1990, 2026)).toMatchObject({ status: "none", award: null, category: "Elite (21–59)" });
    // Jahrgang 2006 im Jahr 2026 = 20 → Jugend
    expect(awardFor(limits, 55, 2006, 2026)).toMatchObject({ status: "award", award: "Kranz", category: "Jugend (bis 20)" });
    // Jahrgang 2005 = 21 → Elite
    expect(awardFor(limits, 55, 2005, 2026)).toMatchObject({ status: "award", award: "Anerkennungskarte", category: "Elite (21–59)" });
    expect(awardFor(limits, 55, 1950, 2026)).toMatchObject({ status: "award", award: "Kranz", category: "Veteranen (ab 60)" });
  });

  it("Limite genau erreicht zählt", () => {
    expect(awardFor(limits, 57, 1990, 2026).award).toBe("Kranz");
  });

  it("ohne Geburtsdatum nur Kategorien ohne Alter", () => {
    expect(awardFor(limits, 80, null, 2026).status).toBe("no-category");
    const withAll = [...limits, ...awardLinesToRows(parseAwardLines("Alle;;;60;Kranz").lines)];
    expect(awardFor(withAll, 61, null, 2026)).toMatchObject({ status: "award", category: "Alle" });
    // mit Geburtsdatum gilt die engere Kategorie vor «Alle»
    expect(awardFor(withAll, 61, 1990, 2026)).toMatchObject({ category: "Elite (21–59)" });
  });

  it("ohne Limiten keine Berechnung", () => {
    expect(awardFor([], 90, 1990, 2026).status).toBe("no-limits");
  });

  it("zählt Auszeichnungen", () => {
    const r = [awardFor(limits, 58, 1990, 2026), awardFor(limits, 59, 1991, 2026), awardFor(limits, 54, 1990, 2026), awardFor(limits, 10, 1990, 2026)];
    expect(countAwards(r)).toEqual([{ award: "Kranz", count: 2 }, { award: "Anerkennungskarte", count: 1 }]);
  });
});

describe("bestPerShooter", () => {
  it("bevorzugt amtliche, sonst das beste Resultat", () => {
    const rows = [
      { id: "a", programId: "p", shooterKey: "u1", total: 70, zeros: 0, isOfficial: false },
      { id: "b", programId: "p", shooterKey: "u1", total: 60, zeros: 1, isOfficial: true },
      { id: "c", programId: "p", shooterKey: "u2", total: 60, zeros: 2, isOfficial: false },
      { id: "d", programId: "p", shooterKey: "u2", total: 60, zeros: 1, isOfficial: false },
      { id: "e", programId: "q", shooterKey: "u2", total: 50, zeros: 0, isOfficial: false },
    ];
    expect(bestPerShooter(rows).map((r) => r.id).sort()).toEqual(["b", "d", "e"]);
  });
});

describe("buildAwardsCsv", () => {
  it("BOM, Semikolon und Formelschutz", () => {
    const csv = buildAwardsCsv([
      { name: "=Test", birthYear: 1990, program: "FS 300", total: 58, zeros: 1, isOfficial: true, isGuest: false, date: "01.06.2026", result: awardFor([{ category: "Alle", minScore: 50, award: "Kranz" }], 58, 1990, 2026) },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const line = csv.split("\r\n")[1]!;
    expect(line).toBe("'=Test;1990;FS 300;Alle;58;1;Kranz;ja;nein;01.06.2026");
  });
});

describe("Beispiel-Limiten", () => {
  it("erkennt die Markierung in Auszeichnung oder Kategorie", async () => {
    const { AWARD_EXAMPLE_MARK, isExampleLimits } = await import("@/modules/federal/awards");
    const { DEMO_AWARD_EXAMPLE_MARK } = await import("@/modules/federal/seed");
    expect(DEMO_AWARD_EXAMPLE_MARK).toBe(AWARD_EXAMPLE_MARK);
    expect(isExampleLimits([{ category: "Elite (21–59)", award: `Kranz ${AWARD_EXAMPLE_MARK}` }])).toBe(true);
    expect(isExampleLimits([{ category: "Beispiel", award: "Kranz" }])).toBe(true);
    expect(isExampleLimits([{ category: "Elite (21–59)", award: "Kranz" }])).toBe(false);
    expect(isExampleLimits([])).toBe(false);
  });
});
