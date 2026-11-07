/**
 * KI (Claude): Konstanten und Typen ohne Server-Abhängigkeiten – auch in Client-Komponenten nutzbar.
 * Serverseitige Funktionen liegen in "@/lib/ai" (index.ts, server-only).
 */

/** Auswählbare Modelle. Standard bleibt claude-opus-5-5. */
export const AI_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;
export type AiModel = (typeof AI_MODELS)[number];
export const DEFAULT_AI_MODEL: AiModel = "claude-opus-5-5";

export function isAiModel(v: unknown): v is AiModel {
  return typeof v === "string" && (AI_MODELS as readonly string[]).includes(v);
}

/** Gespeichertes Modell → gültiges Modell (unbekannt → Standard). */
export function normalizeAiModel(v: string | null | undefined): AiModel {
  return isAiModel(v) ? v : DEFAULT_AI_MODEL;
}

/** Funktionen auf Plattform-Stufe (Super-Admin, Plattform-Schlüssel). */
export const PLATFORM_FEATURES = ["translations", "support"] as const;
/** Funktionen pro Verein (Vereins-Schlüssel). */
export const TENANT_FEATURES = ["help", "contentTranslation", "writing", "coach", "reports", "importHelper"] as const;

export const FEATURES = { platform: PLATFORM_FEATURES, tenant: TENANT_FEATURES } as const;

export type PlatformFeature = (typeof PLATFORM_FEATURES)[number];
export type TenantFeature = (typeof TENANT_FEATURES)[number];
export type AiFeature = PlatformFeature | TenantFeature;
export type AiScope = "platform" | "tenant";

export function isPlatformFeature(v: unknown): v is PlatformFeature {
  return typeof v === "string" && (PLATFORM_FEATURES as readonly string[]).includes(v);
}

export function isTenantFeature(v: unknown): v is TenantFeature {
  return typeof v === "string" && (TENANT_FEATURES as readonly string[]).includes(v);
}

/** Standardwerte der Spalte `features` (kommagetrennt). */
export const DEFAULT_PLATFORM_FEATURES: readonly PlatformFeature[] = ["translations", "support"];
export const DEFAULT_TENANT_FEATURES: readonly TenantFeature[] = ["help"];

/** Mindestrolle im Verein pro Funktion (zusätzlich zu memberAccess und den Rechten des Moduls). */
export const TENANT_FEATURE_MIN_ROLE: Record<TenantFeature, "MEMBER" | "TRAINER" | "ADMIN"> = {
  help: "MEMBER",
  coach: "MEMBER",
  contentTranslation: "MEMBER",
  writing: "TRAINER",
  // Alle Auswertungs-Pfade verlangen tenant.manage.
  reports: "ADMIN",
  importHelper: "ADMIN",
};

/** Denktiefe pro Funktion (output_config.effort). */
export type AiEffort = "low" | "medium" | "high";
export const DEFAULT_EFFORT: Record<AiFeature, AiEffort> = {
  support: "low",
  help: "low",
  coach: "low",
  translations: "medium",
  contentTranslation: "medium",
  writing: "medium",
  importHelper: "medium",
  reports: "high",
};

/** Kommagetrennte Liste aus der DB → bekannte Funktionen des Bereichs (ohne Duplikate). */
export function parseFeatures(scope: "platform", raw: string | null | undefined): PlatformFeature[];
export function parseFeatures(scope: "tenant", raw: string | null | undefined): TenantFeature[];
export function parseFeatures(scope: AiScope, raw: string | null | undefined): AiFeature[] {
  const allowed: readonly string[] = scope === "platform" ? PLATFORM_FEATURES : TENANT_FEATURES;
  const out: AiFeature[] = [];
  for (const part of (raw ?? "").split(",")) {
    const f = part.trim();
    if (f && allowed.includes(f) && !out.includes(f as AiFeature)) out.push(f as AiFeature);
  }
  return out;
}

/** Funktionen → Wert für die Spalte `features` (unbekannte werden verworfen, Reihenfolge wie FEATURES). */
export function serializeFeatures(scope: AiScope, features: readonly string[]): string {
  const allowed: readonly string[] = scope === "platform" ? PLATFORM_FEATURES : TENANT_FEATURES;
  return allowed.filter((f) => features.includes(f)).join(",");
}

/** Wer im Verein KI nutzen darf. */
export const MEMBER_ACCESS = ["ALL", "STAFF"] as const;
export type MemberAccess = (typeof MEMBER_ACCESS)[number];
export function normalizeMemberAccess(v: string | null | undefined): MemberAccess {
  return v === "STAFF" ? "STAFF" : "ALL";
}

/** Gründe, weshalb KI gerade nicht verfügbar ist (vor dem Aufruf geprüft). i18n: `ai.unavailable.<reason>`. */
export const AI_UNAVAILABLE_REASONS = [
  "platformOff", "clubsNotAllowed", "clubOff", "noKey", "featureOff", "limitReached", "noConsent", "noAccess",
] as const;
export type AiUnavailableReason = (typeof AI_UNAVAILABLE_REASONS)[number];

/**
 * Fehler beim Aufruf. i18n: `ai.error.<code>`.
 * invalidKey: Schlüssel ungültig/ohne Berechtigung (Admin informieren) · rateLimited: zu viele Anfragen
 * (Anbieter oder lokale Begrenzung) · refused: Claude hat abgelehnt · overloaded: Dienst überlastet/5xx ·
 * badRequest: Anfrage ungültig (z.B. zu lang) · network: keine Verbindung/Zeitüberschreitung ·
 * invalidOutput: strukturierte Antwort unbrauchbar · aborted: abgebrochen · unknown: sonstiges.
 */
export const AI_ERROR_CODES = [
  "invalidKey", "rateLimited", "refused", "overloaded", "badRequest", "network", "invalidOutput", "aborted", "unknown",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export function isAiErrorCode(v: unknown): v is AiErrorCode {
  return typeof v === "string" && (AI_ERROR_CODES as readonly string[]).includes(v);
}

export function isAiUnavailableReason(v: unknown): v is AiUnavailableReason {
  return typeof v === "string" && (AI_UNAVAILABLE_REASONS as readonly string[]).includes(v);
}

/**
 * Stream-Protokoll von streamText(): reiner UTF-8-Text. Bei einem Fehler oder einer Ablehnung
 * während des Streams folgt am Ende eine Steuerzeile `AI_STREAM_ERROR_MARK + code`
 * (code = AiErrorCode). Bei einer Ablehnung soll der Client den bisherigen Text verwerfen.
 */
export const AI_STREAM_ERROR_MARK = "\u0000AI_ERROR:";

/** Trennt empfangenen Stream-Text in Antwort und allfälligen Fehlercode. */
export function splitAiStream(full: string): { text: string; error: AiErrorCode | null } {
  const i = full.indexOf(AI_STREAM_ERROR_MARK);
  if (i < 0) return { text: full, error: null };
  const code = full.slice(i + AI_STREAM_ERROR_MARK.length).trim();
  return { text: full.slice(0, i), error: isAiErrorCode(code) ? code : "unknown" };
}

/** Letzte 4 Zeichen eines Schlüssels für die Anzeige («…abcd»). */
export function keyHintOf(apiKey: string): string {
  return apiKey.trim().slice(-4);
}

/** Plausibilitätsprüfung eines Claude-API-Schlüssels (Format, keine Prüfung beim Anbieter). */
export function isPlausibleApiKey(v: string): boolean {
  const s = v.trim();
  return s.length >= 20 && s.length <= 300 && /^sk-ant-[A-Za-z0-9_-]+$/.test(s);
}
