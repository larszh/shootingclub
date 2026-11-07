import { describe, expect, it } from "vitest";
import { compareMemberNumbers, sortByMemberNumber } from "./number-sort";

describe("compareMemberNumbers", () => {
  it("sortiert Zahlen numerisch", () => {
    const list = ["10", "9", "100", "1", "2"];
    expect([...list].sort(compareMemberNumbers)).toEqual(["1", "2", "9", "10", "100"]);
  });

  it("behandelt führende Nullen und lange Nummern", () => {
    expect(compareMemberNumbers("007", "8")).toBeLessThan(0);
    expect(compareMemberNumbers("12345678901234567890", "9")).toBeGreaterThan(0);
    expect(compareMemberNumbers("7", "007")).toBeLessThan(0);
  });

  it("sortiert gemischte Nummern natürlich", () => {
    const list = ["A10", "A2", "B1", "a1", "M-10", "M-9"];
    expect([...list].sort(compareMemberNumbers)).toEqual(["a1", "A2", "A10", "B1", "M-9", "M-10"]);
  });

  it("leere Nummern zuletzt", () => {
    expect([null, "3", "", " ", "1"].sort(compareMemberNumbers)).toEqual(["1", "3", null, "", " "]);
  });
});

describe("sortByMemberNumber", () => {
  it("sortiert nach Nummer, dann Name, ohne die Liste zu ändern", () => {
    const rows = [
      { memberNumber: "10", name: "Anna" },
      { memberNumber: null, name: "Beat" },
      { memberNumber: "9", name: "Carla" },
      { memberNumber: null, name: "Aldo" },
      { memberNumber: "9", name: "Bruno" },
    ];
    const sorted = sortByMemberNumber(rows);
    expect(sorted.map((r) => r.name)).toEqual(["Bruno", "Carla", "Anna", "Aldo", "Beat"]);
    expect(rows[0]!.name).toBe("Anna");
  });
});
