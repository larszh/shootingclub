import "server-only";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";

/** Modul «Schützenstube» aktiv (alle Mitglieder: eigene Konsumationen). */
export async function requireKiosk() {
  return requireModule("kiosk");
}

/** Modul aktiv und Recht «kiosk.sell» (Theke: Konsumationen erfassen). */
export async function requireKioskSeller() {
  const ctx = await requireModule("kiosk");
  if (!ctx.can("kiosk.sell")) redirect("/kiosk/me");
  return ctx;
}

/** Modul aktiv und Recht «kiosk.manage» (Sortiment, Abrechnung, Einträge). */
export async function requireKioskAdmin() {
  const ctx = await requireModule("kiosk");
  if (!ctx.can("kiosk.manage")) redirect(ctx.can("kiosk.sell") ? "/kiosk?denied=1" : "/kiosk/me?denied=1");
  return ctx;
}
