import { addDays, todayZurich, zurichParts, zurichToUtc } from "@/lib/time";
import type { OpeningHours } from "./types";

export type Interval = { startsAt: Date; endsAt: Date };

/** Belegung mit Kapazitätseinheiten (ältere Buchungen ohne Angabe zählen als 1). */
export type UnitInterval = Interval & { units?: number };

export type Slot = {
  time: string; startsAt: Date; endsAt: Date; available: boolean; reason?: string;
  /** Freie Kapazitätseinheiten im ganzen Zeitfenster (Kapazität minus höchste gleichzeitige Belegung). */
  remaining: number;
};

type Params = {
  dateStr: string;
  durationMinutes: number;
  slotStepMinutes: number;
  openingHours: OpeningHours;
  capacity: number;
  /** Benötigte Einheiten der Anfrage (Standard 1). */
  requestedUnits?: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bookings: UnitInterval[]; // aktive Buchungen der Ressource
  blocks: Interval[]; // Sperrzeiten
  now?: Date;
};

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}
function fromMinutes(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function overlaps(a: Interval, b: Interval) {
  return a.startsAt < b.endsAt && a.endsAt > b.startsAt;
}

/**
 * Höchste gleichzeitige Belegung (Summe der Einheiten) innerhalb des Fensters. Aufeinanderfolgende
 * Buchungen (10–11 und 11–12 Uhr) belegen denselben Platz nur nacheinander und zählen deshalb einfach.
 * Buchungen ohne `units` zählen als 1 (bisheriges Verhalten).
 */
export function peakConcurrency(bookings: UnitInterval[], window: Interval) {
  const events: Array<[number, number]> = [];
  for (const b of bookings) {
    if (!overlaps(b, window)) continue;
    const units = Math.max(1, b.units ?? 1);
    events.push([Math.max(b.startsAt.getTime(), window.startsAt.getTime()), units]);
    events.push([Math.min(b.endsAt.getTime(), window.endsAt.getTime()), -units]);
  }
  // Bei gleicher Zeit zuerst Enden (negativ), dann Beginne (positiv) verarbeiten.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) {
    current += delta;
    if (current > peak) peak = current;
  }
  return peak;
}

export function computeSlots(p: Params): Slot[] {
  const now = p.now ?? new Date();
  const weekday = zurichParts(zurichToUtc(p.dateStr, "12:00")).weekday;
  const ranges = p.openingHours[String(weekday)] ?? [];
  const earliest = new Date(now.getTime() + p.minLeadMinutes * 60_000);
  const lastDay = addDays(todayZurich(), p.maxAdvanceDays);
  const beyond = p.dateStr > lastDay;
  const requested = Math.max(1, p.requestedUnits ?? 1);
  const slots: Slot[] = [];
  for (const [from, to] of ranges) {
    const start = toMinutes(from);
    const end = toMinutes(to);
    for (let t = start; t + p.durationMinutes <= end; t += p.slotStepMinutes) {
      const startsAt = zurichToUtc(p.dateStr, fromMinutes(t));
      const endsAt = new Date(startsAt.getTime() + p.durationMinutes * 60_000);
      const slot: Interval = { startsAt, endsAt };
      const used = peakConcurrency(p.bookings, slot);
      const remaining = Math.max(0, p.capacity - used);
      let available = true;
      let reason: string | undefined;
      if (beyond) {
        available = false;
        reason = "Zu weit im Voraus";
      } else if (startsAt < earliest) {
        available = false;
        reason = "Zu kurzfristig";
      } else if (p.blocks.some((b) => overlaps(b, slot))) {
        available = false;
        reason = "Gesperrt";
      } else if (remaining <= 0) {
        available = false;
        reason = "Belegt";
      } else if (used + requested > p.capacity) {
        available = false;
        reason = "Nicht genug Plätze frei";
      }
      slots.push({ time: fromMinutes(t), startsAt, endsAt, available, reason, remaining });
    }
  }
  return slots;
}
