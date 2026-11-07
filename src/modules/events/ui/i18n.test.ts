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

describe("Anlass- und Mitteilungs-Editor", () => {
  it("Beschriftungen in allen Sprachen, Deutsch unverändert", async () => {
    const { getT } = await import("@/lib/i18n/core");
    expect(getT("de")("money.events.form.create")).toBe("Anlass erstellen");
    expect(getT("fr")("money.events.form.create")).toBe("Créer l’événement");
    expect(getT("it")("money.events.form.annPublish")).toBe("Pubblica comunicazione");
    expect(getT("en")("money.events.form.preview", { n: 3, from: "03.11.2026", to: "17.11.2026" })).toBe("3 events will be created: 03.11.2026 to 17.11.2026.");
  });

  it("deutsche Prüfmeldungen aus types.ts und actions.ts werden übersetzt", async () => {
    const { localizeMessage } = await import("@/modules/billing/ui/i18n");
    const { recurrenceDates, MAX_RECURRENCE } = await import("../types");
    const err = recurrenceDates({ date: "2026-11-03", repeat: "WEEKLY", repeatMode: "UNTIL", repeatUntil: "2030-01-01" });
    expect(Array.isArray(err)).toBe(false);
    if (Array.isArray(err)) return;
    expect(localizeMessage(err.error, "de")).toBe(err.error);
    expect(localizeMessage(err.error, "en")).toBe(`At most ${MAX_RECURRENCE} dates per series.`);
    expect(localizeMessage("Bitte einen Titel eingeben.", "it")).toBe("Inserisci un titolo.");
    expect(localizeMessage("«Sichtbar bis» darf nicht in der Vergangenheit liegen.", "fr")).toBe("« Visible jusqu’au » ne peut pas être dans le passé.");
  });
});
