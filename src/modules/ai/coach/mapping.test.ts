import { describe, expect, it } from "vitest";
import { buildMappingPrompt, countChanges, mappingSchema, validateSuggestedMapping } from "./mapping";
import { maskSamples } from "./mask";

describe("validateSuggestedMapping", () => {
  it("keeps only existing columns and allowed fields", () => {
    const v = validateSuggestedMapping("scores", {
      columns: [
        { column: 0, field: "name", confidence: "high" },
        { column: 1, field: "shotValue", confidence: "medium" },
        { column: 2, field: "email", confidence: "high" }, // kein Feld des Resultat-Imports
        { column: 7, field: "total", confidence: "high" }, // Spalte gibt es nicht
        { column: 1.5, field: "total", confidence: "high" },
        { column: 3, field: "x", confidence: "bogus" },
      ],
      layout: "shots",
      note: "  Bitte   prüfen ",
    }, 4);
    expect(v.mapping).toEqual(["name", "shotValue", "ignore", "x"]);
    expect(v.confidence).toEqual(["high", "medium", null, "low"]);
    expect(v.layout).toBe("shots");
    expect(v.note).toBe("Bitte prüfen");
    expect(v.dropped).toBe(3);
  });

  it("assigns single fields only once (higher confidence wins) and allows multi fields several times", () => {
    const v = validateSuggestedMapping("scores", {
      columns: [
        { column: 0, field: "total", confidence: "low" },
        { column: 1, field: "seriesTotal", confidence: "high" },
        { column: 2, field: "seriesTotal", confidence: "high" },
        { column: 3, field: "total", confidence: "high" },
        { column: 4, field: "name", confidence: "medium" },
        { column: 5, field: "name", confidence: "medium" },
        { column: 4, field: "club", confidence: "high" }, // zweiter Eintrag für Spalte 4
      ],
      layout: "totals",
      note: "",
    }, 6);
    expect(v.mapping).toEqual(["ignore", "seriesTotal", "seriesTotal", "total", "name", "ignore"]);
    expect(v.dropped).toBe(3);
  });

  it("validates member fields and ignores a layout for members", () => {
    const v = validateSuggestedMapping("members", {
      columns: [
        { column: 0, field: "firstName", confidence: "high" },
        { column: 1, field: "lastName", confidence: "high" },
        { column: 2, field: "shotValue", confidence: "high" },
        { column: 3, field: "email", confidence: "high" },
      ],
      layout: "shots",
      note: "x",
    }, 4);
    expect(v.mapping).toEqual(["firstName", "lastName", "ignore", "email"]);
    expect(v.layout).toBeNull();
  });

  it("survives garbage", () => {
    expect(validateSuggestedMapping("members", null, 2).mapping).toEqual(["ignore", "ignore"]);
    expect(validateSuggestedMapping("scores", { columns: "x" }, 1)).toMatchObject({ mapping: ["ignore"], layout: null, note: "" });
  });

  it("counts changed columns", () => {
    expect(countChanges(["name", "ignore"], ["name", "total"])).toBe(1);
    expect(countChanges([], ["ignore", "total"])).toBe(1);
  });
});

describe("mapping prompt and schema", () => {
  it("lists the target fields and only masked samples inside an untrusted block", () => {
    const masked = maskSamples(["Name", "Ring"], [["Hans Muster", "10"]], "scores");
    const p = buildMappingPrompt("scores", masked);
    expect(p).toContain("- shotValue:");
    expect(p).toContain("[several columns allowed]");
    expect(p).toContain('<data name="columns">');
    expect(p).toContain("0: Name | samples: [name 1]");
    expect(p).not.toContain("Hans");
  });

  it("restricts the field to the allowed list", () => {
    const s = mappingSchema("members");
    expect(s.safeParse({ columns: [{ column: 0, field: "email", confidence: "high" }], layout: "unknown", note: "" }).success).toBe(true);
    expect(s.safeParse({ columns: [{ column: 0, field: "shotValue", confidence: "high" }], layout: "unknown", note: "" }).success).toBe(false);
  });
});
