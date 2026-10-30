import { describe, expect, it } from "vitest";
import { dayToDbDate, isQualificationKind, isValidOn, qualificationLabel, qualificationState, QUALIFICATION_KINDS } from "./types";

const d = (s: string | null) => (s ? dayToDbDate(s) : null);

describe("qualifications", () => {
  it("kennt alle Arten", () => {
    expect(QUALIFICATION_KINDS.map((k) => k.key)).toEqual(["SCHUETZENMEISTER", "JS_LEITER", "JPLUS_LEITER", "FIRST_AID", "RANGE_OFFICER", "INSTRUCTOR", "WEAPON_QUAL", "OTHER"]);
    expect(isQualificationKind("FIRST_AID")).toBe(true);
    expect(isQualificationKind("X")).toBe(false);
    expect(qualificationLabel("FIRST_AID")).toBe("Erste Hilfe");
    expect(qualificationLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("prüft Gültigkeit mit inklusiven Grenzen", () => {
    const q = { validFrom: d("2026-01-01"), validUntil: d("2026-12-31") };
    expect(isValidOn(q, "2026-01-01")).toBe(true);
    expect(isValidOn(q, "2026-12-31")).toBe(true);
    expect(isValidOn(q, "2025-12-31")).toBe(false);
    expect(isValidOn(q, "2027-01-01")).toBe(false);
    expect(isValidOn({ validFrom: null, validUntil: null }, "2030-01-01")).toBe(true);
  });

  it("berechnet den Ablauf-Status", () => {
    expect(qualificationState({ validFrom: null, validUntil: d("2026-10-01") }, "2026-10-29").state).toBe("expired");
    const soon = qualificationState({ validFrom: null, validUntil: d("2026-12-28") }, "2026-10-29");
    expect(soon).toEqual({ state: "expiring", daysLeft: 60 });
    expect(qualificationState({ validFrom: null, validUntil: d("2026-12-29") }, "2026-10-29").state).toBe("valid");
    expect(qualificationState({ validFrom: d("2026-11-01"), validUntil: null }, "2026-10-29").state).toBe("future");
    expect(qualificationState({ validFrom: null, validUntil: null }, "2026-10-29")).toEqual({ state: "valid", daysLeft: null });
  });
});
