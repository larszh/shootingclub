import { describe, expect, it } from "vitest";
import { chatTitle, dayLabel, listTimeLabel } from "./format";

const now = new Date("2026-11-04T10:00:00Z").getTime();

describe("Chat-Zeitangaben", () => {
  it("Heute/Gestern in der Sprache des Mitglieds", () => {
    expect(dayLabel("2026-11-04T08:00:00Z", now)).toBe("Heute");
    expect(dayLabel("2026-11-04T08:00:00Z", now, "fr")).toBe("Aujourd’hui");
    expect(dayLabel("2026-11-03T08:00:00Z", now, "it")).toBe("Ieri");
    expect(listTimeLabel("2026-11-03T08:00:00Z", now, "fr")).toBe("Hier");
  });

  it("Datum ohne Jahr im laufenden Jahr, gross geschrieben", () => {
    expect(dayLabel("2026-10-26T08:00:00Z", now)).toBe("Montag, 26. Oktober");
    expect(dayLabel("2026-10-26T08:00:00Z", now, "fr")).toMatch(/^Lundi,? 26 octobre$/);
  });

  it("übersetzt nur Ersatztitel", () => {
    expect(chatTitle("Gruppe", "fr")).toBe("Groupe");
    expect(chatTitle("Ehemaliges Mitglied", "it")).toBe("Ex membro");
    expect(chatTitle("Vorstand", "fr")).toBe("Vorstand");
  });
});
