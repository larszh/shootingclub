import "server-only";
import { redirect } from "next/navigation";
import { requireModule, type ActiveTenant, type AppContext } from "@/lib/tenant";

export type ChampionshipCtx = AppContext & { tenant: ActiveTenant };

/** Modul «Jahresmeisterschaft» aktiv (alle Mitglieder sehen veröffentlichte Ranglisten). */
export async function requireChampionship() {
  return requireModule("championship");
}

/** Modul aktiv und Recht «championship.manage» (Admin). */
export async function requireChampionshipAdmin() {
  const ctx = await requireModule("championship");
  if (!ctx.can("championship.manage")) redirect("/championship?denied=1");
  return ctx;
}

export function canManageChampionship(ctx: AppContext) {
  return ctx.can("championship.manage");
}

/** Unveröffentlichte Meisterschaften sieht nur, wer sie verwalten darf. */
export function canViewChampionship(ctx: AppContext, c: { isPublished: boolean }) {
  return c.isPublished || ctx.can("championship.manage");
}
