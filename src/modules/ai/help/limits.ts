/**
 * Rate-Limit des Hilfe-Assistenten (zusätzlich zum allgemeinen Limit in @/lib/ai) und
 * Zuordnung von Fehlern zu freundlichen Texten (rein, testbar).
 */
import { createRateLimiter, type RateLimiter } from "@/lib/ai/rate-limit";
import type { AiErrorCode, AiUnavailableReason } from "@/lib/ai/types";

/** Vereins-Hilfe: 20 Fragen pro Person in 10 Minuten. */
export const HELP_RATE = { limit: 20, windowMs: 10 * 60_000 } as const;
/** Plattform-Support: 60 Fragen pro Person in 10 Minuten. */
export const SUPPORT_RATE = { limit: 60, windowMs: 10 * 60_000 } as const;

const limiters: { help: RateLimiter; support: RateLimiter } = {
  help: createRateLimiter(HELP_RATE),
  support: createRateLimiter(SUPPORT_RATE),
};

/** Nur für Tests: Limiter ersetzen (null = neu und leer). */
export function setHelpRateLimiters(next: Partial<typeof limiters> | null): void {
  if (!next) {
    limiters.help = createRateLimiter(HELP_RATE);
    limiters.support = createRateLimiter(SUPPORT_RATE);
    return;
  }
  if (next.help) limiters.help = next.help;
  if (next.support) limiters.support = next.support;
}

/** Zählt eine Frage. ok=false: zu viele Fragen, retryAfterSec bis zur nächsten. */
export function hitHelpLimit(mode: "help" | "support", key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const r = limiters[mode].hit(key);
  return r.ok ? r : { ok: false, retryAfterSec: Math.max(1, Math.ceil(r.retryAfterMs / 1000)) };
}

export type HelpFailure =
  | { kind: "unavailable"; reason: AiUnavailableReason }
  | { kind: "error"; code: AiErrorCode; retryAfterSec?: number | null };

/** Gründe, bei denen der Verein Claude (noch) nicht eingerichtet hat. */
const NOT_SET_UP: readonly AiUnavailableReason[] = ["clubsNotAllowed", "clubOff", "noKey", "noConsent", "featureOff"];

/**
 * i18n-Schlüssel für die Anzeige im Chat. Vereins-Hilfe: freundliche Texte ohne technische Details
 * («Der Verein hat Claude noch nicht eingerichtet»); Support: die allgemeinen ai.*-Texte.
 */
export function helpFailureKey(mode: "help" | "support", f: HelpFailure): string {
  if (mode === "help") {
    if (f.kind === "unavailable") {
      if (NOT_SET_UP.includes(f.reason)) return "aihelp.unavailable.notSetUp";
      if (f.reason === "limitReached") return "aihelp.unavailable.limitReached";
      if (f.reason === "noAccess") return "aihelp.unavailable.noAccess";
      return `ai.unavailable.${f.reason}`;
    }
    if (f.code === "invalidKey") return "aihelp.error.invalidKey";
    if (f.code === "rateLimited") return "aihelp.error.rateLimited";
    return `ai.error.${f.code}`;
  }
  return f.kind === "unavailable" ? `ai.unavailable.${f.reason}` : `ai.error.${f.code}`;
}

/** HTTP-Status für eine Fehlerantwort. */
export function helpFailureStatus(f: HelpFailure): number {
  if (f.kind === "unavailable") {
    if (f.reason === "noAccess") return 403;
    if (f.reason === "limitReached") return 429;
    return 409;
  }
  switch (f.code) {
    case "rateLimited":
      return 429;
    case "badRequest":
      return 400;
    case "aborted":
      return 499;
    case "invalidKey":
    case "overloaded":
    case "network":
      return 503;
    default:
      return 500;
  }
}
