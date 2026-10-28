import "server-only";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";

/**
 * Verwaltungsrecht und aktives Modul «Mitgliederbeiträge» verlangen. Rechnungsprofil und Bankimport
 * dienen auch den Reservations-Rechnungen und sind deshalb mit `orBookings` auch dort erreichbar.
 */
export async function requireBillingAdmin(opts?: { orBookings?: boolean }) {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.hasModule("billing") && !(opts?.orBookings && ctx.hasModule("bookings"))) redirect("/?module=billing");
  return ctx;
}
