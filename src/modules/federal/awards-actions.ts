"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireModule } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT } from "@/lib/i18n";
import { canEditYear, currentSwissYear } from "./queries";
import { clubWeaponCategories } from "./awards-queries";
import { MAX_WEAPON_CATEGORY, normalizeWeaponCategory, sameWeaponCategory } from "./awards";

/**
 * Waffenkategorie einer Feldschiessen-Teilnahme setzen oder entfernen (leer = keine Angabe).
 * Erlaubt für den Schützen selbst (solange das Resultat nicht amtlich bestätigt ist) und für
 * Schützenmeister/Verwaltung. Nur Kategorien aus den Limiten des Vereins für dieses Programm.
 */
export async function setWeaponCategoryAction(participantId: string, value: string | null): Promise<ActionResult<{ weaponCategory: string | null }>> {
  const ctx = await requireModule("federal");
  const t = getT(await getRequestLocale());
  if (typeof participantId !== "string" || !participantId || participantId.length > 40) return fail(t("misc.weapon.err.notFound"));
  if (value !== null && (typeof value !== "string" || value.length > MAX_WEAPON_CATEGORY * 2)) return fail(t("misc.weapon.err.unknown"));

  const p = await db.matchParticipant.findUnique({
    where: { id: participantId },
    select: { id: true, userId: true, isOfficial: true, weaponCategory: true, guestName: true, user: { select: { name: true } }, match: { select: { id: true, tenantId: true, date: true, programId: true, program: { select: { name: true, officialKind: true } } } } },
  });
  if (!p || p.match.tenantId !== ctx.tenant.id || p.match.program.officialKind !== "FS") return fail(t("misc.weapon.err.notFound"));
  const staff = canEditYear(ctx);
  const self = !!p.userId && p.userId === ctx.user.id && !p.isOfficial;
  if (!staff && !self) return fail(t("misc.weapon.err.noRight"));

  let next: string | null = normalizeWeaponCategory(value);
  if (next !== null) {
    const allowed = await clubWeaponCategories(ctx.tenant.id, p.match.programId, currentSwissYear(p.match.date));
    const match = allowed.find((w) => sameWeaponCategory(w, next));
    if (!match) return fail(t("misc.weapon.err.unknown"));
    next = match;
  }
  if (next !== p.weaponCategory) {
    await db.matchParticipant.update({ where: { id: p.id }, data: { weaponCategory: next } });
    await audit({
      tenantId: ctx.tenant.id,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      action: "federal.awards.weapon_category",
      entity: "MatchParticipant",
      entityId: p.id,
      detail: `${p.user?.name ?? p.guestName ?? "Gast"} · ${p.match.program.name}: ${p.weaponCategory ?? "–"} → ${next ?? "–"}`,
    });
  }
  revalidatePath("/federal/awards");
  revalidatePath(`/scores/matches/${p.match.id}`);
  return ok({ weaponCategory: next }, t("misc.weapon.saved"));
}
