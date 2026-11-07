import { describe, expect, it } from "vitest";
import { getT, LOCALES } from "@/lib/i18n/core";
import { DEFAULT_ZONES, validateZones, zoneIssue, type ZoneIssueCode } from "../types";
import { defaultZoneDrafts, draftError, toDrafts } from "./zone-editor";

const ALL_CODES: ZoneIssueCode[] = ["empty", "tooMany", "keyMissing", "keyTooLong", "labelMissing", "labelTooLong", "pointsInt", "pointsMin", "pointsMax", "invalid", "dupKey", "dupPoints", "noPositive", "penaltyNeedsNegative"];

describe("Zonen-Editor in der Sprache der Person", () => {
  it("jede Fehlerart hat einen Text in allen Sprachen", () => {
    for (const l of LOCALES) {
      const t = getT(l);
      for (const code of [...ALL_CODES, "pointsNotNumber"]) expect(t(`shooting.zone.err.${code}`)).not.toBe(`shooting.zone.err.${code}`);
    }
  });

  it("Deutsch bleibt wie die Server-Prüfung", () => {
    const dup = toDrafts([{ key: "A", label: "A", points: 5 }, { key: "B", label: "B", points: 5 }]);
    expect(draftError(dup)).toBe(validateZones([{ key: "A", label: "A", points: 5 }, { key: "B", label: "B", points: 5 }]));
    expect(draftError(dup, getT("de"))).toBe("Jede Zone braucht einen eigenen Punktwert.");
    expect(draftError([{ key: "A", label: "A", points: "x" }])).toBe("Zone «A»: Punkte als ganze Zahl eingeben (z.B. 5 oder -10).");
    expect(validateZones([{ key: "", label: "Mitte", points: 5 }])).toBe("Zone «Mitte»: Kürzel fehlt");
    expect(validateZones([{ key: "A", label: "A", points: 500 }])).toBe("Zone «A»: Punkte höchstens 100");
  });

  it("Französisch, Italienisch und Englisch", () => {
    const dup = toDrafts([{ key: "A", label: "A", points: 5 }, { key: "B", label: "B", points: 5 }]);
    expect(draftError(dup, getT("en"))).toBe("Each zone needs its own point value.");
    expect(draftError(dup, getT("it"))).toBe("Ogni zona ha bisogno di un proprio valore di punti.");
    expect(draftError([{ key: "A", label: "A", points: "x" }], getT("en"))).toBe("Zone “A”: enter the points as a whole number (e.g. 5 or -10).");
    expect(draftError(toDrafts([{ key: "A", label: "A", points: 500 }]), getT("fr"))).toBe("Zone «\u202fA\u202f»\u202f: points au maximum 100");
    expect(zoneIssue([])).toEqual({ code: "empty" });
  });

  it("Standard-Zonen mit übersetzten Bezeichnungen, Kürzel und Punkte unverändert", () => {
    const de = defaultZoneDrafts(getT("de"));
    expect(de).toEqual(toDrafts(DEFAULT_ZONES));
    const en = defaultZoneDrafts(getT("en"));
    expect(en.map((z) => [z.key, z.points])).toEqual(de.map((z) => [z.key, z.points]));
    expect(en.find((z) => z.key === "M")!.label).toBe("Miss");
    expect(defaultZoneDrafts(getT("fr")).find((z) => z.key === "VF")!.label).toBe("Erreur de procédure");
  });
});
