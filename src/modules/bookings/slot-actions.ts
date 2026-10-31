"use server";

import { requireModule, requirePermission } from "@/lib/tenant";
import { getBookingSettings, getResource, getSlotsForDay, expireUnpaidOnlineBookings } from "./queries";
import { maxPersonsFor, planRequest, quotePrice } from "./pricing";
import { isCalendarDate } from "./types";
import { loadBookingWindows } from "@/modules/range/booking-window";
import { applyWindowsToSlots } from "@/modules/range/logic";

export type SlotDto = {
  time: string; available: boolean; reason?: string;
  basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number;
  persons: number; isFlatRate: boolean; unitLabel: string | null; detail: string | null;
  /** Freie Plätze im Zeitfenster (nur sinnvoll, wenn jede Person einen Platz belegt). */
  remaining: number;
};

export type SlotsResult = {
  slots: SlotDto[]; error?: string; maxPersons?: number;
  /** Bewilligte Schiesszeiten des Tages (Modul «Standbetrieb»), null wenn keine gelten. */
  windowHint?: string | null;
  /** Anzahl Zeiten ausserhalb der Schiesszeiten. */
  outsideWindow?: number;
  /** Zeiten ausserhalb der Schiesszeiten bleiben wählbar (Verwaltung, Buchung erhält einen Vermerk). */
  windowOverride?: boolean;
};

/** Schiesszeiten: wie createBookingAction prüft (Mitglieder abgewiesen, Verwaltung mit Vermerk). */
type WindowMode = { block: boolean } | null;

async function slotsFor(tenantId: string, resourceId: string, dateStr: string, durationMinutes: number, persons: number, bypassLimits: boolean, windowMode: WindowMode): Promise<SlotsResult> {
  if (!isCalendarDate(dateStr)) return { slots: [], error: "Ungültiges Datum" };
  if (typeof resourceId !== "string" || !Number.isFinite(durationMinutes)) return { slots: [], error: "Ungültige Eingabe" };
  if (!Number.isInteger(persons) || persons < 1) return { slots: [], error: "Ungültige Anzahl Personen" };
  const [settings, resource] = await Promise.all([getBookingSettings(tenantId), getResource(tenantId, resourceId)]);
  if (!resource) return { slots: [], error: "Ressource nicht gefunden" };
  const option = (resource.durationOptions ?? settings.durationOptions).find((o) => o.minutes === durationMinutes);
  if (!option) return { slots: [], error: "Dauer nicht verfügbar" };
  const maxPersons = maxPersonsFor(resource, settings);
  if (persons > maxPersons) return { slots: [], error: `Höchstens ${maxPersons} ${maxPersons === 1 ? "Person" : "Personen"} pro Buchung`, maxPersons };
  const plan = planRequest(option, resource, settings, persons);
  await expireUnpaidOnlineBookings(tenantId);
  const raw = await getSlotsForDay(tenantId, resource, settings, dateStr, durationMinutes, { bypassLimits, requestedUnits: plan.units });
  const windowed = windowMode
    ? applyWindowsToSlots(await loadBookingWindows(tenantId, resource.id), resource.id, dateStr, raw, windowMode.block)
    : { slots: raw, hint: null, outside: 0 };
  const slots = windowed.slots;
  return {
    maxPersons,
    windowHint: windowed.hint,
    outsideWindow: windowed.outside,
    windowOverride: !!windowMode && !windowMode.block && windowed.outside > 0,
    slots: slots.map((s) => {
      const q = quotePrice(option, s.startsAt, settings, plan.persons);
      return { time: s.time, available: s.available, reason: s.reason, remaining: s.remaining, ...q };
    }),
  };
}

export async function fetchSlotsAction(resourceId: string, dateStr: string, durationMinutes: number, persons = 1): Promise<SlotsResult> {
  const ctx = await requireModule("bookings");
  const windowMode = ctx.hasModule("range") ? { block: !ctx.can("tenant.manage") } : null;
  return slotsFor(ctx.tenant.id, resourceId, dateStr, durationMinutes, persons, false, windowMode);
}

/** Wie fetchSlotsAction, aber für die Verwaltung ohne Vorlauf- und Vorausbuchungsgrenze. */
export async function fetchAdminSlotsAction(resourceId: string, dateStr: string, durationMinutes: number, persons = 1): Promise<SlotsResult> {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings")) return { slots: [], error: "Modul nicht aktiv" };
  const windowMode = ctx.hasModule("range") ? { block: false } : null;
  return slotsFor(ctx.tenant.id, resourceId, dateStr, durationMinutes, persons, true, windowMode);
}
