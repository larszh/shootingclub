import Link from "next/link";
import { Phone, Siren } from "lucide-react";
import { Card } from "@/components/ui";
import { EMERGENCY_NUMBERS } from "@/modules/range/types";

/** Notrufnummern (Schweiz) zum direkten Anwählen und Link zur Standordnung. */
export function EmergencyBox({ hasRules }: { hasRules: boolean }) {
  return (
    <Card className="animate-rise border-danger/30 p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-danger">
        <Siren className="h-5 w-5" aria-hidden /> Notfall
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EMERGENCY_NUMBERS.map((n) => (
          <a key={n.number} href={`tel:${n.number}`} className="press flex min-h-14 items-center gap-2 rounded-control border border-line bg-surface-2 px-3 hover:border-danger/50">
            <Phone className="h-4 w-4 shrink-0 text-danger" aria-hidden />
            <span className="min-w-0">
              <span className="block text-lg font-semibold tabular-nums leading-tight">{n.number}</span>
              <span className="block truncate text-xs text-ink-3">{n.label}</span>
            </span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        Standort von Erste-Hilfe-Material und Defibrillator sowie den Notfallplan findest du in der{" "}
        {hasRules ? <Link href="/range/rules" className="font-medium text-ink underline">Standordnung</Link> : "Standordnung des Vereins"}.
      </p>
    </Card>
  );
}
