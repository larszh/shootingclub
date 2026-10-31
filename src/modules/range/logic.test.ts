import { describe, expect, it } from "vitest";
import { zurichToUtc } from "../../lib/time";
import {
  OUTSIDE_WINDOW_REASON, ageInYear, ageOn, applicableWindows, applyWindowsToSlots, checkWithinWindows, countHalfDays, dayKeyToDbDate, describeDayWindows, formatMinutes,
  halfDayFlagsFromIntervals, halfDayFlagsFromVisits, halfDaysByMonth, isPlausibleBirthYear, mergeHalfDaysByDate, mergeWindows,
  minorStatusFromBirthYear, parseTimeToMinutes, quotaStatus, type QuotaDay, type WindowRule,
} from "./logic";

const t = (h: number, m = 0) => h * 60 + m;

describe("Zeiten", () => {
  it("liest HH:MM", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(parseTimeToMinutes("24:00")).toBe(1440);
    expect(parseTimeToMinutes("24:01")).toBeNull();
    expect(parseTimeToMinutes("12:60")).toBeNull();
    expect(parseTimeToMinutes("abc")).toBeNull();
    expect(formatMinutes(570)).toBe("09:30");
    expect(formatMinutes(1440)).toBe("24:00");
  });
});

describe("Halbtage aus Zeiten", () => {
  it("Vormittag vor 12, Nachmittag 12–18, Abend ab 18", () => {
    expect(halfDayFlagsFromIntervals([{ start: t(9), end: t(11, 30) }])).toEqual({ usedAm: true, usedPm: false, usedEvening: false });
    expect(halfDayFlagsFromIntervals([{ start: t(12), end: t(17) }])).toEqual({ usedAm: false, usedPm: true, usedEvening: false });
    expect(halfDayFlagsFromIntervals([{ start: t(18), end: t(20) }])).toEqual({ usedAm: false, usedPm: false, usedEvening: true });
  });
  it("Intervall über Grenzen zählt für beide Halbtage", () => {
    expect(halfDayFlagsFromIntervals([{ start: t(11), end: t(13) }])).toEqual({ usedAm: true, usedPm: true, usedEvening: false });
    expect(halfDayFlagsFromIntervals([{ start: t(17), end: t(19) }])).toEqual({ usedAm: false, usedPm: true, usedEvening: true });
  });
  it("Ende genau an der Grenze zählt nicht für den nächsten Halbtag", () => {
    expect(halfDayFlagsFromIntervals([{ start: t(9), end: t(12) }])).toEqual({ usedAm: true, usedPm: false, usedEvening: false });
    expect(halfDayFlagsFromIntervals([{ start: t(14), end: t(18) }])).toEqual({ usedAm: false, usedPm: true, usedEvening: false });
  });
  it("Zeitpunkt ohne Dauer", () => {
    expect(halfDayFlagsFromIntervals([{ start: t(12), end: t(12) }])).toEqual({ usedAm: false, usedPm: true, usedEvening: false });
    expect(halfDayFlagsFromIntervals([])).toEqual({ usedAm: false, usedPm: false, usedEvening: false });
  });
  it("aus Besuchen in Schweizer Zeit (Sommerzeit)", () => {
    const day = "2026-07-04";
    const visits = [
      { checkedInAt: zurichToUtc(day, "09:15"), checkedOutAt: zurichToUtc(day, "11:00") },
      { checkedInAt: zurichToUtc(day, "18:30"), checkedOutAt: null },
    ];
    expect(halfDayFlagsFromVisits(day, visits, zurichToUtc(day, "20:00"))).toEqual({ usedAm: true, usedPm: false, usedEvening: true });
  });
  it("Besuche anderer Tage werden ignoriert, über Mitternacht abgeschnitten", () => {
    const day = "2026-01-10";
    const visits = [
      { checkedInAt: zurichToUtc("2026-01-09", "19:00"), checkedOutAt: zurichToUtc("2026-01-09", "21:00") },
      { checkedInAt: zurichToUtc(day, "19:00"), checkedOutAt: zurichToUtc("2026-01-11", "01:00") },
    ];
    expect(halfDayFlagsFromVisits(day, visits, zurichToUtc(day, "22:00"))).toEqual({ usedAm: false, usedPm: false, usedEvening: true });
  });
});

