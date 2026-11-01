import Link from "next/link";
import { Phone, Siren } from "lucide-react";
import { Card } from "@/components/ui";
import { EMERGENCY_NUMBERS } from "@/modules/range/types";
import { getT, type Locale } from "@/lib/i18n/core";

/** Notrufnummern (Schweiz) zum direkten Anwählen und Link zur Standordnung. */
export function EmergencyBox({ hasRules, locale = "de" }: { hasRules: boolean; locale?: Locale }) {
  const t = getT(locale);
  const label = (n: { number: string; label: string }) => {
    const key = `shooting.emergency.${n.number}`;
    const v = t(key);
    return v === key ? n.label : v;
  };
  return (
    <Card className="animate-rise border-danger/30 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-danger">
        <Siren className="h-5 w-5" aria-hidden /> {t("shooting.emergency.title")}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EMERGENCY_NUMBERS.map((n) => (
          <a key={n.number} href={`tel:${n.number}`} className="press flex min-h-14 items-center gap-2 rounded-control border border-line bg-surface-2 px-3 hover:border-danger/50">
            <Phone className="h-4 w-4 shrink-0 text-danger" aria-hidden />
            <span className="min-w-0">
              <span className="block text-lg font-semibold tabular-nums leading-tight">{n.number}</span>
              <span className="block truncate text-xs text-ink-3">{label(n)}</span>
            </span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {t("shooting.emergency.hint")}{" "}
        {hasRules ? <Link href="/range/rules" className="font-medium text-ink underline">{t("shooting.emergency.rules")}</Link> : t("shooting.emergency.clubRules")}.
      </p>
    </Card>
  );
}
