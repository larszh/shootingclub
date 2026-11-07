import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import dict, { frSpacing, ROWS } from "./admin2";
import { dayKeyLabel, msg, tMsg } from "./admin2/msg";
import { getT } from "../core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

const ROOT = join(__dirname, "../../../..");
/** Quelltexte, die das Wörterbuch «admin2» verwenden. */
const SOURCE_DIRS = [
  "src/app/(app)/admin/range",
  "src/app/(app)/admin/shifts",
  "src/app/(app)/admin/qualifications",
  "src/app/(app)/admin/weapons",
  "src/app/(app)/admin/live",
  "src/app/(app)/admin/embed",
  "src/app/(app)/admin/association",
  "src/app/(app)/range",
  "src/app/(app)/federal",
  "src/app/(app)/weapons",
  "src/app/(app)/shifts",
  "src/app/(app)/courses",
  "src/app/(app)/championship",
  "src/app/(app)/super",
  "src/app/(app)/association",
  "src/app/range",
  "src/app/federal",
  "src/app/weapons",
  "src/app/courses",
  "src/app/championship",
  "src/modules/range",
  "src/modules/federal",
  "src/modules/weapons",
  "src/modules/shifts",
  "src/modules/courses",
  "src/modules/championship",
  "src/modules/qualifications",
  "src/modules/live",
  "src/modules/embed",
  "src/modules/association",
  "src/modules/targets",
];
const PART_DIR = "src/lib/i18n/extra/admin2";

function walk(dir: string): string[] {
  const abs = join(ROOT, dir);
  let names: string[];
  try {
    names = readdirSync(abs);
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [rel] : [];
  });
}

describe("Wörterbuch «admin2»", () => {
  const de = dict.de;

  it("hat Einträge und nur Schlüssel mit Präfix adm2.", () => {
    expect(Object.keys(de).length).toBeGreaterThan(500);
    expect(Object.keys(de).filter((k) => !k.startsWith("adm2."))).toEqual([]);
  });

  it("Teil-Dateien haben keine doppelten Schlüssel", () => {
    // Die Teile werden zusammengeführt; ein doppelter Schlüssel würde still überschrieben.
    const all: string[] = [];
    for (const name of readdirSync(join(ROOT, PART_DIR))) {
      if (!name.endsWith(".ts") || name === "row.ts" || name === "msg.ts") continue;
      const src = readFileSync(join(ROOT, PART_DIR, name), "utf8");
      all.push(...[...src.matchAll(/^\s*"(adm2\.[^"]+)":\s*\[/gm)].map((m) => m[1]!));
    }
    expect(all.length).toBe(Object.keys(ROWS).length);
    expect(all.filter((k, i) => all.indexOf(k) !== i)).toEqual([]);
  });

  it("fr, it und en haben jeden deutschen Schlüssel, keine leeren Texte", () => {
    for (const lang of [dict.fr, dict.it, dict.en]) {
      expect(Object.keys(de).filter((k) => !(k in lang))).toEqual([]);
      expect(Object.keys(lang).filter((k) => !(k in de))).toEqual([]);
      expect(Object.entries(lang).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    }
    expect(Object.entries(de).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
  });

  it("Platzhalter stimmen in allen Sprachen überein", () => {
    const bad: string[] = [];
    for (const [key, text] of Object.entries(de)) {
      const want = placeholders(text);
      for (const [name, lang] of [["fr", dict.fr], ["it", dict.it], ["en", dict.en]] as const) {
        if (JSON.stringify(placeholders(lang[key]!)) !== JSON.stringify(want)) bad.push(`${name}:${key}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("Mehrzahl: zu jedem .one gibt es ein .other", () => {
    const ones = Object.keys(de).filter((k) => k.endsWith(".one"));
    expect(ones.filter((k) => !(`${k.slice(0, -4)}.other` in de))).toEqual([]);
  });

  it("Französisch: schmale geschützte Leerzeichen vor : ; ! ? und in Guillemets", () => {
    expect(frSpacing("Vraiment ? «oui» : non !")).toBe("Vraiment ? « oui » : non !");
    const bad = Object.entries(dict.fr).filter(([, v]) => / [?!;:](\s|$)/.test(v) || /« | »/.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("alle im Code verwendeten Schlüssel existieren", () => {
    const missing = new Set<string>();
    for (const file of SOURCE_DIRS.flatMap(walk)) {
      const src = readFileSync(join(ROOT, file), "utf8");
      for (const m of src.matchAll(/["'`](adm2\.[A-Za-z0-9_.]+)["'`|]/g)) {
        const key = m[1]!;
        if (key.endsWith(".")) continue; // dynamisch zusammengesetzt
        if (!(key in de) && !(`${key}.one` in de)) missing.add(`${file}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("getT liefert die Texte aller Sprachen, Deutsch unverändert", () => {
    const [key, row] = Object.entries(ROWS).find(([, r]) => placeholders(r[0]).length === 0)!;
    expect(getT("de")(key)).toBe(row[0]);
    expect(getT("fr")(key)).toBe(frSpacing(row[1]));
    expect(getT("it")(key)).toBe(row[2]);
    expect(getT("en")(key)).toBe(row[3]);
  });

  it("msg/tMsg tragen Platzhalter durch Schemas", () => {
    const withVars = Object.entries(de).find(([, v]) => placeholders(v).length === 1)!;
    const name = placeholders(withVars[1])[0]!;
    const t = getT("en");
    expect(tMsg(t, msg(withVars[0], { [name]: 42 }))).toBe(t(withVars[0], { [name]: 42 }));
    expect(tMsg(t, withVars[0].replace(/^/, ""))).toBe(t(withVars[0]));
    expect(tMsg(t, null)).toBe("");
  });

  it("dayKeyLabel formatiert Kalendertage je Sprache", () => {
    expect(dayKeyLabel("2026-03-05", "de")).toMatch(/05?\.0?3\.2026/);
    expect(dayKeyLabel("2026-03-05", "en")).toMatch(/2026/);
    expect(dayKeyLabel("kaputt", "fr")).toBe("");
    expect(dayKeyLabel(null, "it")).toBe("");
  });
});
