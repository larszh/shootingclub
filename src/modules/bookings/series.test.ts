import { describe, expect, it } from "vitest";
import {
  cancellableOccurrences, checkOccurrence, conflictSummary, formatWeekdaysCsv, isoWeekday, minutesBetween, parseWeekdays,
  partitionOccurrences, seriesDates, seriesOccurrences, validatePattern, weekdaysLabel, SERIES_MAX_OCCURRENCES,
} from "./series";
import type { OpeningHours } from "./types";

describe("Wochentage", () => {
  it("ISO-Wochentag 1 = Montag … 7 = Sonntag", () => {
    expect(isoWeekday("2026-11-02")).toBe(1); // Montag
    expect(isoWeekday("2026-11-03")).toBe(2);
    expect(isoWeekday("2026-11-08")).toBe(7); // Sonntag
  });
  it("CSV lesen und schreiben", () => {
    expect(parseWeekdays("3,1, 3,9,x,0,7")).toEqual([1, 3, 7]);
    expect(parseWeekdays("")).toEqual([]);
    expect(parseWeekdays(null)).toEqual([]);
    expect(formatWeekdaysCsv([5, 2, 2])).toBe("2,5");
    expect(weekdaysLabel("2,4")).toBe("Di, Do");
    expect(weekdaysLabel([7], true)).toBe("Sonntag");
  });
});

describe("seriesDates", () => {
  it("bis und mit Enddatum", () => {
    // Di 3.11. bis Di 24.11.2026: vier Dienstage, der letzte ist eingeschlossen
    expect(seriesDates({ fromDate: "2026-11-03", untilDate: "2026-11-24", weekdays: [2] })).toEqual(["2026-11-03", "2026-11-10", "2026-11-17", "2026-11-24"]);
  });
  it("mehrere Wochentage, Beginn mitten in der Woche", () => {
    expect(seriesDates({ fromDate: "2026-11-04", untilDate: "2026-11-12", weekdays: [1, 3] })).toEqual(["2026-11-04", "2026-11-09", "2026-11-11"]);
  });
  it("Sonntag als 7", () => {
    expect(seriesDates({ fromDate: "2026-11-01", untilDate: "2026-11-15", weekdays: [7] })).toEqual(["2026-11-01", "2026-11-08", "2026-11-15"]);
  });
  it("leer bei falscher Reihenfolge oder ohne Wochentage", () => {
    expect(seriesDates({ fromDate: "2026-11-10", untilDate: "2026-11-01", weekdays: [2] })).toEqual([]);
    expect(seriesDates({ fromDate: "2026-11-01", untilDate: "2026-11-30", weekdays: [] })).toEqual([]);
  });
  it("Jahreswechsel und Schaltjahr", () => {
    expect(seriesDates({ fromDate: "2027-12-27", untilDate: "2028-01-05", weekdays: [1] })).toEqual(["2027-12-27", "2028-01-03"]);
    expect(seriesDates({ fromDate: "2028-02-28", untilDate: "2028-03-01", weekdays: [1, 2, 3] })).toEqual(["2028-02-28", "2028-02-29", "2028-03-01"]);
  });
  it("Begrenzung der Anzahl", () => {
    expect(seriesDates({ fromDate: "2026-01-01", untilDate: "2026-12-31", weekdays: [1, 2, 3, 4, 5, 6, 7] }, 10)).toHaveLength(10);
  });
});

