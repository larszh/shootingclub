import "server-only";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";

/** Modul «Vereinswaffen» aktiv und Recht «weapons.loan» (Inventar sehen, ausleihen, zurücknehmen). */
export async function requireWeapons() {
  const ctx = await requireModule("weapons");
  if (!ctx.can("weapons.loan")) redirect("/?denied=1");
  return ctx;
}

/** Modul aktiv und Recht «weapons.manage» (erfassen, bearbeiten, Wartung, Status). */
export async function requireWeaponsAdmin() {
  const ctx = await requireModule("weapons");
  if (!ctx.can("weapons.manage")) redirect("/weapons?denied=1");
  return ctx;
}
