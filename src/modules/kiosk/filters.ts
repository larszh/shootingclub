import "server-only";
import { todayZurich } from "@/lib/time";
import { parseStatusFilter, resolvePeriod } from "@/modules/kiosk/logic";
import type { EntryFilters } from "@/modules/kiosk/queries";

export type EntrySearchParams = { from?: string; to?: string; preset?: string; status?: string; user?: string; q?: string };

/** Filter der Einträge aus den Suchparametern (Standard: dieser Monat, alle). */
export function entryFiltersFrom(sp: EntrySearchParams) {
  const today = todayZurich();
  const period = resolvePeriod({ from: sp.from, to: sp.to, preset: sp.preset ?? (sp.from ? undefined : "this-month") }, today);
  const filters: EntryFilters = {
    from: period.from,
    to: period.to,
    status: parseStatusFilter(sp.status),
    userId: sp.user && sp.user.length <= 40 ? sp.user : null,
    q: sp.q?.trim().slice(0, 80) || null,
  };
  return { today, period, filters };
}
