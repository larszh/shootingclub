import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { getModule } from "@/lib/modules";
import { computeAvailability, type AiActor, type Availability, type PlatformAiState, type TenantAiState } from "./availability";
import { monthTokensUsed } from "./usage";
import {
  normalizeAiModel, normalizeMemberAccess, parseFeatures,
  type AiFeature, type AiModel, type AiUnavailableReason, type MemberAccess, type PlatformFeature, type TenantFeature,
} from "./types";

// ---------------------------------------------------------------------------
// Client-Fabrik (in Tests ersetzbar, nie echte Aufrufe in Tests)

export type AiClientFactory = (apiKey: string) => Anthropic;

const defaultFactory: AiClientFactory = (apiKey) => new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
let factory: AiClientFactory = defaultFactory;

/** Nur für Tests: eigene Fabrik setzen (null = Standard). */
export function setAiClientFactory(f: AiClientFactory | null): void {
  factory = f ?? defaultFactory;
}

export function createAiClient(apiKey: string): Anthropic {
  return factory(apiKey);
}

// ---------------------------------------------------------------------------
// Einstellungen (ohne Schlüssel – sicher für die Anzeige)

export type PlatformAiSettingsView = {
  enabled: boolean;
  allowClubs: boolean;
  hasKey: boolean;
  keyHint: string | null;
  model: AiModel;
  features: PlatformFeature[];
  monthlyTokenLimit: number | null;
  updatedAt: Date | null;
};

export type TenantAiSettingsView = {
  tenantId: string;
  enabled: boolean;
  hasKey: boolean;
  keyHint: string | null;
  model: AiModel;
  features: TenantFeature[];
  memberAccess: MemberAccess;
  monthlyTokenLimit: number | null;
  consentAt: Date | null;
  consentById: string | null;
  /** Modul «ai» im Verein eingeschaltet */
  moduleEnabled: boolean;
  updatedAt: Date | null;
};

type PlatformRow = { enabled: boolean; allowClubs: boolean; apiKeyEnc: string | null; keyHint: string | null; model: string; features: string; monthlyTokenLimit: number | null; updatedAt: Date };
type TenantRow = { tenantId: string; enabled: boolean; apiKeyEnc: string | null; keyHint: string | null; model: string; features: string; memberAccess: string; monthlyTokenLimit: number | null; consentAt: Date | null; consentById: string | null; updatedAt: Date };

async function platformRow(): Promise<PlatformRow | null> {
  return db.platformAiSettings.findUnique({ where: { id: "global" } });
}

async function tenantRow(tenantId: string): Promise<TenantRow | null> {
  return db.tenantAiSettings.findUnique({ where: { tenantId } });
}

function platformView(r: PlatformRow | null): PlatformAiSettingsView {
  return {
    enabled: r?.enabled ?? false,
    allowClubs: r?.allowClubs ?? false,
    hasKey: !!r?.apiKeyEnc,
    keyHint: r?.keyHint ?? null,
    model: normalizeAiModel(r?.model),
    features: parseFeatures("platform", r ? r.features : "translations,support"),
    monthlyTokenLimit: r?.monthlyTokenLimit ?? null,
    updatedAt: r?.updatedAt ?? null,
  };
}

async function aiModuleEnabled(tenantId: string): Promise<boolean> {
  const row = await db.tenantModule.findUnique({ where: { tenantId_moduleKey: { tenantId, moduleKey: "ai" } }, select: { enabled: true } });
  return row ? row.enabled : (getModule("ai")?.defaultEnabled ?? false);
}

function tenantView(tenantId: string, r: TenantRow | null, moduleEnabled: boolean): TenantAiSettingsView {
  return {
    tenantId,
    enabled: r?.enabled ?? false,
    hasKey: !!r?.apiKeyEnc,
    keyHint: r?.keyHint ?? null,
    model: normalizeAiModel(r?.model),
    features: parseFeatures("tenant", r ? r.features : "help"),
    memberAccess: normalizeMemberAccess(r?.memberAccess),
    monthlyTokenLimit: r?.monthlyTokenLimit ?? null,
    consentAt: r?.consentAt ?? null,
    consentById: r?.consentById ?? null,
    moduleEnabled,
    updatedAt: r?.updatedAt ?? null,
  };
}

/** KI-Einstellungen der Plattform (Standardwerte, wenn noch nichts gespeichert ist). */
export async function getPlatformAiSettings(): Promise<PlatformAiSettingsView> {
  return platformView(await platformRow());
}

/** KI-Einstellungen eines Vereins (Standardwerte, wenn noch nichts gespeichert ist). */
export async function getTenantAiSettings(tenantId: string): Promise<TenantAiSettingsView> {
  const [r, mod] = await Promise.all([tenantRow(tenantId), aiModuleEnabled(tenantId)]);
  return tenantView(tenantId, r, mod);
}

