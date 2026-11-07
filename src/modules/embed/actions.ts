"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireTenant } from "@/lib/tenant";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestLocale, getT } from "@/lib/i18n";
import { getBaseUrl } from "@/modules/events/queries";
import { PERIODS } from "@/modules/scores/analytics";
import { parseTheme, widgetPath } from "./logic";
import { signEmbed } from "./signing";

async function requireAdmin() {
  const ctx = await requireTenant();
  if (!ctx.can("tenant.manage")) return null;
  return ctx;
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

export type EmbedTokenResult = { token: string | null };

const tr = async () => getT(await getRequestLocale());

/** Erstellt den Embed-Token, falls noch keiner existiert. */
export async function createEmbedTokenAction(): Promise<ActionResult<EmbedTokenResult>> {
  const t = await tr();
  const ctx = await requireAdmin();
  if (!ctx) return fail(t("adm2.embed.msg.onlyAdmins"));
  const token = newToken();
  const res = await db.tenant.updateMany({ where: { id: ctx.tenant.id, embedToken: null }, data: { embedToken: token } });
  const row = await db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { embedToken: true } });
  if (res.count) await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "embed.token.create", entity: "Tenant", entityId: ctx.tenant.id });
  revalidatePath("/admin/embed");
  return ok({ token: row?.embedToken ?? null }, t("adm2.embed.msg.ready"));
}

/** Neuer Token: alle bisherigen Codes auf Websites funktionieren nicht mehr. */
export async function regenerateEmbedTokenAction(): Promise<ActionResult<EmbedTokenResult>> {
  const t = await tr();
  const ctx = await requireAdmin();
  if (!ctx) return fail(t("adm2.embed.msg.onlyAdmins"));
  const token = newToken();
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { embedToken: token } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "embed.token.regenerate", entity: "Tenant", entityId: ctx.tenant.id, detail: "Alle bisherigen Widget-Codes ungültig" });
  revalidatePath("/admin/embed");
  return ok({ token }, t("adm2.embed.msg.newCode"));
}

/** Widgets abschalten (Token löschen). */
export async function revokeEmbedTokenAction(): Promise<ActionResult<EmbedTokenResult>> {
  const t = await tr();
  const ctx = await requireAdmin();
  if (!ctx) return fail(t("adm2.embed.msg.onlyAdmins"));
  await db.tenant.update({ where: { id: ctx.tenant.id }, data: { embedToken: null } });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "embed.token.revoke", entity: "Tenant", entityId: ctx.tenant.id });
  revalidatePath("/admin/embed");
  return ok({ token: null }, t("adm2.embed.msg.off"));
}

const signSchema = z.discriminatedUnion("widget", [
  z.object({ widget: z.literal("ranking"), program: z.string().min(1).max(40), period: z.enum(PERIODS.map((p) => p.key) as [string, ...string[]]), theme: z.string().max(10).optional() }),
  z.object({ widget: z.literal("championship"), id: z.string().min(1).max(40), theme: z.string().max(10).optional() }),
]);

export type SignedWidgetUrl = { url: string; path: string; sig: string };

/**
 * Erzeugt die signierte URL für Rangliste bzw. Meisterschaft. Nur damit zeigt das Widget Namen:
 * Der Admin entscheidet mit dem Erzeugen des Codes, was öffentlich wird.
 */
export async function signWidgetAction(input: unknown): Promise<ActionResult<SignedWidgetUrl>> {
  const t = await tr();
  const ctx = await requireAdmin();
  if (!ctx) return fail(t("adm2.embed.msg.onlyAdmins"));
  const parsed = signSchema.safeParse(input);
  if (!parsed.success) return fail(t("adm2.embed.msg.checkSelection"));
  const row = await db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { embedToken: true } });
  if (!row?.embedToken) return fail(t("adm2.embed.msg.enableFirst"));
  const theme = parseTheme(parsed.data.theme);
  const themeParam = theme === "auto" ? null : theme;

  let params: Record<string, string | null>;
  let sig: string | null;
  if (parsed.data.widget === "ranking") {
    const program = await db.program.findFirst({ where: { id: parsed.data.program, OR: [{ tenantId: null }, { tenantId: ctx.tenant.id }] }, select: { id: true, name: true } });
    if (!program) return fail(t("adm2.embed.msg.programNotFound"));
    sig = signEmbed(row.embedToken, "ranking", { program: program.id, period: parsed.data.period });
    params = { program: program.id, period: parsed.data.period, theme: themeParam, sig };
    if (sig) await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "embed.widget.publish", entity: "Program", entityId: program.id, detail: `Rangliste «${program.name}» (${parsed.data.period}) für die Website freigegeben` });
  } else {
    const c = await db.championship.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenant.id }, select: { id: true, name: true, isPublished: true } });
    if (!c) return fail(t("adm2.embed.msg.chNotFound"));
    if (!c.isPublished) return fail(t("adm2.embed.msg.chUnpublished"));
    sig = signEmbed(row.embedToken, "championship", { id: c.id });
    params = { id: c.id, theme: themeParam, sig };
    if (sig) await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, action: "embed.widget.publish", entity: "Championship", entityId: c.id, detail: `Meisterschaft «${c.name}» für die Website freigegeben` });
  }
  if (!sig) return fail(t("adm2.embed.msg.noSecret"));
  const path = widgetPath(row.embedToken, parsed.data.widget, params);
  return ok({ path, sig, url: (await getBaseUrl()) + path });
}
