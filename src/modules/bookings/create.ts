import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getSlotsForDay, type BookingSettingsView, type ResourceView } from "./queries";

export const SLOT_TAKEN = "Dieser Termin wurde soeben vergeben. Bitte eine andere Zeit wählen.";

/**
 * Prüft die Verfügbarkeit erneut und legt die Buchung im selben Schritt an. Die Ressourcen-Zeile
 * wird dafür gesperrt, damit parallele Anfragen die Kapazität nicht gemeinsam überschreiten.
 * Liefert null, wenn der Termin inzwischen belegt ist.
 * `tenantId` ist der Verein, dem die Ressource gehört (bei gemeinsamen Anlagen der Eigentümer).
 */
export async function createBookingIfFree(
  slotQuery: { tenantId: string; resource: ResourceView; settings: BookingSettingsView; date: string; time: string; durationMinutes: number; requestedUnits: number; bypassLimits?: boolean },
  data: Prisma.BookingUncheckedCreateInput,
) {
  const { tenantId, resource, settings, date, time, durationMinutes, requestedUnits, bypassLimits } = slotQuery;
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM \`Resource\` WHERE id = ${resource.id} FOR UPDATE`;
    const slots = await getSlotsForDay(tenantId, resource, settings, date, durationMinutes, { bypassLimits, client: tx, requestedUnits });
    if (!slots.find((s) => s.time === time)?.available) return null;
    return tx.booking.create({ data });
  });
}
