/**
 * Rate-Limit des Hilfe-Assistenten (zusätzlich zum allgemeinen Limit in @/lib/ai) und
 * Zuordnung von Fehlern zu freundlichen Texten (rein, testbar).
 */
import { createRateLimiter, type RateLimiter } from "@/lib/ai/rate-limit";

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

export { helpFailureKey, helpFailureStatus, helpStreamErrorKey, type HelpFailure } from "./failure";
