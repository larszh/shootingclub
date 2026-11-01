import { describe, expect, it } from "vitest";
import { foldLine, icsEscape } from "@/modules/events/ics";
import { buildFeedIcs, feedEventLines, keepInFeed, parseKindFilter, sequenceOf, zurichLocalStamp } from "./icalendar";

const enc = new TextEncoder();

/** Entfaltet RFC-5545-Zeilen (CRLF + Leerzeichen). */
function unfold(ics: string) {
  return ics.replace(/\r\n /g, "");
}

describe("icalendar", () => {
  it("escapt TEXT-Werte", () => {
    expect(icsEscape("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    expect(icsEscape("x\r\ny")).toBe("x\\ny");
  });

  it("faltet nach 75 Oktetten ohne UTF-8-Zeichen zu trennen", () => {
    const line = "SUMMARY:" + "Schützenfest Zürich – ".repeat(10);
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const [i, p] of parts.entries()) {
      expect(enc.encode(p).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(p.startsWith(" ")).toBe(true);
    }
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });

  it("schreibt VTIMEZONE und DTSTART;TZID in Lokalzeit (Sommer und Winter)", () => {
    const summer = new Date("2026-07-01T16:30:00Z"); // 18:30 MESZ
    const winter = new Date("2026-12-01T17:00:00Z"); // 18:00 MEZ
    expect(zurichLocalStamp(summer)).toBe("20260701T183000");
    expect(zurichLocalStamp(winter)).toBe("20261201T180000");
    const ics = buildFeedIcs({
      name: "Test",
      events: [{ uid: "event-a@standchef.ch", summary: "Training", startsAt: summer, endsAt: new Date("2026-07-01T18:00:00Z"), updatedAt: new Date("2026-06-01T00:00:00Z") }],
    });
    const text = unfold(ics);
    expect(text).toContain("BEGIN:VTIMEZONE\r\nTZID:Europe/Zurich");
    expect(text).toContain("TZOFFSETFROM:+0100\r\nTZOFFSETTO:+0200");
    expect(text).toContain("RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU");
    expect(text).toContain("DTSTART;TZID=Europe/Zurich:20260701T183000");
    expect(text).toContain("DTEND;TZID=Europe/Zurich:20260701T200000");
    expect(text.indexOf("END:VTIMEZONE")).toBeLessThan(text.indexOf("BEGIN:VEVENT"));
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => enc.encode(l).length <= 75)).toBe(true);
  });

  it("ganztägige Termine als VALUE=DATE ohne VTIMEZONE", () => {
    const ics = buildFeedIcs({
      name: "Test",
      events: [{ uid: "x@standchef.ch", summary: "Schützenfest", allDay: true, startsAt: new Date("2026-08-14T22:00:00Z"), endsAt: new Date("2026-08-16T22:00:00Z"), updatedAt: new Date() }],
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260815");
    expect(ics).toContain("DTEND;VALUE=DATE:20260818");
    expect(ics).not.toContain("VTIMEZONE");
  });

  it("SEQUENCE steigt mit updatedAt, abgesagte Termine mit STATUS:CANCELLED", () => {
    const a = sequenceOf(new Date("2026-01-01T00:00:00Z"));
    const b = sequenceOf(new Date("2026-01-01T00:00:05Z"));
    expect(b - a).toBe(5);
    expect(sequenceOf(new Date("2020-01-01T00:00:00Z"))).toBe(0);
    const lines = feedEventLines({ uid: "u@standchef.ch", summary: "A, B; C", startsAt: new Date("2026-03-01T10:00:00Z"), status: "CANCELLED", updatedAt: new Date("2026-02-01T00:00:00Z") });
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines).toContain("TRANSP:TRANSPARENT");
    expect(lines).toContain("SUMMARY:A\\, B\\; C");
    expect(lines.some((l) => l.startsWith("SEQUENCE:"))).toBe(true);
  });

  it("behält Absagen 30 Tage", () => {
    const now = new Date("2026-05-31T00:00:00Z");
    expect(keepInFeed({ isCancelled: false, updatedAt: new Date("2020-01-01") }, now)).toBe(true);
    expect(keepInFeed({ isCancelled: true, updatedAt: new Date("2026-05-10T00:00:00Z") }, now)).toBe(true);
    expect(keepInFeed({ isCancelled: true, updatedAt: new Date("2026-04-01T00:00:00Z") }, now)).toBe(false);
  });

  it("filtert Arten", () => {
    const known = ["TRAINING", "COMPETITION", "OTHER"];
    expect(parseKindFilter("training,competition,bogus", known)).toEqual(["TRAINING", "COMPETITION"]);
    expect(parseKindFilter("", known)).toEqual([]);
    expect(parseKindFilter(null, known)).toEqual([]);
  });
});
