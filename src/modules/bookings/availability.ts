import { addDays, todayZurich, zurichParts, zurichToUtc } from "@/lib/time";
import type { OpeningHours } from "./types";

export type Interval = { startsAt: Date; endsAt: Date };

export type Slot = { time: string; startsAt: Date; endsAt: Date; available: boolean; reason?: string };

type Params = {
  dateStr: string;
  durationMinutes: number;
  slotStepMinutes: number;
  openingHours: OpeningHours;
  capacity: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bookings: Interval[]; // aktive Buchungen der Ressource
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

export function computeSlots(p: Params): Slot[] {
  const now = p.now ?? new Date();
  const weekday = zurichParts(zurichToUtc(p.dateStr, "12:00")).weekday;
  const ranges = p.openingHours[String(weekday)] ?? [];
  const earliest = new Date(now.getTime() + p.minLeadMinutes * 60_000);
  const lastDay = addDays(todayZurich(), p.maxAdvanceDays);
  const beyond = p.dateStr > lastDay;
  const slots: Slot[] = [];
  for (const [from, to] of ranges) {
    const start = toMinutes(from);
    const end = toMinutes(to);
    for (let t = start; t + p.durationMinutes <= end; t += p.slotStepMinutes) {
      const startsAt = zurichToUtc(p.dateStr, fromMinutes(t));
      const endsAt = new Date(startsAt.getTime() + p.durationMinutes * 60_000);
      const slot: Interval = { startsAt, endsAt };
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
      } else if (p.bookings.filter((b) => overlaps(b, slot)).length >= p.capacity) {
        available = false;
        reason = "Belegt";
      }
      slots.push({ time: fromMinutes(t), startsAt, endsAt, available, reason });
    }
  }
  return slots;
}
