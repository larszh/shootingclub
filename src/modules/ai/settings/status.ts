/**
 * Serverseitiger Einstieg für andere Arbeitspakete: Verfügbarkeit (aus dem Kern) und Badge.
 *   const avail = await aiAvailability(ctx, "help");
 *   <AiStatusBadge availability={avail} locale={locale} withReason />
 */
import "server-only";

export { aiAvailability, type Availability } from "@/lib/ai";
export { AiStatusBadge, aiStatusInfo, type AiAvailabilityLike } from "./ui/status-badge";
export { aiT } from "./i18n";
