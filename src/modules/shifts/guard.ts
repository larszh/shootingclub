import "server-only";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";

/** Modul «Helfereinsätze» aktiv (alle Mitglieder). */
export async function requireShifts() {
  return requireModule("shifts");
}

/** Modul aktiv und Recht «shifts.manage» (Einsätze planen, Stunden bestätigen, Ersatzabgabe). */
export async function requireShiftsAdmin() {
  const ctx = await requireModule("shifts");
  if (!ctx.can("shifts.manage")) redirect("/shifts?denied=1");
  return ctx;
}
