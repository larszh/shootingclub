import "server-only";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/tenant";

/** Modul «Standbetrieb» aktiv (alle Mitglieder). */
export async function requireRange() {
  return requireModule("range");
}

/** Modul aktiv und Recht «range.duty» (Standdienst: Standbuch, Check-in, Gäste). */
export async function requireRangeDuty() {
  const ctx = await requireModule("range");
  if (!ctx.can("range.duty")) redirect("/range?denied=1");
  return ctx;
}

/** Modul aktiv und Recht «range.manage» (Standordnung, Schiesszeiten, Kontingent, Vorfälle). */
export async function requireRangeAdmin() {
  const ctx = await requireModule("range");
  if (!ctx.can("range.manage")) redirect("/range?denied=1");
  return ctx;
}

/** Vereinswaffen am Stand ausgeben: Modul «weapons» aktiv und Recht «weapons.loan». */
export function canLoanWeapons(ctx: { hasModule: (k: "weapons") => boolean; can: (p: "weapons.loan") => boolean }) {
  return ctx.hasModule("weapons") && ctx.can("weapons.loan");
}
