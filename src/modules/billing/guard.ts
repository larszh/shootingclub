import "server-only";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/tenant";

/**
 * Verwaltungsrecht und aktives Modul «Mitgliederbeiträge» verlangen. Rechnungsprofil und Bankimport
 * dienen auch den Reservations- und Munitionsrechnungen und sind deshalb mit `orBookings` bzw.
 * `orAmmo` auch erreichbar, wenn nur eines dieser Module aktiv ist.
 */
export async function requireBillingAdmin(opts?: { orBookings?: boolean; orAmmo?: boolean }) {
  const ctx = await requirePermission("tenant.manage");
  const allowed = ctx.hasModule("billing") || (opts?.orBookings && ctx.hasModule("bookings")) || (opts?.orAmmo && ctx.hasModule("ammo"));
  if (!allowed) redirect("/?module=billing");
  return ctx;
}
