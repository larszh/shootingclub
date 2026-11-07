import { describe, expect, it } from "vitest";
import dict from "./misc";
import { getT } from "@/lib/i18n/core";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Wörterbuch misc", () => {
  it("hat in allen Sprachen dieselben Schlüssel und Platzhalter", () => {
    const keys = Object.keys(dict.de).sort();
    expect(keys.length).toBeGreaterThan(50);
    for (const l of ["fr", "it", "en"] as const) {
      expect(Object.keys(dict[l]).sort()).toEqual(keys);
      for (const k of keys) {
        expect(dict[l][k], `${l}:${k}`).toBeTruthy();
        expect(placeholders(dict[l][k]!), `${l}:${k}`).toEqual(placeholders(dict.de[k]!));
      }
    }
    for (const k of keys) expect(k.startsWith("misc.")).toBe(true);
  });

  it("setzt die französischen Leerzeichen und ist im Übersetzer eingebunden", () => {
    expect(dict.fr["misc.share.list.removeTitle"]).toBe("Supprimer le partage avec {partner} ?");
    expect(getT("it")("misc.file.empty")).toBe("Il file è vuoto.");
    expect(getT("en")("misc.file.tooBigMax", { max: 25 })).toBe("The file is too large. The maximum is 25 MB per file.");
  });
});