describe("Kontingent", () => {
  const d = (key: string, resourceId: string | null, am: boolean, pm: boolean, ev: boolean): QuotaDay => ({ date: dayKeyToDbDate(key), resourceId, usedAm: am, usedPm: pm, usedEvening: ev });
  const days = [
    d("2026-03-07", "r1", true, true, false),
    d("2026-03-07", "r2", true, false, false),
    d("2026-03-14", null, false, false, true),
    d("2026-04-02", "r2", false, true, false),
  ];
  it("ganze Anlage: Halbtage pro Tag nur einmal", () => {
    // 07.03.: am+pm (r2 am überschneidet), 14.03.: abend, 02.04.: pm → 4
    expect(countHalfDays(days, null)).toBe(4);
  });
  it("pro Ressource inkl. Tage der ganzen Anlage", () => {
    expect(countHalfDays(days, "r1")).toBe(3);
    expect(countHalfDays(days, "r2")).toBe(3);
  });
  it("pro Monat", () => {
    const rows = halfDaysByMonth(mergeHalfDaysByDate(days));
    expect(rows[2]).toEqual({ month: 3, am: 1, pm: 1, evening: 1, total: 3, days: 2 });
    expect(rows[3]).toEqual({ month: 4, am: 0, pm: 1, evening: 0, total: 1, days: 1 });
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(4);
  });
  it("Tage ohne Halbtag zählen nicht", () => {
    expect(mergeHalfDaysByDate([{ date: dayKeyToDbDate("2026-05-01"), usedAm: false, usedPm: false, usedEvening: false }])).toEqual([]);
  });
  it("Status", () => {
    expect(quotaStatus(10, 3)).toMatchObject({ remaining: 7, pct: 30, tone: "ok" });
    expect(quotaStatus(10, 8)).toMatchObject({ remaining: 2, tone: "warn" });
    expect(quotaStatus(10, 10)).toMatchObject({ remaining: 0, tone: "danger" });
    expect(quotaStatus(10, 12)).toMatchObject({ remaining: -2, tone: "danger" });
  });
});

