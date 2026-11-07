import { describe, expect, it } from "vitest";
import shooting, { frTypography } from "./shooting";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Wörterbuch shooting", () => {
  const de = shooting.de;
  const keys = Object.keys(de);

  it("hat nur Schlüssel im Namensraum «shooting.»", () => {
    expect(keys.length).toBeGreaterThan(300);
    expect(keys.filter((k) => !k.startsWith("shooting."))).toEqual([]);
  });

  it("fr und it haben jeden deutschen Schlüssel (und keine zusätzlichen), alle Texte gefüllt", () => {
    for (const other of [shooting.fr, shooting.it]) {
      expect(keys.filter((k) => !(k in other))).toEqual([]);
      expect(Object.keys(other).filter((k) => !(k in de))).toEqual([]);
      expect(Object.entries(other).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    }
    expect(Object.entries(de).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("Platzhalter stimmen in allen Sprachen überein", () => {
    const mismatches: string[] = [];
    for (const k of keys) {
      const want = placeholders(de[k]!);
      for (const [lang, d] of [["fr", shooting.fr], ["it", shooting.it]] as const) {
        if (JSON.stringify(placeholders(d[k] ?? "")) !== JSON.stringify(want)) mismatches.push(`${lang}:${k}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("Einzahl und Mehrzahl kommen paarweise vor", () => {
    const ones = keys.filter((k) => k.endsWith(".one")).map((k) => k.slice(0, -4));
    const others = keys.filter((k) => k.endsWith(".other")).map((k) => k.slice(0, -6));
    expect(ones.sort()).toEqual(others.sort());
  });

  it("Französisch: schmale geschützte Leerzeichen, Anrede mit «tu»", () => {
    const fr = Object.entries(shooting.fr);
    expect(fr.filter(([, v]) => /«[^ ]|[^ ]»/.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => / [!?;:]/.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => /\b(vous|votre|vos)\b/i.test(v)).map(([k]) => k)).toEqual([]);
    expect(frTypography("Pénalités : « Test » ?")).toBe("Pénalités : « Test » ?");
  });

  it("Schweizer Begriffe: kein ß, Verein = société / società", () => {
    for (const d of [shooting.de, shooting.fr, shooting.it]) expect(Object.values(d).filter((v) => v.includes("ß"))).toEqual([]);
    expect(Object.values(shooting.fr).filter((v) => /\bclub\b/i.test(v.replace(/\{club\}/g, "")))).toEqual([]);
    expect(shooting.fr["shooting.setup.noMembers"]).toContain("société");
    expect(shooting.it["shooting.setup.noMembers"]).toContain("società");
  });

  it("ist über getT erreichbar, Deutsch unverändert", () => {
    expect(getT("de")("shooting.shifts.title")).toBe("Helfereinsätze");
    expect(getT("fr")("shooting.champ.myStanding")).toBe("Mon classement");
    expect(getT("it")("shooting.checkin.title")).toBe("Check-in");
    expect(getT("de")("shooting.entry.finish")).toBe("Durchgang abschliessen");
    expect(getT("fr")("shooting.shifts.staffing", { filled: 2, capacity: 4 })).toBe("2 sur 4");
  });
});
