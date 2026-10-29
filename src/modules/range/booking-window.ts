import "server-only";
import { db } from "@/lib/db";
import { checkWithinWindows, type WindowCheck } from "./logic";

/**
 * Prüft eine Reservation gegen die bewilligten Schiesszeiten (ShootingWindow) des Vereins.
 * Ohne Fenster für die Ressource bzw. die ganze Anlage ist nichts eingeschränkt.
 * Nur aufrufen, wenn das Modul «range» aktiv ist.
 */
export async function checkBookingWindow(tenantId: string, resourceId: string, startsAt: Date, endsAt: Date): Promise<WindowCheck> {
  const windows = await db.shootingWindow.findMany({
    where: { tenantId, OR: [{ resourceId }, { resourceId: null }] },
    select: { resourceId: true, weekday: true, startMinute: true, endMinute: true },
  });
  return checkWithinWindows(windows, resourceId, startsAt, endsAt);
}

/** Meldung für Mitglieder, wenn eine Reservation ausserhalb der Schiesszeiten liegt. */
export function windowRejectMessage(check: Extract<WindowCheck, { ok: false }>) {
  return `${check.reason} Erlaubt: ${check.allowed}.`;
}
