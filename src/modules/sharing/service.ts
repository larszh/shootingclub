import "server-only";
import { expireUnpaidOnlineBookings, getSlotsForDay } from "@/modules/bookings/queries";
import { maxPersonsFor, planRequest, quotePrice } from "@/modules/bookings/pricing";
import { isCalendarDate } from "@/modules/bookings/types";
import type { SlotsResult } from "@/modules/bookings/slot-actions";
import { loadBookingWindows } from "@/modules/range/booking-window";
import { applyWindowsToSlots } from "@/modules/range/logic";
import { applyPriceFactor } from "./logic";
import type { GuestShare } from "./queries";

/**
 * Freie Zeiten einer geteilten Ressource für ein Mitglied eines Partnervereins. Es gelten alle
 * Regeln des Eigentümers (Öffnungszeiten, Vorlauf, Vorausbuchung, Sperrzeiten, Kapazität und, mit
 * Modul «Standbetrieb», die bewilligten Schiesszeiten). Preise mit dem Faktor der Freigabe.
 * Gibt nur Zeiten und Gründe zurück, keine Angaben zu anderen Buchungen.
 */
export async function guestSlots(g: GuestShare, dateStr: string, durationMinutes: number, persons: number): Promise<SlotsResult> {
  if (!isCalendarDate(dateStr)) return { slots: [], error: "Ungültiges Datum" };
  if (!Number.isFinite(durationMinutes)) return { slots: [], error: "Ungültige Eingabe" };
  if (!Number.isInteger(persons) || persons < 1) return { slots: [], error: "Ungültige Anzahl Personen" };
  const { resource, settings, owner } = g;
  const option = (resource.durationOptions ?? settings.durationOptions).find((o) => o.minutes === durationMinutes);
  if (!option) return { slots: [], error: "Dauer nicht verfügbar" };
  const maxPersons = maxPersonsFor(resource, settings);
  if (persons > maxPersons) return { slots: [], error: `Höchstens ${maxPersons} ${maxPersons === 1 ? "Person" : "Personen"} pro Buchung`, maxPersons };
  const plan = planRequest(option, resource, settings, persons);
  await expireUnpaidOnlineBookings(owner.id);
  const raw = await getSlotsForDay(owner.id, resource, settings, dateStr, durationMinutes, { requestedUnits: plan.units });
  const windowed = g.ownerHasRange
    ? applyWindowsToSlots(await loadBookingWindows(owner.id, resource.id), resource.id, dateStr, raw, true)
    : { slots: raw, hint: null, outside: 0 };
  return {
    maxPersons,
    windowHint: windowed.hint,
    outsideWindow: windowed.outside,
    windowOverride: false,
    slots: windowed.slots.map((s) => {
      const q = applyPriceFactor(quotePrice(option, s.startsAt, settings, plan.persons), g.priceFactorPercent);
      return { time: s.time, available: s.available, reason: s.reason, remaining: s.remaining, ...q };
    }),
  };
}
