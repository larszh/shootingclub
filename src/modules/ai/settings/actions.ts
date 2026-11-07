"use server";

/**
 * Server Actions der KI-Einstellungen. Plattform: nur Super-Admins. Verein: tenant.manage + ai.manage.
 * Schlüssel werden nie zurückgegeben oder protokolliert (Audit nur mit Hinweis «…abcd»).
 */
import { revalidatePath } from "next/cache";
import { requirePermission, requireSuperAdmin } from "@/lib/tenant";
import { getRequestLocale } from "@/lib/i18n";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getPlatformAiSettings, getTenantAiSettings, removeKey, saveKey, testKey, testStoredKey, type AiScopeRef } from "@/lib/ai";
import { aiT } from "./i18n";
import { clubEnableBlocker, parsePlatformSettings, parseTenantSettings, settingsAuditDetail } from "./validation";
import { savePlatformSettings, saveTenantSettings, setPlatformFlag, setTenantEnabled, withdrawTenantConsent } from "./service";

export type AiSettingsFormInput = {
  model: string;
  features: string[];
  budget: string;
  budgetUnit: string;
  memberAccess?: string;
};

async function translator() {
  return aiT(await getRequestLocale());
}

const asString = (v: unknown) => (typeof v === "string" ? v : "");
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []);

async function requireClubAdmin() {
  const ctx = await requirePermission("tenant.manage");
  if (!ctx.can("ai.manage")) return null;
  return ctx;
}

function testMessage(t: ReturnType<typeof aiT>, code: string): string {
  const reason = code === "invalidFormat" ? t("aiSet.key.invalidFormat") : code === "noKey" ? t("aiSet.key.noKey") : t(`ai.error.${code}`);
  return t("aiSet.key.testFailed", { reason });
}

// ---------------------------------------------------------------------------
// Plattform

export async function setPlatformFlagAction(flag: string, value: boolean): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const t = await translator();
  if (flag !== "enabled" && flag !== "allowClubs") return fail(t("aiSet.invalid"));
  const on = value === true;
  await setPlatformFlag(flag, on);
  const action = flag === "enabled" ? (on ? "ai.platform.enable" : "ai.platform.disable") : on ? "ai.clubs.allow" : "ai.clubs.deny";
  await audit({ actorId: user.id, actorName: user.name, action, entity: "PlatformAiSettings", entityId: "global" });
  revalidatePath("/super/ai");
  return ok(undefined, t(flag === "enabled" ? (on ? "aiSet.platform.on" : "aiSet.platform.off") : on ? "aiSet.platform.clubsOn" : "aiSet.platform.clubsOff"));
}

export async function savePlatformSettingsAction(input: AiSettingsFormInput): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const t = await translator();
  const parsed = parsePlatformSettings({ model: input?.model, features: asList(input?.features), budget: asString(input?.budget), budgetUnit: input?.budgetUnit });
  if (!parsed.ok) return fail(t(parsed.error), parsed.field ? { [parsed.field]: t(parsed.error) } : undefined);
  await savePlatformSettings(parsed.value);
  await audit({ actorId: user.id, actorName: user.name, action: "ai.settings.update", entity: "PlatformAiSettings", entityId: "global", detail: settingsAuditDetail(parsed.value) });
  revalidatePath("/super/ai");
  return ok(undefined, t("aiSet.settings.saved"));
}

async function saveKeyFor(ref: AiScopeRef, apiKey: unknown, actor: { id: string; name: string }, tenantId: string | null, t: ReturnType<typeof aiT>): Promise<ActionResult<{ keyHint: string }>> {
  const key = asString(apiKey).trim();
  if (!key) return fail(t("aiSet.key.empty"), { apiKey: t("aiSet.key.empty") });
  const res = await saveKey(ref, key);
  if (!res.ok) return fail(t("aiSet.key.invalidFormat"), { apiKey: t("aiSet.key.invalidFormat") });
  await audit({ tenantId, actorId: actor.id, actorName: actor.name, action: "ai.key.save", entity: ref.scope === "platform" ? "PlatformAiSettings" : "TenantAiSettings", entityId: tenantId ?? "global", detail: `…${res.keyHint}` });
  return ok({ keyHint: res.keyHint }, t("aiSet.key.saved", { hint: res.keyHint }));
}

async function testKeyFor(ref: AiScopeRef, apiKey: unknown, actor: { id: string; name: string }, tenantId: string | null, t: ReturnType<typeof aiT>): Promise<ActionResult> {
  const key = asString(apiKey).trim();
  const res = key ? await testKey(key) : await testStoredKey(ref);
  const hint = key ? `…${key.slice(-4)}` : "stored";
  await audit({
    tenantId, actorId: actor.id, actorName: actor.name, action: "ai.key.test",
    entity: ref.scope === "platform" ? "PlatformAiSettings" : "TenantAiSettings", entityId: tenantId ?? "global",
    detail: `${key ? "entered" : "stored"} ${hint} ${res.ok ? "ok" : res.code}`,
  });
  if (res.ok) return ok(undefined, t("aiSet.key.testOk"));
  return fail(testMessage(t, res.code));
}

