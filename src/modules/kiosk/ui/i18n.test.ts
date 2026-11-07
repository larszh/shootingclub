import { describe, expect, it } from "vitest";
import { getT } from "@/lib/i18n/core";
import { periodPresets } from "@/modules/kiosk/logic";
import { localizePresets, monthNames, periodText } from "./i18n";

describe("Schützenstube: Sprachhilfen", () => {
  it("liefert zwölf Monatsnamen pro Sprache", () => {
    expect(monthNames("de")[0]).toBe("Januar");
    expect(monthNames("fr")[1]).toBe("février");
    expect(monthNames("it")[2]).toBe("marzo");
    expect(monthNames("en")[9]).toBe("October");
    expect(monthNames("xx")).toHaveLength(12);
  });

  it("beschriftet Zeiträume in der Anzeigesprache", () => {
    expect(periodText({ from: "2026-10-01", to: "2026-10-31" }, "de")).toBe("Oktober 2026");
    expect(periodText({ from: "2026-07-01", to: "2026-09-30" }, "fr")).toBe("juillet–septembre 2026");
    expect(periodText({ from: "2026-10-05", to: "2026-10-05" }, "en")).toBe("05.10.2026");
  });

  it("übersetzt die Vorschläge, Zeiträume bleiben gleich", () => {
    const presets = periodPresets("2026-11-07");
    const fr = localizePresets(getT("fr"), presets);
    expect(fr.map((p) => p.from)).toEqual(presets.map((p) => p.from));
    expect(fr.find((p) => p.key === "last-month")?.label).toBe("Mois dernier");
    expect(localizePresets(getT("de"), presets).find((p) => p.key === "this-year")?.label).toBe("Dieses Jahr");
  });
});
