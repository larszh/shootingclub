import { addDays, todayZurich, zurichParts } from "@/lib/time";
import { isEventKind } from "./types";
import type { EventFormDefaults } from "./ui/event-form";

type EventRow = {
  id: string; title: string; kind: string; startsAt: Date; endsAt: Date | null; allDay: boolean; location: string | null;
  description: string | null; rsvpEnabled: boolean; capacity: number | null; rsvpDeadline: Date | null;
};

export function blankEventDefaults(): EventFormDefaults {
  return {
    title: "", kind: "TRAINING", date: todayZurich(), allDay: false, timeFrom: "18:30", timeTo: "20:30", endDate: "",
    location: "", description: "", rsvpEnabled: true, capacity: "", deadlineDate: "", deadlineTime: "",
  };
}

/** Formularwerte aus einem bestehenden Anlass; `shiftDays` verschiebt alle Daten (Duplizieren). */
export function eventToDefaults(e: EventRow, opts: { keepId: boolean; shiftDays?: number; titleSuffix?: string }): EventFormDefaults {
  const shift = opts.shiftDays ?? 0;
  const start = zurichParts(e.startsAt);
  const end = e.endsAt ? zurichParts(e.endsAt) : null;
  const deadline = e.rsvpDeadline ? zurichParts(e.rsvpDeadline) : null;
  return {
    id: opts.keepId ? e.id : undefined,
    title: e.title + (opts.titleSuffix ?? ""),
    kind: isEventKind(e.kind) ? e.kind : "OTHER",
    date: addDays(start.dateStr, shift),
    allDay: e.allDay,
    timeFrom: e.allDay ? "" : start.timeStr,
    timeTo: !e.allDay && end ? end.timeStr : "",
    endDate: e.allDay && end && end.dateStr !== start.dateStr ? addDays(end.dateStr, shift) : "",
    location: e.location ?? "",
    description: e.description ?? "",
    rsvpEnabled: e.rsvpEnabled,
    capacity: e.capacity ? String(e.capacity) : "",
    deadlineDate: deadline ? addDays(deadline.dateStr, shift) : "",
    deadlineTime: deadline ? deadline.timeStr : "",
  };
}
