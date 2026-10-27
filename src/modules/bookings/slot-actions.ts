"use server";

import { requireModule } from "@/lib/tenant";
import { getBookingSettings, getResource, getSlotsForDay, expireUnpaidOnlineBookings } from "./queries";
import { quotePrice } from "./pricing";

export type SlotDto = { time: string; available: boolean; reason?: string; basePriceCents: number; discountCents: number; discountReason: string | null; totalCents: number };

export async function fetchSlotsAction(resourceId: string, dateStr: string, durationMinutes: number): Promise<{ slots: SlotDto[]; error?: string }> {
  const ctx = await requireModule("bookings");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { slots: [], error: "Ungültiges Datum" };
  const [settings, resource] = await Promise.all([getBookingSettings(ctx.tenant.id), getResource(ctx.tenant.id, resourceId)]);
  if (!resource) return { slots: [], error: "Ressource nicht gefunden" };
  const option = (resource.durationOptions ?? settings.durationOptions).find((o) => o.minutes === durationMinutes);
  if (!option) return { slots: [], error: "Dauer nicht verfügbar" };
  await expireUnpaidOnlineBookings(ctx.tenant.id);
  const slots = await getSlotsForDay(ctx.tenant.id, resource, settings, dateStr, durationMinutes);
  return {
    slots: slots.map((s) => {
      const q = quotePrice(option, s.startsAt, settings);
      return { time: s.time, available: s.available, reason: s.reason, ...q };
    }),
  };
}
