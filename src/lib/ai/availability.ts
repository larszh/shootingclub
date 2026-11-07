/**
 * Reine Verfügbarkeitsprüfung (ohne DB): ist eine KI-Funktion für diesen Bereich und Benutzer
 * gerade nutzbar? Die serverseitige Variante aiAvailability() in client.ts lädt die Daten
 * und ruft computeAvailability() auf.
 */
import { roleAtLeast } from "@/lib/permissions";
import {
  TENANT_FEATURE_MIN_ROLE, isPlatformFeature, isTenantFeature, normalizeMemberAccess,
  type AiFeature, type AiUnavailableReason,
} from "./types";

export type PlatformAiState = {
  enabled: boolean;
  allowClubs: boolean;
  hasKey: boolean;
  features: readonly string[];
  monthlyTokenLimit: number | null;
};

export type TenantAiState = {
  /** Modul «ai» im Verein eingeschaltet */
  moduleEnabled: boolean;
  enabled: boolean;
  hasKey: boolean;
  features: readonly string[];
  memberAccess: string;
  monthlyTokenLimit: number | null;
  consentAt: Date | null;
};

/** Wer fragt. role = Rolle im Verein (null = keine Mitgliedschaft). */
export type AiActor = { id?: string | null; isSuperAdmin: boolean; role: string | null };

export type AvailabilityInput =
  | { scope: "platform"; platform: PlatformAiState; feature: AiFeature | null; usedTokens?: number; actor?: AiActor | null }
  | { scope: "tenant"; platform: PlatformAiState; tenant: TenantAiState | null; feature: AiFeature | null; usedTokens?: number; actor?: AiActor | null };

export type Availability = { ok: true } | { ok: false; reason: AiUnavailableReason };

const no = (reason: AiUnavailableReason): Availability => ({ ok: false, reason });

function overLimit(limit: number | null, used: number | undefined): boolean {
  return limit != null && limit > 0 && (used ?? 0) >= limit;
}

/**
 * Reihenfolge der Prüfungen (erste zutreffende gewinnt):
 * Plattform: platformOff → noKey → featureOff → noAccess (nur Super-Admins) → limitReached.
 * Verein: clubsNotAllowed (Plattform erlaubt Vereine nicht) → clubOff (Modul oder Einstellung aus)
 * → noConsent → noKey → featureOff → noAccess (Rolle / memberAccess STAFF) → limitReached.
 * Ohne actor wird die Rolle nicht geprüft (z.B. Hintergrundjobs, die selbst berechtigt sind).
 * feature null: nur die Grundvoraussetzungen (Funktion und funktionsbezogene Mindestrolle werden übersprungen).
 */
export function computeAvailability(input: AvailabilityInput): Availability {
  const { feature, actor } = input;
  if (input.scope === "platform") {
    const p = input.platform;
    if (!p.enabled) return no("platformOff");
    if (!p.hasKey) return no("noKey");
    if (feature !== null && (!isPlatformFeature(feature) || !p.features.includes(feature))) return no("featureOff");
    if (actor && !actor.isSuperAdmin) return no("noAccess");
    if (overLimit(p.monthlyTokenLimit, input.usedTokens)) return no("limitReached");
    return { ok: true };
  }
  if (!input.platform.allowClubs) return no("clubsNotAllowed");
  const t = input.tenant;
  if (!t || !t.moduleEnabled || !t.enabled) return no("clubOff");
  if (!t.consentAt) return no("noConsent");
  if (!t.hasKey) return no("noKey");
  if (feature !== null && (!isTenantFeature(feature) || !t.features.includes(feature))) return no("featureOff");
  if (actor && !actor.isSuperAdmin) {
    const min = feature !== null && isTenantFeature(feature) ? TENANT_FEATURE_MIN_ROLE[feature] : "MEMBER";
    if (!roleAtLeast(actor.role, min)) return no("noAccess");
    if (normalizeMemberAccess(t.memberAccess) === "STAFF" && !roleAtLeast(actor.role, "TRAINER")) return no("noAccess");
  }
  if (overLimit(t.monthlyTokenLimit, input.usedTokens)) return no("limitReached");
  return { ok: true };
}