function toPlatformState(v: PlatformAiSettingsView): PlatformAiState {
  return { enabled: v.enabled, allowClubs: v.allowClubs, hasKey: v.hasKey, features: v.features, monthlyTokenLimit: v.monthlyTokenLimit };
}

function toTenantState(v: TenantAiSettingsView): TenantAiState {
  return {
    moduleEnabled: v.moduleEnabled, enabled: v.enabled, hasKey: v.hasKey, features: v.features,
    memberAccess: v.memberAccess, monthlyTokenLimit: v.monthlyTokenLimit, consentAt: v.consentAt,
  };
}

// ---------------------------------------------------------------------------
// Verfügbarkeit und Client

export type AiScopeRef = { scope: "platform" } | { scope: "tenant"; tenantId: string };

/** Kontext wie aus requireTenant()/getAppContext() (nur die benötigten Felder). */
export type AiContextLike = {
  user: { id: string; isSuperAdmin: boolean };
  tenant: { id: string; role: string | null } | null;
};

/**
 * Serverseitige Verfügbarkeit einer Funktion.
 * - "platform": Plattform-KI (actor wird nur geprüft, wenn übergeben – dann muss er Super-Admin sein)
 * - tenantId (string): Vereins-KI ohne Rollenprüfung, ausser actor wird übergeben
 * - ctx (AiContextLike): Vereins-KI des aktiven Vereins mit Rollenprüfung des angemeldeten Benutzers
 */
export async function aiAvailability(
  ctxOrTenantId: "platform" | string | AiContextLike,
  feature: AiFeature | null,
  actor?: AiActor | null,
): Promise<Availability> {
  const platform = await getPlatformAiSettings();
  if (ctxOrTenantId === "platform") {
    const pre = computeAvailability({ scope: "platform", platform: toPlatformState(platform), feature, actor });
    if (!pre.ok || platform.monthlyTokenLimit == null) return pre;
    const used = await monthTokensUsed({ scope: "platform" });
    return computeAvailability({ scope: "platform", platform: toPlatformState(platform), feature, actor, usedTokens: used });
  }
  let tenantId: string;
  let who: AiActor | null | undefined = actor;
  if (typeof ctxOrTenantId === "string") {
    tenantId = ctxOrTenantId;
  } else {
    if (!ctxOrTenantId.tenant) return { ok: false, reason: "clubOff" };
    tenantId = ctxOrTenantId.tenant.id;
    who = actor ?? { id: ctxOrTenantId.user.id, isSuperAdmin: ctxOrTenantId.user.isSuperAdmin, role: ctxOrTenantId.tenant.role };
  }
  const tenant = await getTenantAiSettings(tenantId);
  const base = { scope: "tenant" as const, platform: toPlatformState(platform), tenant: toTenantState(tenant), feature, actor: who };
  const pre = computeAvailability(base);
  if (!pre.ok || tenant.monthlyTokenLimit == null) return pre;
  const used = await monthTokensUsed({ scope: "tenant", tenantId });
  return computeAvailability({ ...base, usedTokens: used });
}

export type AiClientResult =
  | { ok: true; client: Anthropic; model: AiModel; keyHint: string | null }
  | { ok: false; reason: AiUnavailableReason };

function decryptKey(enc: string | null): string | null {
  if (!enc) return null;
  try {
    const v = decryptJson<{ apiKey?: string }>(enc);
    return typeof v.apiKey === "string" && v.apiKey ? v.apiKey : null;
  } catch {
    return null;
  }
}

/**
 * Client für einen Bereich, mit allen Prüfungen (inkl. Monatslimit).
 * opts.feature: zusätzlich prüfen, ob die Funktion eingeschaltet ist; opts.actor: Rollen prüfen.
 */
export async function getAiClient(ref: AiScopeRef, opts?: { feature?: AiFeature | null; actor?: AiActor | null }): Promise<AiClientResult> {
  const avail = await aiAvailability(ref.scope === "platform" ? "platform" : ref.tenantId, opts?.feature ?? null, opts?.actor);
  if (!avail.ok) return avail;
  if (ref.scope === "platform") {
    const row = await platformRow();
    const key = decryptKey(row?.apiKeyEnc ?? null);
    if (!key) return { ok: false, reason: "noKey" };
    return { ok: true, client: createAiClient(key), model: normalizeAiModel(row?.model), keyHint: row?.keyHint ?? null };
  }
  const row = await tenantRow(ref.tenantId);
  const key = decryptKey(row?.apiKeyEnc ?? null);
  if (!key) return { ok: false, reason: "noKey" };
  return { ok: true, client: createAiClient(key), model: normalizeAiModel(row?.model), keyHint: row?.keyHint ?? null };
}

/** Entschlüsselter Schlüssel eines Bereichs, ohne weitere Prüfungen (nur für testStoredKey). */
export async function loadStoredApiKey(ref: AiScopeRef): Promise<string | null> {
  const row = ref.scope === "platform" ? await platformRow() : await tenantRow(ref.tenantId);
  return decryptKey(row?.apiKeyEnc ?? null);
}