describe("seriesOccurrences (Zeitumstellung)", () => {
  it("18:00 bleibt 18:00 Schweizer Zeit über die Umstellung im März", () => {
    const occ = seriesOccurrences({ fromDate: "2026-03-24", untilDate: "2026-03-31", weekdays: [2], startTime: "18:00", endTime: "20:00" });
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual(["2026-03-24T17:00:00.000Z", "2026-03-31T16:00:00.000Z"]);
    expect(occ.map((o) => (o.endsAt.getTime() - o.startsAt.getTime()) / 60_000)).toEqual([120, 120]);
  });
  it("und im Oktober zurück", () => {
    const occ = seriesOccurrences({ fromDate: "2026-10-20", untilDate: "2026-10-27", weekdays: [2], startTime: "18:00", endTime: "19:30" });
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual(["2026-10-20T16:00:00.000Z", "2026-10-27T17:00:00.000Z"]);
  });
  it("Termin am Umstellungssonntag", () => {
    const [o] = seriesOccurrences({ fromDate: "2026-03-29", untilDate: "2026-03-29", weekdays: [7], startTime: "09:00", endTime: "11:00" });
    expect(o!.startsAt.toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });
});

describe("validatePattern", () => {
  const base = { fromDate: "2026-11-03", untilDate: "2026-12-29", weekdays: [2], startTime: "18:00", endTime: "20:00" };
  it("gültig", () => expect(validatePattern(base)).toBeNull());
  it("Fehlerfälle", () => {
    expect(validatePattern({ ...base, untilDate: "2026-11-01" })).toBe("untilBeforeFrom");
    expect(validatePattern({ ...base, weekdays: [] })).toBe("noWeekdays");
    expect(validatePattern({ ...base, endTime: "18:00" })).toBe("endBeforeStart");
    expect(validatePattern({ ...base, startTime: "25:00" })).toBe("invalidTime");
    expect(validatePattern({ ...base, fromDate: "03.11.2026" })).toBe("invalidDate");
    expect(validatePattern({ ...base, untilDate: "2028-01-01" })).toBe("tooLong");
    expect(validatePattern({ ...base, fromDate: "2026-11-04", untilDate: "2026-11-09", weekdays: [2] })).toBe("empty");
    expect(validatePattern({ ...base, fromDate: "2026-01-01", untilDate: "2026-12-31", weekdays: [1, 2, 3, 4, 5] })).toBe("tooMany");
    expect(SERIES_MAX_OCCURRENCES).toBe(200);
  });
  it("Minuten", () => expect(minutesBetween("17:30", "19:00")).toBe(90));
});

describe("checkOccurrence und Konflikte", () => {
  const openingHours: OpeningHours = { "0": [], "1": [["17:00", "21:00"]], "2": [["17:00", "21:00"]], "3": [], "4": [], "5": [], "6": [["09:00", "17:00"]] };
  const now = new Date("2026-11-01T12:00:00Z");
  const occ = (date: string, startTime = "18:00", endTime = "20:00") => ({ ...seriesOccurrences({ fromDate: date, untilDate: date, weekdays: [isoWeekday(date)], startTime, endTime })[0]!, startTime, endTime });
  const base = { openingHours, capacity: 2, requestedUnits: 1, bookings: [], blocks: [], now };

  it("frei", () => expect(checkOccurrence({ ...base, occurrence: occ("2026-11-03") })).toBeNull());
  it("vergangen", () => expect(checkOccurrence({ ...base, occurrence: occ("2026-10-27") })).toBe("past"));
  it("ausserhalb Öffnungszeiten (Wochentag zu, Zeit zu spät)", () => {
    expect(checkOccurrence({ ...base, occurrence: occ("2026-11-04") })).toBe("closed"); // Mittwoch geschlossen
    expect(checkOccurrence({ ...base, occurrence: occ("2026-11-03", "20:00", "22:00") })).toBe("closed");
    expect(checkOccurrence({ ...base, occurrence: occ("2026-11-07", "09:00", "17:00") })).toBeNull(); // Samstag ganz
  });
  it("Sperrzeit", () => {
    const o = occ("2026-11-03");
    expect(checkOccurrence({ ...base, occurrence: o, blocks: [{ startsAt: new Date(o.startsAt.getTime() + 30 * 60_000), endsAt: o.endsAt }] })).toBe("blocked");
  });
  it("Kapazität", () => {
    const o = occ("2026-11-03");
    const one = { startsAt: o.startsAt, endsAt: o.endsAt, units: 1 };
    expect(checkOccurrence({ ...base, occurrence: o, bookings: [one] })).toBeNull();
    expect(checkOccurrence({ ...base, occurrence: o, bookings: [one, one] })).toBe("full");
    expect(checkOccurrence({ ...base, occurrence: o, bookings: [one], requestedUnits: 2 })).toBe("full");
    // direkt anschliessend ist kein Konflikt
    expect(checkOccurrence({ ...base, capacity: 1, occurrence: o, bookings: [{ startsAt: o.endsAt, endsAt: new Date(o.endsAt.getTime() + 3_600_000) }] })).toBeNull();
  });
  it("Schiesszeiten", () => expect(checkOccurrence({ ...base, occurrence: occ("2026-11-03"), insideWindow: false })).toBe("window"));

  it("partitionOccurrences und Zusammenfassung", () => {
    const list = [
      { ...occ("2026-11-03"), conflict: null },
      { ...occ("2026-11-10"), conflict: "full" as const },
      { ...occ("2026-11-17"), conflict: "blocked" as const },
      { ...occ("2026-11-24"), conflict: "full" as const },
      { ...occ("2026-12-01"), conflict: null },
    ];
    const p = partitionOccurrences(list);
    expect(p.free.map((o) => o.date)).toEqual(["2026-11-03", "2026-12-01"]);
    expect(p.conflicts.map((o) => o.date)).toEqual(["2026-11-10", "2026-11-17", "2026-11-24"]);
    expect(p.byReason).toEqual({ full: 2, blocked: 1 });
    expect(conflictSummary(p.free.length, p.byReason)).toBe("2 Termine buchbar, 3 übersprungen (2× Belegt, 1× Gesperrt)");
    expect(conflictSummary(1, {})).toBe("1 Termin buchbar");
  });

  it("cancellableOccurrences: nur künftige aktive", () => {
    const list = [
      { id: "a", status: "CONFIRMED", startsAt: new Date("2026-10-01T10:00:00Z") },
      { id: "b", status: "CONFIRMED", startsAt: new Date("2026-11-10T10:00:00Z") },
      { id: "c", status: "CANCELLED", startsAt: new Date("2026-11-17T10:00:00Z") },
      { id: "d", status: "PENDING", startsAt: new Date("2026-11-24T10:00:00Z") },
    ];
    expect(cancellableOccurrences(list, now).map((b) => b.id)).toEqual(["b", "d"]);
  });
});
