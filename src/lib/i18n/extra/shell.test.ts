import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import dict, { frenchSpacing } from "./shell";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Quelltexte der Bereiche, die das Wörterbuch «shell» verwenden. */
const ROOT = join(__dirname, "../../../..");
const SOURCE_DIRS = [
  "src/components",
  "src/app/(auth)",
  "src/app/(app)/me",
  "src/app/(app)/(home)",
  "src/app/(app)/help",
  "src/app/offline",
];
const SOURCE_FILES = ["src/app/layout.tsx", "src/app/(app)/layout.tsx", "src/app/not-found.tsx", "src/app/error.tsx", "src/app/global-error.tsx"];

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [rel] : [];
  });
}

describe("Wörterbuch «shell»", () => {
  const de = dict.de;

  it("hat Einträge und nur Schlüssel mit Präfix shell.", () => {
    expect(Object.keys(de).length).toBeGreaterThan(300);
    expect(Object.keys(de).filter((k) => !k.startsWith("shell."))).toEqual([]);
  });

  it("fr und it haben jeden deutschen Schlüssel, keine leeren Texte", () => {
    for (const lang of [dict.fr, dict.it]) {
      expect(Object.keys(de).filter((k) => !(k in lang))).toEqual([]);
      expect(Object.keys(lang).filter((k) => !(k in de))).toEqual([]);
      expect(Object.entries(lang).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    }
    expect(Object.entries(de).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("Platzhalter stimmen in allen Sprachen überein", () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(de)) {
      const p = placeholders(v);
      if (JSON.stringify(placeholders(dict.fr[k] ?? "")) !== JSON.stringify(p)) bad.push(`fr:${k}`);
      if (JSON.stringify(placeholders(dict.it[k] ?? "")) !== JSON.stringify(p)) bad.push(`it:${k}`);
    }
    expect(bad).toEqual([]);
  });

  it("Französisch: Guillemets mit schmalem geschütztem Leerzeichen, Doppelpunkt geschützt", () => {
    const fr = Object.entries(dict.fr);
    expect(fr.filter(([, v]) => /«(?! )|(?<! )»/.test(v)).map(([k]) => k)).toEqual([]);
    expect(fr.filter(([, v]) => / [:;?!]/.test(v)).map(([k]) => k)).toEqual([]);
    // Deutsch und Italienisch: Guillemets ohne Leerzeichen innen
    for (const lang of [dict.de, dict.it]) {
      expect(Object.entries(lang).filter(([, v]) => /« | »/.test(v)).map(([k]) => k)).toEqual([]);
    }
  });

  it("frenchSpacing setzt die Leerzeichen", () => {
    expect(frenchSpacing("« Plus »")).toBe("« Plus »");
    expect(frenchSpacing("«Plus»")).toBe("« Plus »");
    expect(frenchSpacing("Note : ok")).toBe("Note : ok");
    expect(frenchSpacing("Vraiment ?")).toBe("Vraiment ?");
    expect(frenchSpacing("https://x.ch")).toBe("https://x.ch");
  });

  it("wird von getT gefunden, deutsche Texte bleiben", () => {
    expect(getT("de")("shell.nav.more")).toBe("Mehr");
    expect(getT("fr")("shell.nav.more")).toBe("Plus");
    expect(getT("it")("shell.nav.more")).toBe("Altro");
    expect(getT("fr")("shell.home.cards.op", { year: 2026 })).toBe("Tir obligatoire 2026");
  });

  it("alle im Code verwendeten Schlüssel existieren", () => {
    const files = [...SOURCE_DIRS.flatMap(walk), ...SOURCE_FILES];
    const missing = new Set<string>();
    for (const f of files) {
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const m of src.matchAll(/["`](shell\.[A-Za-z0-9_.]+)["`]/g)) {
        const key = m[1]!;
        if (key.endsWith(".")) continue; // dynamisch zusammengesetzt (Template-String)
        if (!(key in de)) missing.add(`${f}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
