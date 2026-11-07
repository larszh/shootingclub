import type { ModuleKey } from "@/lib/modules";
import type { Permission } from "@/lib/permissions";

/** Vorschläge zum Antippen (i18n-Schlüssel), passend zu Modulen und Rechten. Höchstens 3. */
export function helpSuggestionKeys(ctx: { hasModule: (k: ModuleKey) => boolean; can: (p: Permission) => boolean }): string[] {
  const out: string[] = [];
  if (ctx.can("tenant.manage")) out.push("aihelp.suggest.inviteMembers");
  if (ctx.hasModule("bookings")) out.push("aihelp.suggest.booking");
  if (ctx.hasModule("scores")) out.push("aihelp.suggest.scores");
  if (ctx.hasModule("events")) out.push("aihelp.suggest.events");
  out.push("aihelp.suggest.offline");
  return out.slice(0, 3);
}
