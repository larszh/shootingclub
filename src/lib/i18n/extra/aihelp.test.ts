import { describe, expect, it } from "vitest";
import dict from "./aihelp";
import { AI_ERROR_CODES, AI_UNAVAILABLE_REASONS } from "@/lib/ai/types";

describe("aihelp dictionary", () => {
  it("has the same keys and placeholders in de, fr, it and en", () => {
    const keys = Object.keys(dict.de).sort();
    for (const l of ["fr", "it", "en"] as const) expect(Object.keys(dict[l]).sort()).toEqual(keys);
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const k of keys) for (const l of ["fr", "it", "en"] as const) expect(ph(dict[l][k]!), `${l}:${k}`).toEqual(ph(dict.de[k]!));
  });

  it("covers all ai.unavailable.* and ai.error.* keys", () => {
    for (const r of AI_UNAVAILABLE_REASONS) expect(dict.de[`ai.unavailable.${r}`]).toBeTruthy();
    for (const c of AI_ERROR_CODES) expect(dict.de[`ai.error.${c}`]).toBeTruthy();
  });

  it("uses Swiss spelling and French spacing", () => {
    for (const v of Object.values(dict.de)) expect(v).not.toContain("ß");
    for (const v of Object.values(dict.fr)) expect(v).not.toMatch(/ [?!;:»]|« /);
    for (const v of Object.values(dict.en)) expect(v.trim()).toBe(v);
  });
});
