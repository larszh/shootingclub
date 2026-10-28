import "server-only";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";

/** Modul «Munition» aktiv und Recht «ammo.manage» (Admin). */
export async function requireAmmoAdmin() {
  const ctx = await requireModule("ammo");
  if (!ctx.can("ammo.manage")) redirect("/?denied=1");
  return ctx;
}

/** Modul «Munition» aktiv (alle Mitglieder). */
export async function requireAmmo() {
  return requireModule("ammo");
}