describe("Schiesszeiten", () => {
  // Samstag 2026-03-07, Mittwoch 2026-03-04
  const windows: WindowRule[] = [
    { resourceId: null, weekday: 6, startMinute: t(9), endMinute: t(12) },
    { resourceId: null, weekday: 6, startMinute: t(12), endMinute: t(17) },
    { resourceId: "r1", weekday: 3, startMinute: t(18), endMinute: t(20) },
  ];
  it("ohne Fenster keine Einschränkung", () => {
    expect(checkWithinWindows([], "r1", zurichToUtc("2026-03-04", "10:00"), zurichToUtc("2026-03-04", "11:00"))).toEqual({ ok: true, restricted: false });
  });
  it("innerhalb (angrenzende Fenster zusammengefasst)", () => {
    expect(checkWithinWindows(windows, "r2", zurichToUtc("2026-03-07", "11:00"), zurichToUtc("2026-03-07", "13:00"))).toEqual({ ok: true, restricted: true });
    expect(checkWithinWindows(windows, "r1", zurichToUtc("2026-03-04", "18:00"), zurichToUtc("2026-03-04", "20:00"))).toEqual({ ok: true, restricted: true });
  });
  it("ausserhalb", () => {
    const r = checkWithinWindows(windows, "r1", zurichToUtc("2026-03-04", "19:00"), zurichToUtc("2026-03-04", "21:00"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.allowed).toBe("Mi 18:00–20:00");
    expect(checkWithinWindows(windows, "r2", zurichToUtc("2026-03-04", "18:00"), zurichToUtc("2026-03-04", "19:00")).ok).toBe(false);
    expect(checkWithinWindows(windows, "r2", zurichToUtc("2026-03-07", "08:30"), zurichToUtc("2026-03-07", "10:00")).ok).toBe(false);
  });
  it("Buchungsraster: Zeiten ausserhalb für Mitglieder gesperrt, für die Verwaltung wählbar", () => {
    const slot = (d: string, from: string, to: string, available = true) => ({ time: from, startsAt: zurichToUtc(d, from), endsAt: zurichToUtc(d, to), available, reason: available ? undefined : "Belegt" });
    const day = [slot("2026-03-04", "17:00", "18:00"), slot("2026-03-04", "18:00", "19:00"), slot("2026-03-04", "19:00", "20:00", false), slot("2026-03-04", "19:30", "20:30")];
    const member = applyWindowsToSlots(windows, "r1", "2026-03-04", day, true);
    expect(member.slots.map((s) => [s.time, s.available, s.reason])).toEqual([
      ["17:00", false, OUTSIDE_WINDOW_REASON], ["18:00", true, undefined], ["19:00", false, "Belegt"], ["19:30", false, OUTSIDE_WINDOW_REASON],
    ]);
    expect(member.hint).toBe("Bewilligte Schiesszeiten: Mi 18:00–20:00");
    expect(member.outside).toBe(2);
    const admin = applyWindowsToSlots(windows, "r1", "2026-03-04", day, false);
    expect(admin.slots.filter((s) => s.available).map((s) => s.time)).toEqual(["17:00", "18:00", "19:30"]);
    // Tag ohne Fenster bei eingeschränkter Ressource: alles gesperrt; ohne Fenster für die Ressource: unverändert
    expect(applyWindowsToSlots(windows, "r2", "2026-03-04", day, true).slots.every((s) => !s.available)).toBe(true);
    expect(applyWindowsToSlots(windows, "r2", "2026-03-04", day, true).hint).toBe("Bewilligte Schiesszeiten: Mi: keine Schiesszeit");
    expect(applyWindowsToSlots([], "r1", "2026-03-04", day, true)).toEqual({ slots: day, hint: null, outside: 0 });
  });
  it("Fenster einer anderen Ressource gelten nicht", () => {
    expect(applicableWindows(windows, "r2")).toHaveLength(2);
    expect(applicableWindows(windows, "r1")).toHaveLength(3);
  });
  it("über Mitternacht nur bis 24:00", () => {
    const late: WindowRule[] = [{ resourceId: null, weekday: 5, startMinute: t(20), endMinute: 1440 }];
    expect(checkWithinWindows(late, null, zurichToUtc("2026-03-06", "22:00"), zurichToUtc("2026-03-07", "00:00")).ok).toBe(true);
    expect(checkWithinWindows(late, null, zurichToUtc("2026-03-06", "23:00"), zurichToUtc("2026-03-07", "01:00")).ok).toBe(false);
  });
  it("zusammenfassen und beschreiben", () => {
    expect(mergeWindows([{ startMinute: 600, endMinute: 700 }, { startMinute: 540, endMinute: 610 }, { startMinute: 800, endMinute: 900 }])).toEqual([
      { startMinute: 540, endMinute: 700 },
      { startMinute: 800, endMinute: 900 },
    ]);
    expect(describeDayWindows(windows, 6)).toBe("Sa 09:00–17:00");
    expect(describeDayWindows(windows, 1)).toBe("Mo: keine Schiesszeit");
  });
});

describe("Alter", () => {
  it("aus Jahrgang", () => {
    expect(ageInYear(2010, 2026)).toBe(16);
    expect(minorStatusFromBirthYear(2010, 2026)).toBe("minor");
    expect(minorStatusFromBirthYear(2008, 2026)).toBe("maybe");
    expect(minorStatusFromBirthYear(1990, 2026)).toBe("adult");
  });
  it("aus Geburtsdatum", () => {
    expect(ageOn("2008-10-30", "2026-10-29")).toBe(17);
    expect(ageOn("2008-10-29", "2026-10-29")).toBe(18);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });
  it("plausibler Jahrgang", () => {
    expect(isPlausibleBirthYear(2030, 2026)).toBe(false);
    expect(isPlausibleBirthYear(1900, 2026)).toBe(false);
    expect(isPlausibleBirthYear(1980, 2026)).toBe(true);
  });
});
