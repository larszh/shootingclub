/**
 * KI-Einstellungen: Daten für /super/ai und /admin/ai laden und speichern.
 * Schlüssel verlassen den Server nie; Ansichten enthalten nur den Hinweis (letzte 4 Zeichen).
 */
import "server-only";
import { db } from "@/lib/db";
import {
  aiAvailability, getPlatformAiSettings, getTenantAiSettings, monthTokensUsed, serializeFeatures,
  type AiContextLike, type Availability, type PlatformAiSettingsView, type TenantAiSettingsView,
} from "@/lib/ai";
import type { PlatformSettingsInput, TenantSettingsInput } from "./validation";

export type AiAuditRow = { id: string; action: string; actorName: string | null; detail: string | null; createdAt: Date };

/** Letzte KI-Änderungen (Aktionen «ai.*») der Plattform (tenantId null) oder eines Vereins. */
export async function aiAuditLog(tenantId: string | null, take = 20): Promise<AiAuditRow[]> {
  return db.auditLog.findMany({
    where: { tenantId, action: { startsWith: "ai." } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, actorName: true, detail: true, createdAt: true },
  });
}

export type PlatformAiOverview = { settings: PlatformAiSettingsView; availability: Availability; usedTokens: number };

export async function platformAiOverview(): Promise<PlatformAiOverview> {
  const [settings, availability, usedTokens] = await Promise.all([
    getPlatformAiSettings(),
    aiAvailability("platform", null),
    monthTokensUsed({ scope: "platform" }),
  ]);
  return { settings, availability, usedTokens };
}

export type TenantAiOverview = {
  settings: TenantAiSettingsView;
  allowClubs: boolean;
  availability: Availability;
  usedTokens: number;
  consentByName: string | null;
};

export async function tenantAiOverview(ctx: AiContextLike & { tenant: { id: string; role: string | null } }): Promise<TenantAiOverview> {
  const tenantId = ctx.tenant.id;
  const [settings, platform, availability, usedTokens] = await Promise.all([
    getTenantAiSettings(tenantId),
    getPlatformAiSettings(),
    aiAvailability(tenantId, null),
    monthTokensUsed({ scope: "tenant", tenantId }),
  ]);
  const consentBy = settings.consentById
    ? await db.user.findUnique({ where: { id: settings.consentById }, select: { name: true } })
    : null;
  return { settings, allowClubs: platform.allowClubs, availability, usedTokens, consentByName: consentBy?.name ?? null };
}

// ---------------------------------------------------------------------------
// Speichern

export async function setPlatformFlag(flag: "enabled" | "allowClubs", value: boolean): Promise<void> {
  const data = flag === "enabled" ? { enabled: value } : { allowClubs: value };
  await db.platformAiSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
}

export async function savePlatformSettings(v: PlatformSettingsInput): Promise<void> {
  const data = { model: v.model, features: serializeFeatures("platform", v.features), monthlyTokenLimit: v.monthlyTokenLimit };
  await db.platformAiSettings.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data });
}

export async function saveTenantSettings(tenantId: string, v: TenantSettingsInput): Promise<void> {
  const data = {
    model: v.model,
    features: serializeFeatures("tenant", v.features),
    memberAccess: v.memberAccess,
    monthlyTokenLimit: v.monthlyTokenLimit,
  };
  await db.tenantAiSettings.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
}

/**
 * Vereins-KI ein- oder ausschalten. Einschalten setzt auch das Modul «ai» und – falls noch nicht
 * vorhanden – die Zustimmung (consentById = wer eingeschaltet hat). Ausschalten schaltet beides aus.
 */
export async function setTenantEnabled(tenantId: string, enabled: boolean, consent: { userId: string } | null): Promise<void> {
  const consentData = consent ? { consentAt: new Date(), consentById: consent.userId } : {};
  await db.$transaction([
    db.tenantAiSettings.upsert({
      where: { tenantId },
      create: { tenantId, enabled, ...consentData },
      update: { enabled, ...consentData },
    }),
    db.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId, moduleKey: "ai" } },
      create: { tenantId, moduleKey: "ai", enabled },
      update: { enabled },
    }),
  ]);
}

/** Zustimmung widerrufen: KI und Modul aus, Zustimmung gelöscht. */
export async function withdrawTenantConsent(tenantId: string): Promise<void> {
  await db.$transaction([
    db.tenantAiSettings.updateMany({ where: { tenantId }, data: { enabled: false, consentAt: null, consentById: null } }),
    db.tenantModule.updateMany({ where: { tenantId, moduleKey: "ai" }, data: { enabled: false } }),
  ]);
}
