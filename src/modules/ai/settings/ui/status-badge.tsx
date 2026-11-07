/**
 * Status-Badge für KI-Funktionen – für alle Arbeitspakete nutzbar (Server- und Client-Komponenten).
 * Verfügbarkeit serverseitig mit aiAvailability(ctx, feature) aus "@/modules/ai/settings/status"
 * (bzw. "@/lib/ai") ermitteln und hier als Prop übergeben.
 */
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import { aiStatusInfo, type AiAvailabilityLike } from "../status-info";

export { aiStatusInfo, type AiAvailabilityLike };

/** Badge «KI bereit» / «KI aus» – optional mit Grund daneben. */
export function AiStatusBadge({ availability, locale, withReason = false, className }: { availability: AiAvailabilityLike; locale: string | null | undefined; withReason?: boolean; className?: string }) {
  const info = aiStatusInfo(availability, locale);
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <Badge tone={info.tone}>
        <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden />
        {info.label}
      </Badge>
      {withReason && info.reason ? <span className="text-sm text-ink-3">{info.reason}</span> : null}
    </span>
  );
}
