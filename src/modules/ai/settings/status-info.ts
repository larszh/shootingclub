/** Text und Ton einer KI-Verfügbarkeit (rein, client-sicher). */
import type { AiUnavailableReason } from "@/lib/ai/types";
import { aiT } from "./i18n";

export type AiAvailabilityLike = { ok: true } | { ok: false; reason: AiUnavailableReason };

export type AiStatusInfo = { ready: boolean; label: string; reason: string | null; tone: "ok" | "warn" | "neutral" };

/** Gründe, die der Admin selbst beheben kann bzw. die bald ablaufen → Warnfarbe. */
const WARN_REASONS: readonly AiUnavailableReason[] = ["limitReached", "noKey", "noConsent"];

export function aiStatusInfo(availability: AiAvailabilityLike, locale: string | null | undefined): AiStatusInfo {
  const t = aiT(locale);
  if (availability.ok) return { ready: true, label: t("aiSet.badge.ready"), reason: null, tone: "ok" };
  return {
    ready: false,
    label: t("aiSet.badge.off"),
    reason: t(`ai.unavailable.${availability.reason}`),
    tone: WARN_REASONS.includes(availability.reason) ? "warn" : "neutral",
  };
}
