import { describe, expect, it } from "vitest";
import { associationNotice } from "./texts";

describe("associationNotice", () => {
  it("liefert Texte in allen Sprachen mit Schweizer Konventionen", () => {
    const vars = { association: "KSV", club: "SG Test" };
    expect(associationNotice("de", "approved", vars).body).toContain("«SG Test»");
    expect(associationNotice("fr", "joinRequested", vars).body).toContain("société de tir « SG Test »");
    expect(associationNotice("it", "joinRequested", vars).body).toContain("società di tiro «SG Test»");
    for (const l of ["de", "fr", "it"] as const) {
      for (const k of ["joinRequested", "approved", "rejected", "removed", "clubLeft", "adminAssigned"] as const) {
        const t = associationNotice(l, k, vars);
        expect(t.title.length).toBeGreaterThan(3);
        expect(t.body.length).toBeGreaterThan(10);
      }
    }
  });
});
