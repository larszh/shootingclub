import "server-only";
import { formatDateZurich } from "@/lib/time";

/** Fusszeile der Druckansicht: «Datum · Benutzer · Verein · Standchef» (Schweizer Zeit). */
export function printFooterText(userName: string, tenantName: string) {
  return `${formatDateZurich(new Date(), { weekday: undefined, day: "2-digit", month: "2-digit", year: "numeric" })} · ${userName} · ${tenantName} · Standchef`;
}
