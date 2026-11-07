import { describe, expect, it } from "vitest";
import { reminderDay, reminderDue } from "./reminder-logic";
import { discountReasonLabel, slotErrorLabel, slotReasonLabel } from "./i18n";
import { getT } from "@/lib/i18n/core";

const H = 3_600_000;
const now = new Date("2026-11-10T10:00:00Z");

describe("reminderDue", () => {
  it("Beginn in den nächsten 24 Stunden, früh gebucht", () => {
    expect(reminderDue({ startsAt: new Date(now.getTime() + 20 * H), createdAt: new Date(now.getTime() - 3 * 24 * H) }, now)).toBe(true);
    expect(reminderDue({ startsAt: new Date(now.getTime() + 24 * H), createdAt: new Date(now.getTime() - 3 * 24 * H) }, now)).toBe(true);
  });
  it("zu früh, vorbei oder kurzfristig gebucht", () => {
    expect(reminderDue({ startsAt: new Date(now.getTime() + 25 * H), createdAt: new Date(0) }, now)).toBe(false);
    expect(reminderDue({ startsAt: new Date(now.getTime() - H), createdAt: new Date(0) }, now)).toBe(false);
    expect(reminderDue({ startsAt: new Date(now.getTime() + 4 * H), createdAt: new Date(now.getTime() - H) }, now)).toBe(false);
  });
  it("spät freigegeben zählt ab der Freigabe", () => {
    expect(reminderDue({ startsAt: new Date(now.getTime() + 4 * H), createdAt: new Date(now.getTime() - 48 * H), confirmedAt: new Date(now.getTime() - H) }, now)).toBe(false);
  });
});

describe("Übersetzte Gründe", () => {
  it("Slots", () => {
    expect(slotReasonLabel("Belegt", getT("fr"))).toBe("Occupé");
    expect(slotReasonLabel("Zu kurzfristig", getT("de"))).toBe("Zu kurzfristig");
    expect(slotReasonLabel("Etwas anderes", getT("it"))).toBe("Etwas anderes");
    expect(slotReasonLabel(undefined, getT("it"))).toBe("non disponibile");
    expect(slotErrorLabel("Höchstens 3 Personen pro Buchung", getT("it"), 3)).toBe("Al massimo 3 persone per prenotazione.");
  });
  it("Rabatt", () => {
    expect(discountReasonLabel("Spontan-Rabatt 20%", getT("de"))).toBe("Spontan-Rabatt 20%");
    expect(discountReasonLabel("Spontan-Rabatt 20%", getT("it"))).toBe("Sconto last minute 20%");
    expect(discountReasonLabel(null, getT("fr"))).toBeNull();
  });
});

describe("reminderDay", () => {
  it("Kalendertag in Schweizer Zeit", () => {
    // 07.11.2026 09:30 Zürich (UTC+1) → Beginn 14:00 am selben Tag
    expect(reminderDay(new Date("2026-11-07T13:00:00Z"), new Date("2026-11-07T08:30:00Z"))).toBe("today");
    expect(reminderDay(new Date("2026-11-08T13:00:00Z"), new Date("2026-11-07T08:30:00Z"))).toBe("tomorrow");
    // 23:30 UTC am 07.11. ist in Zürich bereits der 08.11.
    expect(reminderDay(new Date("2026-11-07T23:30:00Z"), new Date("2026-11-07T20:00:00Z"))).toBe("tomorrow");
  });
});
