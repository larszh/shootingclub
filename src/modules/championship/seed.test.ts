import { describe, expect, it } from "vitest";
import { distributeSeedShots } from "./seed";

describe("distributeSeedShots (Demo-Serien)", () => {
  it("verteilt das Total exakt auf die Schüsse aller Serien", () => {
    const res = distributeSeedShots([{ shots: 5, max: 10 }, { shots: 5, max: 10 }], 92);
    expect(res).toHaveLength(2);
    expect(res.flat().reduce((a, b) => a + b, 0)).toBe(92);
    expect(res.flat().every((v) => v >= 0 && v <= 10)).toBe(true);
  });

  it("begrenzt auf das Maximum des Programms", () => {
    const res = distributeSeedShots([{ shots: 3, max: 1 }], 50);
    expect(res).toEqual([[1, 1, 1]]);
  });
});
