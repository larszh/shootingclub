import { describe, expect, it } from "vitest";
import { deadlineLabel, longDate, monthLabel, whenLabel } from "../types";
import { deadlineLabelL, kindLabel, longDateL, monthLabelL, rsvpMyLabel, whenLabelL } from "./i18n";

// 2026-11-03 18:30 Zürich = 17:30 UTC
const start = new Date("2026-11-03T17:30:00Z");
const end = new Date("2026-11-03T19:30:00Z");

describe("Anlässe in der Sprache des Mitglieds", () => {
  it("Deutsch bleibt wie bisher", () => {
    for (const e of [
      { startsAt: start, endsAt: end, allDay: false },
      { startsAt: start, endsAt: null, allDay: false },
      { startsAt: start, endsAt: null, allDay: true },
      { startsAt: start, endsAt: new Date("2026-11-05T10:00:00Z"), allDay: true },
    ]) {
      expect(whenLabelL(e, "de")).toBe(whenLabel(e));
    }
    expect(deadlineLabelL(start, "de")).toBe(deadlineLabel(start));
    expect(longDateL(start, "de")).toBe(longDate(start));
    expect(monthLabelL(start, "de")).toBe(monthLabel(start));
    expect(kindLabel("COMPETITION", "de", true)).toBe("Wettkämpfe");
  });

  it("Französisch und Italienisch", () => {
    expect(whenLabelL({ startsAt: start, endsAt: end, allDay: false }, "fr")).toBe("18:30–20:30");
    expect(whenLabelL({ startsAt: start, endsAt: null, allDay: false }, "it")).toBe("dalle 18:30");
    expect(whenLabelL({ startsAt: start, endsAt: null, allDay: true }, "fr")).toBe("Toute la journée");
    expect(monthLabelL(start, "fr")).toBe("Novembre 2026");
    expect(monthLabelL(start, "it")).toBe("Novembre 2026");
    expect(longDateL(start, "fr")).toMatch(/^Mardi,? 3 novembre 2026$/);
    expect(kindLabel("UNKNOWN", "it")).toBe("Altro");
    expect(rsvpMyLabel("YES", "fr")).toBe("Tu participes");
  });
});
