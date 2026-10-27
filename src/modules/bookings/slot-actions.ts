"use server";

import { requireModule, requirePermission } from "@/lib/tenant";
import { getBookingSettings, getResource, getSlotsForDay, expireUnpaidOnlineBookings } from "./queries";
import { quotePrice } from "./pricing";

export type SlotDto = { time: string; available: boolean; reason?: string; basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number };

async function slotsFor(tenantId: string, resourceId: string, dateStr: string, durationMinutes: number, bypassLimits: boolean): Promise<{ slots: SlotDto[]; error?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { slots: [], error: "Ungültiges Datum" };
  if (typeof resourceId !== "string" || !Number.isFinite(durationMinutes)) return { slots: [], error: "Ungültige Eingabe" };
  const [settings, resource] = await Promise.all([getBookingSettings(tenantId), getResource(tenantId, resourceId)]);
  if (!resource) return { slots: [], error: "Ressource nicht gefunden" };
  const option = (resource.durationOptions ?? settings.durationOptions).find((o) => o.minutes === durationMinutes);
  if (!option) return { slots: [], error: "Dauer nicht verfügbar" };
  await expireUnpaidOnlineBookings(tenantId);
  const slots = await getSlotsForDay(tenantId, resource, settings, dateStr, durationMinutes, { bypassLimits });
  return {
    slots: slots.map((s) => {
      const q = quotePrice(option, s.startsAt, settings);
      return { time: s.time, available: s.available, reason: s.reason, ...q };
    }),
  };
}

export async function fetchSlotsAction(resourceId: string, dateStr: string, durationMinutes: number): Promise<{ slots: SlotDto[]; error?: string }> {
  const ctx = await requireModule("bookings");
  return slotsFor(ctx.tenant.id, resourceId, dateStr, durationMinutes, false);
}

/** Wie fetchSlotsAction, aber für die Verwaltung ohne Vorlauf- und Vorausbuchungsgrenze. */
export async function fetchAdminSlotsAction(resourceId: string, dateStr: string, durationMinutes: number): Promise<{ slots: SlotDto[]; error?: string }> {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("bookings")) return { slots: [], error: "Modul nicht aktiv" };
  return slotsFor(ctx.tenant.id, resourceId, dateStr, durationMinutes, true);
}
