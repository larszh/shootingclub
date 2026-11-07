import Anthropic from "@anthropic-ai/sdk";
import type { AiErrorCode, AiUnavailableReason } from "./types";

/** KI vor dem Aufruf nicht verfügbar (Einstellungen, Schlüssel, Limite, Rechte). */
export class AiUnavailable extends Error {
  readonly reason: AiUnavailableReason;
  constructor(reason: AiUnavailableReason) {
    super(`AI unavailable: ${reason}`);
    this.name = "AiUnavailable";
    this.reason = reason;
  }
  /** i18n-Schlüssel für die Anzeige */
  get messageKey(): string {
    return `ai.unavailable.${this.reason}`;
  }
}

/** Fehler beim Aufruf von Claude. Enthält nie den Schlüssel oder rohe Anbieter-Antworten. */
export class AiError extends Error {
  readonly code: AiErrorCode;
  /** Bei rateLimited: Sekunden bis zum nächsten Versuch, wenn bekannt */
  readonly retryAfterSec: number | null;
  constructor(code: AiErrorCode, opts?: { retryAfterSec?: number | null }) {
    super(`AI error: ${code}`);
    this.name = "AiError";
    this.code = code;
    this.retryAfterSec = opts?.retryAfterSec ?? null;
  }
  /** i18n-Schlüssel für die Anzeige */
  get messageKey(): string {
    return `ai.error.${this.code}`;
  }
}

function retryAfter(err: InstanceType<typeof Anthropic.APIError>): number | null {
  const raw = err.headers?.get?.("retry-after");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : null;
}

/** Ordnet beliebige Fehler (typisierte SDK-Klassen, spezifischste zuerst) einem AiError zu. */
export function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError) return new AiError("invalidKey");
  if (err instanceof Anthropic.PermissionDeniedError) return new AiError("invalidKey");
  if (err instanceof Anthropic.RateLimitError) return new AiError("rateLimited", { retryAfterSec: retryAfter(err) });
  if (err instanceof Anthropic.BadRequestError) return new AiError("badRequest");
  if (err instanceof Anthropic.NotFoundError) return new AiError("badRequest");
  if (err instanceof Anthropic.UnprocessableEntityError) return new AiError("badRequest");
  if (err instanceof Anthropic.ContentTooLargeError) return new AiError("badRequest");
  if (err instanceof Anthropic.APIUserAbortError) return new AiError("aborted");
  if (err instanceof Anthropic.APIConnectionError) return new AiError("network");
  if (err instanceof Anthropic.InternalServerError) return new AiError("overloaded");
  if (err instanceof Anthropic.APIError) {
    const s = err.status;
    if (s === 429) return new AiError("rateLimited", { retryAfterSec: retryAfter(err) });
    if (typeof s === "number" && s >= 500) return new AiError("overloaded");
    if (typeof s === "number" && s >= 400) return new AiError("badRequest");
    return new AiError("unknown");
  }
  if (err instanceof Error && err.name === "AbortError") return new AiError("aborted");
  return new AiError("unknown");
}

/** Einheitliche Form für ActionResult/JSON: Code + i18n-Schlüssel. */
export type AiFailure =
  | { kind: "unavailable"; reason: AiUnavailableReason; messageKey: string }
  | { kind: "error"; code: AiErrorCode; messageKey: string; retryAfterSec: number | null };

export function describeAiFailure(err: unknown): AiFailure {
  if (err instanceof AiUnavailable) return { kind: "unavailable", reason: err.reason, messageKey: err.messageKey };
  const e = toAiError(err);
  return { kind: "error", code: e.code, messageKey: e.messageKey, retryAfterSec: e.retryAfterSec };
}
