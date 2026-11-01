import { describe, expect, it } from "vitest";
import money from "./money";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Wörterbuch money", () => {
  const de = money.de;
  const keys = Object.keys(de);

  it("hat nur Schlüssel im Namensraum «money.»", () => {
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.filter((k) => !k.startsWith("money."))).toEqual([]);
  });

  it("fr und it haben jeden deutschen Schlüssel (und keine zusätzlichen)", () => {
    for (const other of [money.fr, money.it]) {
      expect(keys.filter((k) => !(k in other))).toEqual([]);
      expect(Object.keys(other).filter((k) => !(k in de))).toEqual([]);
      expect(Object.entries(other).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    }
  });

  it("Platzhalter stimmen in allen Sprachen überein", () => {
    const mismatches: string[] = [];
    for (const k of keys) {
      const want = placeholders(de[k]!);
      for (const [lang, d] of [["fr", money.fr], ["it", money.it]] as const) {
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

  it("Französisch: Guillemets mit geschütztem Leerzeichen, Anrede mit «tu»", () => {
    const fr = Object.entries(money.fr);
    expect(fr.filter(([, v]) => /«[^  ]|[^  ]»/.test(v)).map(([k]) => k)).toEqual([]);
    // «rendez-vous» ist keine Anrede
    expect(fr.filter(([, v]) => /(?<!-)\b(vous|votre|vos)\b/i.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => / [!?;:]/.test(v)).map(([k]) => k)).toEqual([]);
  });

  it("Schweizer Begriffe: Verein = société / società, kein ß", () => {
    expect(Object.values(money.de).filter((v) => v.includes("ß"))).toEqual([]);
    expect(Object.values(money.fr).filter((v) => /\bclub\b/i.test(v.replace(/\{club\}/g, "")))).toEqual([]);
    expect(money.fr["money.payments.noModule.title"]).toContain("société");
    expect(money.it["money.payments.noModule.title"]).toContain("società");
  });

  it("ist über getT erreichbar", () => {
    expect(getT("de")("money.payments.title")).toBe("Zahlungen");
    expect(getT("fr")("money.payments.title")).toBe("Paiements");
    expect(getT("it")("money.payments.title")).toBe("Pagamenti");
    expect(getT("fr")("money.events.detail.seatsTaken", { taken: 3, capacity: 10 })).toBe("3 places sur 10 occupées");
  });
});