export async function savePlatformKeyAction(apiKey: string): Promise<ActionResult<{ keyHint: string }>> {
  const user = await requireSuperAdmin();
  const t = await translator();
  const res = await saveKeyFor({ scope: "platform" }, apiKey, user, null, t);
  revalidatePath("/super/ai");
  return res;
}

export async function testPlatformKeyAction(apiKey?: string): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  return testKeyFor({ scope: "platform" }, apiKey, user, null, await translator());
}

export async function removePlatformKeyAction(): Promise<ActionResult> {
  const user = await requireSuperAdmin();
  const t = await translator();
  const before = await getPlatformAiSettings();
  await removeKey({ scope: "platform" });
  await audit({ actorId: user.id, actorName: user.name, action: "ai.key.remove", entity: "PlatformAiSettings", entityId: "global", detail: before.keyHint ? `…${before.keyHint}` : undefined });
  revalidatePath("/super/ai");
  return ok(undefined, t("aiSet.key.removed"));
}

// ---------------------------------------------------------------------------
// Verein

export async function saveClubSettingsAction(input: AiSettingsFormInput): Promise<ActionResult> {
  const ctx = await requireClubAdmin();
  const t = await translator();
  if (!ctx) return fail(t("aiSet.denied"));
  const parsed = parseTenantSettings({
    model: input?.model, features: asList(input?.features), memberAccess: input?.memberAccess,
    budget: asString(input?.budget), budgetUnit: input?.budgetUnit,
  });
  if (!parsed.ok) return fail(t(parsed.error), parsed.field ? { [parsed.field]: t(parsed.error) } : undefined);
  await saveTenantSettings(ctx.tenant.id, parsed.value);
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "ai.settings.update", entity: "TenantAiSettings", entityId: ctx.tenant.id, detail: settingsAuditDetail(parsed.value) });
  revalidatePath("/admin/ai");
  return ok(undefined, t("aiSet.settings.saved"));
}

export async function setClubEnabledAction(enabled: boolean, consentChecked: boolean): Promise<ActionResult> {
  const ctx = await requireClubAdmin();
  const t = await translator();
  if (!ctx) return fail(t("aiSet.denied"));
  const tenantId = ctx.tenant.id;
  if (enabled === true) {
    const [settings, platform] = await Promise.all([getTenantAiSettings(tenantId), getPlatformAiSettings()]);
    const blocker = clubEnableBlocker({ allowClubs: platform.allowClubs, hasKey: settings.hasKey, consentGiven: !!settings.consentAt, consentChecked: consentChecked === true });
    if (blocker) return fail(t(blocker));
    await setTenantEnabled(tenantId, true, settings.consentAt ? null : { userId: ctx.user.id });
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "ai.enable", entity: "TenantAiSettings", entityId: tenantId, detail: settings.consentAt ? undefined : "consent given" });
  } else {
    await setTenantEnabled(tenantId, false, null);
    await audit({ tenantId, actorId: ctx.user.id, actorName: ctx.user.name, action: "ai.disable", entity: "TenantAiSettings", entityId: tenantId });
  }
  revalidatePath("/", "layout");
  return ok(undefined, t(enabled === true ? "aiSet.club.on" : "aiSet.club.off"));
}

export async function withdrawClubConsentAction(): Promise<ActionResult> {
  const ctx = await requireClubAdmin();
  const t = await translator();
  if (!ctx) return fail(t("aiSet.denied"));
  await withdrawTenantConsent(ctx.tenant.id);
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "ai.consent.withdraw", entity: "TenantAiSettings", entityId: ctx.tenant.id });
  revalidatePath("/", "layout");
  return ok(undefined, t("aiSet.privacy.withdrawn"));
}

export async function saveClubKeyAction(apiKey: string): Promise<ActionResult<{ keyHint: string }>> {
  const ctx = await requireClubAdmin();
  const t = await translator();
  if (!ctx) return fail(t("aiSet.denied"));
  const res = await saveKeyFor({ scope: "tenant", tenantId: ctx.tenant.id }, apiKey, ctx.user, ctx.tenant.id, t);
  revalidatePath("/admin/ai");
  return res;
}

export async function testClubKeyAction(apiKey?: string): Promise<ActionResult> {
  const ctx = await requireClubAdmin();
  const t = await translator();
  if (!ctx) return fail(t("aiSet.denied"));
  return testKeyFor({ scope: "tenant", tenantId: ctx.tenant.id }, apiKey, ctx.user, ctx.tenant.id, t);
}

export async function removeClubKeyAction(): Promise<ActionResult> {
  const ctx = await requireClubAdmin();
  const t = await translator();
  if (!ctx) return fail(t("aiSet.denied"));
  const before = await getTenantAiSettings(ctx.tenant.id);
  await removeKey({ scope: "tenant", tenantId: ctx.tenant.id });
  await audit({ tenantId: ctx.tenant.id, actorId: ctx.user.id, actorName: ctx.user.name, action: "ai.key.remove", entity: "TenantAiSettings", entityId: ctx.tenant.id, detail: before.keyHint ? `…${before.keyHint}` : undefined });
  revalidatePath("/admin/ai");
  return ok(undefined, t("aiSet.key.removed"));
}
