import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeSlots, peakConcurrency } from "./availability";
import { zurichToUtc } from "@/lib/time";

const at = (date: string, time: string) => zurichToUtc(date, time);
const iv = (date: string, from: string, to: string, units?: number) => ({ startsAt: at(date, from), endsAt: at(date, to), units });

describe("peakConcurrency", () => {
  const day = "2026-06-03";
  const window = iv(day, "10:00", "12:00");

  it("zählt nur überlappende Buchungen", () => {
    expect(peakConcurrency([iv(day, "08:00", "09:00"), iv(day, "12:00", "13:00")], window)).toBe(0);
    expect(peakConcurrency([iv(day, "09:30", "10:30")], window)).toBe(1);
  });

  it("aufeinanderfolgende Buchungen belegen nur einen Platz", () => {
    expect(peakConcurrency([iv(day, "10:00", "11:00"), iv(day, "11:00", "12:00")], window)).toBe(1);
  });

  it("summiert gleichzeitige Einheiten", () => {
    expect(peakConcurrency([iv(day, "10:00", "12:00", 2), iv(day, "10:30", "11:30", 3), iv(day, "11:45", "12:30")], window)).toBe(5);
  });
});

describe("computeSlots", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T08:00:00Z")); // Montag, 10:00 Schweizer Zeit
  });
  afterEach(() => vi.useRealTimers());

  const base = {
    dateStr: "2026-06-03", // Mittwoch
    durationMinutes: 60,
    slotStepMinutes: 30,
    openingHours: { "3": [["17:00", "20:00"]] as [string, string][] },
    capacity: 2,
    minLeadMinutes: 60,
    maxAdvanceDays: 30,
    bookings: [],
    blocks: [],
  };

  it("erzeugt Zeitfenster innerhalb der Öffnungszeit", () => {
    const slots = computeSlots(base);
    expect(slots.map((s) => s.time)).toEqual(["17:00", "17:30", "18:00", "18:30", "19:00"]);
    expect(slots.every((s) => s.available && s.remaining === 2)).toBe(true);
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-06-03T15:00:00.000Z");
  });

  it("geschlossene Tage haben keine Fenster", () => {
    expect(computeSlots({ ...base, dateStr: "2026-06-04" })).toEqual([]);
  });

  it("markiert belegt, teilweise belegt und gesperrt", () => {
    const slots = computeSlots({
      ...base,
      bookings: [iv("2026-06-03", "17:00", "18:00", 2), iv("2026-06-03", "18:00", "19:00", 1)],
      blocks: [iv("2026-06-03", "19:30", "20:00")],
      requestedUnits: 2,
    });
    const by = Object.fromEntries(slots.map((s) => [s.time, s]));
    expect(by["17:00"]).toMatchObject({ available: false, reason: "Belegt", remaining: 0 });
    expect(by["18:00"]).toMatchObject({ available: false, reason: "Nicht genug Plätze frei", remaining: 1 });
    expect(by["19:00"]).toMatchObject({ available: false, reason: "Gesperrt" });
  });

  it("respektiert Vorlaufzeit und maximale Vorausbuchung", () => {
    const tooSoon = computeSlots({ ...base, dateStr: "2026-06-01", openingHours: { "1": [["10:00", "13:00"]] } });
    expect(tooSoon.find((s) => s.time === "10:30")?.reason).toBe("Zu kurzfristig");
    expect(tooSoon.find((s) => s.time === "11:00")?.available).toBe(true);
    const far = computeSlots({ ...base, dateStr: "2026-07-15", openingHours: { "3": [["17:00", "18:00"]] } });
    expect(far[0]).toMatchObject({ available: false, reason: "Zu weit im Voraus" });
  });
});
