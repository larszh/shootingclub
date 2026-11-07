import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import dict from "./aicontent";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("aicontent dictionary", () => {
  it("has the same keys and placeholders in de, fr, it and en", () => {
    const keys = Object.keys(dict.de).sort();
    for (const l of ["fr", "it", "en"] as const) expect(Object.keys(dict[l]).sort()).toEqual(keys);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of keys) for (const l of ["fr", "it", "en"] as const) expect(ph(dict[l][k]!), `${l}:${k}`).toEqual(ph(dict.de[k]!));
  });

  it("covers every static key used by the module", () => {
    const root = join(process.cwd(), "src/modules/ai/content");
    const used = new Set<string>();
    for (const f of files(root)) for (const m of readFileSync(f, "utf8").matchAll(/"(aicontent\.[A-Za-z0-9_.]+[A-Za-z0-9_])"/g)) used.add(m[1]!);
    for (const k of used) expect(dict.de[k], k).toBeTruthy();
    for (const e of ["notFound", "changed", "empty", "invalid"]) expect(dict.de[`aicontent.err.${e}`]).toBeTruthy();
  });

  it("uses Swiss spelling and French spacing", () => {
    for (const v of Object.values(dict.de)) expect(v).not.toContain("ß");
    for (const v of Object.values(dict.fr)) expect(v).not.toMatch(/ [?!;:»]|« /);
  });
});
