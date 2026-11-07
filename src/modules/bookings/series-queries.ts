import "server-only";
import { db } from "@/lib/db";
import { getBookingSettings, getResource, type BookingSettingsView, type DbClient, type ResourceView } from "./queries";
import { bookingUnits, maxPersonsFor } from "./pricing";
import { checkOccurrence, seriesOccurrences, type CheckedOccurrence, type Occurrence } from "./series";
import { loadBookingWindows } from "@/modules/range/booking-window";
import { checkWithinWindows } from "@/modules/range/logic";

export type SeriesInput = {
  resourceId: string;
  weekdays: number[];
  fromDate: string;
  untilDate: string;
  startTime: string;
  endTime: string;
  persons: number;
};

export type SeriesPlan = {
  resource: ResourceView;
  settings: BookingSettingsView;
  units: number;
  items: Array<CheckedOccurrence<Occurrence>>;
};

/**
 * Erzeugt alle Termine einer Serie und prüft jeden einzeln gegen Öffnungszeiten, Sperrzeiten,
 * Kapazität (bestehende aktive Buchungen) und – mit Modul «Standbetrieb» – die Schiesszeiten.
 * Liest Buchungen und Sperrzeiten des ganzen Zeitraums mit einer Abfrage (optional in einer Transaktion).
 */
export async function planSeries(tenantId: string, input: SeriesInput, opts: { withWindows: boolean; client?: DbClient; now?: Date }): Promise<SeriesPlan | { error: "resource" | "persons"; max?: number }> {
  const client = opts.client ?? db;
  const [settings, resource] = await Promise.all([getBookingSettings(tenantId), getResource(tenantId, input.resourceId)]);
  if (!resource || !resource.isActive) return { error: "resource" };
  const max = maxPersonsFor(resource, settings);
  if (input.persons > max) return { error: "persons", max };
  const units = bookingUnits({ persons: input.persons, isFlatRate: false }, resource.capacity, settings);
  const occurrences = seriesOccurrences(input);
  if (!occurrences.length) return { resource, settings, units, items: [] };
  const first = occurrences[0]!.startsAt;
  const last = occurrences[occurrences.length - 1]!.endsAt;
  const [bookings, blocks, windows] = await Promise.all([
    client.booking.findMany({
      where: { resourceId: resource.id, status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: last }, endsAt: { gt: first } },
      select: { startsAt: true, endsAt: true, units: true, persons: true, isFlatRate: true },
    }),
    client.resourceBlock.findMany({ where: { tenantId, OR: [{ resourceId: null }, { resourceId: resource.id }], startsAt: { lt: last }, endsAt: { gt: first } }, select: { startsAt: true, endsAt: true } }),
    opts.withWindows ? loadBookingWindows(tenantId, resource.id) : Promise.resolve([]),
  ]);
  // Wie getSlotsForDay: gespeicherte Einheiten mindestens nach heutigen Regeln zählen.
  const unitBookings = bookings.map((b) => ({ startsAt: b.startsAt, endsAt: b.endsAt, units: Math.max(b.units, bookingUnits(b, resource.capacity, settings)) }));
  const items = occurrences.map((o) => {
    const insideWindow = opts.withWindows ? checkWithinWindows(windows, resource.id, o.startsAt, o.endsAt).ok : undefined;
    const conflict = checkOccurrence({
      occurrence: { ...o, startTime: input.startTime, endTime: input.endTime },
      openingHours: settings.openingHours, capacity: resource.capacity, requestedUnits: units,
      bookings: unitBookings, blocks, insideWindow, now: opts.now,
    });
    return { ...o, conflict };
  });
  return { resource, settings, units, items };
}

/** Serien des Vereins (neueste zuerst) mit Anzahl aktiver künftiger Termine. */
export async function listSeries(tenantId: string, opts?: { userId?: string }) {
  const now = new Date();
  const rows = await db.bookingSeries.findMany({
    where: { tenantId, ...(opts?.userId ? { userId: opts.userId } : {}) },
    include: {
      resource: { select: { id: true, name: true, kind: true } },
      user: { select: { id: true, name: true } },
      _count: { select: { bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { gt: now } } } } },
    },
    orderBy: [{ status: "asc" }, { fromDate: "desc" }],
    take: 200,
  });
  return rows.map((s) => ({ ...s, upcoming: s._count.bookings }));
}

/** Eine Serie mit allen Terminen (aufsteigend). */
export async function getSeries(tenantId: string, id: string) {
  if (typeof id !== "string" || !id || id.length > 40) return null;
  const s = await db.bookingSeries.findUnique({
    where: { id },
    include: {
      resource: { select: { id: true, name: true, kind: true } },
      user: { select: { id: true, name: true } },
      bookings: { orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, status: true, persons: true, cancelledAt: true } },
    },
  });
  return s && s.tenantId === tenantId ? s : null;
}
export type SeriesView = NonNullable<Awaited<ReturnType<typeof getSeries>>>;
