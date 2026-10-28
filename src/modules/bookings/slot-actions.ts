"use server";

import { requireModule, requirePermission } from "@/lib/tenant";
import { getBookingSettings, getResource, getSlotsForDay, expireUnpaidOnlineBookings } from "./queries";
import { maxPersonsFor, planRequest, quotePrice } from "./pricing";
import { isCalendarDate } from "./types";

export type SlotDto = {
  time: string; available: boolean; reason?: string;
  basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number;
  persons: number; isFlatRate: boolean; unitLabel: string | null; detail: string | null;
  /** Freie Plätze im Zeitfenster (nur sinnvoll, wenn jede Person einen Platz belegt). */
  remaining: number;
};

export type SlotsResult = { slots: SlotDto[]; error?: string; maxPersons?: number };

async function slotsFor(tenantId: string, resourceId: string, dateStr: string, durationMinutes: number, persons: number, bypassLimits: boolean): Promise<SlotsResult> {
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
  const slots = await getSlotsForDay(tenantId, resource, settings, dateStr, durationMinutes, { bypassLimits, requestedUnits: plan.units });
  return {
    maxPersons,
    slots: slots.map((s) => {
      const q = quotePrice(option, s.startsAt, settings, plan.persons);
      return { time: s.time, available: s.available, reason: s.reason, remaining: s.remaining, ...q };
    }),
  };
}

export async function fetchSlotsAction(resourceId: string, dateStr: string, durationMinutes: number, persons = 1): Promise<SlotsResult> {
  const ctx = await requireModule("bookings");
  return slotsFor(ctx.tenant.id, resourceId, dateStr, durationMinutes, persons, false);
}

/** Wie fetchSlotsAction, aber für die Verwaltung ohne Vorlauf- und Vorausbuchungsgrenze. */
export async function fetchAdminSlotsAction(resourceId: string, dateStr: string, durationMinutes: number, persons = 1): Promise<SlotsResult> {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings")) return { slots: [], error: "Modul nicht aktiv" };
  return slotsFor(ctx.tenant.id, resourceId, dateStr, durationMinutes, persons, true);
}
