/**
 * Zuordnung von KI-Fehlern zu Texten im Hilfe- und Support-Chat (rein, client-sicher – auch
 * AiChat nutzt sie für Fehler, die erst während des Streams kommen).
 */
import type { AiErrorCode, AiUnavailableReason } from "@/lib/ai/types";

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

/**
 * i18n-Schlüssel für einen Fehler, der erst im Stream kommt (HTTP 200, Fehlermarke am Ende).
 * Das sind immer Fehler des Anbieters: ein 429 dort ist das Limit des Vereins-Kontos bei Claude,
 * nicht das eigene Fragen-Limit der Person (das prüft der Server vor dem Stream) – darum der
 * allgemeine Text «Zu viele Anfragen …» statt «Du hast viele Fragen gestellt».
 */
export function helpStreamErrorKey(mode: "help" | "support", code: AiErrorCode): string {
  if (code === "rateLimited") return "ai.error.rateLimited";
  return helpFailureKey(mode, { kind: "error", code });
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
