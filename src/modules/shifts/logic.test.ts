import { describe, expect, it } from "vitest";
import {
  assignmentHours, canSelfSignUp, canSelfWithdraw, dayOffset, defaultShiftHours, ersatzAmountCents, ersatzCategoryName, expandTemplateDates,
  formatHours, hoursBalance, memberHours, missingHours, missingQualification, parseStatuses, shiftDurationHours, staffing, weekdayOf,
} from "./logic";

const shift = (h: number, credit: number | null = null) => ({ startsAt: new Date("2026-05-02T07:00:00Z"), endsAt: new Date(Date.parse("2026-05-02T07:00:00Z") + h * 3_600_000), hoursCredit: credit });

describe("Stunden", () => {
  it("Dauer und Anrechnung", () => {
    expect(shiftDurationHours(shift(3.5))).toBe(3.5);
    expect(shiftDurationHours(shift(1.1))).toBe(1); // Viertelstunden
    expect(defaultShiftHours(shift(3, 4))).toBe(4);
    expect(defaultShiftHours(shift(3, null))).toBe(3);
    expect(defaultShiftHours(shift(3, 0))).toBe(0);
  });

  it("nur erledigte Einsätze zählen, erfasste Stunden haben Vorrang", () => {
    expect(assignmentHours({ status: "ASSIGNED", hours: null }, shift(3))).toBe(0);
    expect(assignmentHours({ status: "NO_SHOW", hours: 3 }, shift(3))).toBe(0);
    expect(assignmentHours({ status: "DONE", hours: null }, shift(3, 2))).toBe(2);
    expect(assignmentHours({ status: "DONE", hours: 5 }, shift(3, 2))).toBe(5);
  });

  it("summiert Einsätze und bewilligte Rapporte", () => {
    const r = memberHours({
      assignments: [{ status: "DONE", hours: null, shift: shift(4) }, { status: "NO_SHOW", hours: null, shift: shift(4) }, { status: "DONE", hours: 1.5, shift: shift(4) }],
      workLogs: [{ hours: 2, approvedAt: new Date() }, { hours: 3, approvedAt: null }],
    });
    expect(r).toEqual({ shiftHours: 5.5, logHours: 2, total: 7.5, pendingLogHours: 3 });
  });

  it("fehlende Stunden und Ersatzabgabe", () => {
    expect(missingHours(10, 7.5)).toBe(2.5);
    expect(missingHours(10, 12)).toBe(0);
    expect(missingHours(0, 0)).toBe(0);
    expect(ersatzAmountCents(2.5, 3000)).toBe(7500);
    expect(ersatzAmountCents(1 / 3, 2000)).toBe(665); // 666.67 → auf 5 Rappen
    expect(ersatzAmountCents(0, 3000)).toBe(0);
    expect(ersatzAmountCents(2, 0)).toBe(0);
  });

  it("Saldo berücksichtigt Status, Befreiung und Einstellung", () => {
    const settings = { enabled: true, requiredHours: 8, ratePerMissingHourCents: 2500, statuses: ["ACTIVE", "JUNIOR"] };
    expect(hoursBalance({ status: "ACTIVE", workHoursExempt: false }, 5, settings)).toEqual({ required: 8, done: 5, missing: 3, amountCents: 7500, subject: true });
    expect(hoursBalance({ status: "ACTIVE", workHoursExempt: true }, 0, settings).subject).toBe(false);
    expect(hoursBalance({ status: "PASSIVE", workHoursExempt: false }, 0, settings).amountCents).toBe(0);
    expect(hoursBalance({ status: "ACTIVE", workHoursExempt: false }, 0, { ...settings, enabled: false }).missing).toBe(0);
  });

  it("parst Status und formatiert", () => {
    expect(parseStatuses("active, JUNIOR,LEFT,foo,ACTIVE", ["ACTIVE", "JUNIOR", "LEFT"])).toEqual(["ACTIVE", "JUNIOR"]);
    expect(parseStatuses(null, ["ACTIVE"])).toEqual([]);
    expect(formatHours(2.5)).toBe("2.5");
    expect(formatHours(3)).toBe("3");
    expect(formatHours(1.25)).toBe("1.25");
    expect(ersatzCategoryName(2026, 2.5)).toBe("Ersatzabgabe Arbeitsstunden 2026 (2.5 h)");
  });
});

describe("Besetzung", () => {
  it("zählt eingeteilte und erledigte", () => {
    expect(staffing(3, [{ status: "ASSIGNED" }, { status: "NO_SHOW" }, { status: "DONE" }])).toEqual({ filled: 2, capacity: 3, open: 1, understaffed: true, full: false });
    expect(staffing(1, [{ status: "ASSIGNED" }]).full).toBe(true);
    expect(staffing(0, []).capacity).toBe(1);
  });

  it("Qualifikation fehlt nur mit Anforderung", () => {
    expect(missingQualification(null, [])).toBe(false);
    expect(missingQualification("FIRST_AID", [])).toBe(true);
    expect(missingQualification("FIRST_AID", [false, true])).toBe(false);
  });

  it("Ein- und Austragen bis zum Beginn", () => {
    const now = new Date("2026-05-01T10:00:00Z");
    const s = { startsAt: new Date("2026-05-02T07:00:00Z") };
    expect(canSelfSignUp(s, staffing(2, [{ status: "ASSIGNED" }]), now)).toBe(true);
    expect(canSelfSignUp(s, staffing(1, [{ status: "ASSIGNED" }]), now)).toBe(false);
    expect(canSelfSignUp(s, staffing(2, []), new Date("2026-05-02T07:00:00Z"))).toBe(false);
    expect(canSelfWithdraw(s, { status: "ASSIGNED" }, now)).toBe(true);
    expect(canSelfWithdraw(s, { status: "DONE" }, now)).toBe(false);
  });
});

describe("Vorlage kopieren", () => {
  it("jeder Samstag einer Saison ohne Vorlagedatum", () => {
    // 2026-04-04 ist ein Samstag
    expect(weekdayOf("2026-04-04")).toBe(6);
    const d = expandTemplateDates({ from: "2026-04-01", to: "2026-04-30", weekdays: [6], exclude: ["2026-04-04"] });
    expect(d).toEqual(["2026-04-11", "2026-04-18", "2026-04-25"]);
  });

  it("alle zwei Wochen, mehrere Wochentage, Maximum", () => {
    expect(expandTemplateDates({ from: "2026-04-06", to: "2026-04-30", weekdays: [3, 6], everyWeeks: 2 })).toEqual(["2026-04-08", "2026-04-11", "2026-04-22", "2026-04-25"]);
    expect(expandTemplateDates({ from: "2026-01-01", to: "2026-12-31", weekdays: [0, 1, 2, 3, 4, 5, 6], max: 5 })).toHaveLength(5);
  });

  it("ungültige Eingaben ergeben nichts", () => {
    expect(expandTemplateDates({ from: "2026-05-01", to: "2026-04-01", weekdays: [6] })).toEqual([]);
    expect(expandTemplateDates({ from: "x", to: "2026-04-01", weekdays: [6] })).toEqual([]);
    expect(expandTemplateDates({ from: "2026-04-01", to: "2026-04-30", weekdays: [9] })).toEqual([]);
  });

  it("Tagesverschiebung", () => {
    expect(dayOffset("2026-03-28", "2026-03-29")).toBe(1);
    expect(dayOffset("2026-03-28", "2026-03-28")).toBe(0);
  });
});
