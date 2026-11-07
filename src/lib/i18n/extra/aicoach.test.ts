import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import dict from "./aicoach";
import { SCORE_FIELDS, SCORE_PRESET_IDS } from "@/modules/scores/import/parse";

const ROOTS = ["src/modules/ai/coach", "src/app/(app)/scores/import", "src/modules/scores/import", "src/app/(app)/scores/stats"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("aicoach dictionary", () => {
  it("has the same keys and placeholders in de, fr, it and en", () => {
    const keys = Object.keys(dict.de).sort();
    for (const l of ["fr", "it", "en"] as const) expect(Object.keys(dict[l]).sort()).toEqual(keys);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of keys) for (const l of ["fr", "it", "en"] as const) expect(ph(dict[l][k]!), `${l}:${k}`).toEqual(ph(dict.de[k]!));
  });

  it("uses Swiss spelling and French spacing", () => {
    for (const v of Object.values(dict.de)) expect(v).not.toContain("ß");
    for (const v of Object.values(dict.fr)) expect(v).not.toMatch(/ [?!;:»]|« /);
    for (const v of Object.values(dict.en)) expect(v.trim()).toBe(v);
  });

  it("covers all import fields and templates", () => {
    for (const f of SCORE_FIELDS) expect(dict.de[`aicoach.imp.field.${f}`], f).toBeTruthy();
    for (const id of SCORE_PRESET_IDS) {
      expect(dict.de[`aicoach.imp.preset.${id}.label`]).toBeTruthy();
      expect(dict.de[`aicoach.imp.preset.${id}.hint`]).toBeTruthy();
    }
    for (const c of ["high", "medium", "low"]) expect(dict.de[`aicoach.map.conf.${c}`]).toBeTruthy();
  });

  it("contains every literal aicoach key used in the code", () => {
    const used = new Set<string>();
    for (const root of ROOTS) {
      for (const f of files(root)) {
        for (const m of readFileSync(f, "utf8").matchAll(/["'`](aicoach\.[A-Za-z0-9_.]+)["'`]/g)) used.add(m[1]!);
      }
    }
    expect(used.size).toBeGreaterThan(50);
    for (const k of used) {
      if (k.endsWith(".")) continue;
      // Mehrzahl-Basis (…one/…other) oder vollständiger Schlüssel
      expect(dict.de[k] ?? (dict.de[`${k}.one`] && dict.de[`${k}.other`]), k).toBeTruthy();
    }
  });
});
