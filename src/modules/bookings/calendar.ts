import { addDays, formatTimeRange, todayZurich, zurichParts, zurichToUtc } from "@/lib/time";

/** Montag der Woche, in der `dateStr` liegt (Schweizer Kalender). */
export function mondayOf(dateStr: string) {
  const weekday = zurichParts(zurichToUtc(dateStr, "12:00")).weekday; // 0 = So
  return addDays(dateStr, -((weekday + 6) % 7));
}

/** ISO-Kalenderwoche. */
export function isoWeek(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

export function parseWeekParam(raw: string | undefined | null) {
  const base = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayZurich();
  return mondayOf(base);
}

const DAY_LABEL = new Intl.DateTimeFormat("de-CH", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const DAY_LONG = new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export type CalendarBooking = {
  id: string; resourceId: string; startsAt: Date; endsAt: Date; status: string; paymentStatus: string; totalCents: number;
  user: { id: string; name: string; avatarPath: string | null; updatedAt: Date } | null;
  note: string | null;
};
export type CalendarBlock = { id: string; resourceId: string | null; startsAt: Date; endsAt: Date; reason: string | null };

export type CalendarCellItem =
  | { type: "booking"; id: string; time: string; name: string; status: string; unpaid: boolean; user: CalendarBooking["user"]; note: string | null; sort: number }
  | { type: "block"; id: string; time: string; reason: string | null; sort: number };

export type CalendarDay = { date: string; label: string; longLabel: string; isToday: boolean };

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

/** Zeitspanne im Tag; mehrtägige Einträge werden am Tagesrand abgeschnitten. */
function clippedRange(start: Date, end: Date, dayStart: Date, dayEnd: Date) {
  const s = start < dayStart ? dayStart : start;
  const e = end > dayEnd ? dayEnd : end;
  if (s.getTime() === dayStart.getTime() && e.getTime() === dayEnd.getTime()) return "ganzer Tag";
  return formatTimeRange(s, e);
}

/** Wochenraster: Zeilen = Ressourcen, Spalten = Tage (Mo–So). */
export function buildWeek(monday: string, resources: Array<{ id: string; name: string }>, bookings: CalendarBooking[], blocks: CalendarBlock[]) {
  const today = todayZurich();
  const days: CalendarDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const noon = new Date(`${date}T12:00:00Z`);
    return { date, label: DAY_LABEL.format(noon), longLabel: DAY_LONG.format(noon), isToday: date === today };
  });
  const bounds = days.map((d) => ({ start: zurichToUtc(d.date, "00:00"), end: zurichToUtc(addDays(d.date, 1), "00:00") }));

  const rows = resources.map((r) => ({
    resource: r,
    cells: bounds.map(({ start, end }) => {
      const items: CalendarCellItem[] = [];
      for (const b of bookings) {
        if (b.resourceId !== r.id || !overlaps(b.startsAt, b.endsAt, start, end)) continue;
        items.push({ type: "booking", id: b.id, time: clippedRange(b.startsAt, b.endsAt, start, end), name: b.user?.name ?? "Gast", status: b.status, unpaid: b.totalCents > 0 && !["PAID", "NOT_REQUIRED", "REFUNDED"].includes(b.paymentStatus), user: b.user, note: b.note, sort: b.startsAt.getTime() });
      }
      for (const bl of blocks) {
        if ((bl.resourceId && bl.resourceId !== r.id) || !overlaps(bl.startsAt, bl.endsAt, start, end)) continue;
        items.push({ type: "block", id: bl.id, time: clippedRange(bl.startsAt, bl.endsAt, start, end), reason: bl.reason, sort: Math.max(bl.startsAt.getTime(), start.getTime()) });
      }
      return items.sort((a, b) => a.sort - b.sort);
    }),
  }));

  const total = bookings.length;
  return { days, rows, total, week: isoWeek(monday), prev: addDays(monday, -7), next: addDays(monday, 7), isCurrentWeek: mondayOf(today) === monday };
}

/** Erster und letzter Tag des Monats von `dateStr`. */
export function monthRange(dateStr: string) {
  const first = `${dateStr.slice(0, 7)}-01`;
  const nextFirst = `${addDays(first, 32).slice(0, 7)}-01`;
  return { from: first, to: addDays(nextFirst, -1) };
}
