import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge, Card, ProgressBar } from "@/components/ui";
import { openSlots, type RankingEntry } from "@/modules/championship/ranking";
import { NO_CATEGORY, formatPoints } from "@/modules/championship/types";

/** «Mein Stand»: Rang, Total, Kategorie und was noch zählen kann. */
export function MyStanding({ championshipId, name, entry, categoryRank, totalRanked, compact }: { championshipId: string; name?: string; entry: RankingEntry | null; categoryRank?: number | null; totalRanked: number; compact?: boolean }) {
  if (!entry) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-ink-3" aria-hidden /> Mein Stand{name ? ` · ${name}` : ""}</div>
        <p className="mt-1 text-sm text-ink-3">Du hast noch kein zählendes Resultat. Schiess ein Programm der Meisterschaft und schliesse den Durchgang ab.</p>
      </Card>
    );
  }
  const slots = openSlots(entry);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-accent" aria-hidden /> Mein Stand{name ? ` · ${name}` : ""}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {entry.rank ? `${entry.rank}. Rang` : "nicht klassiert"}
            {entry.rank ? <span className="text-sm font-normal text-ink-3"> von {totalRanked}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {entry.category !== NO_CATEGORY ? <Badge>{entry.category}{categoryRank ? `: ${categoryRank}. Rang` : ""}</Badge> : <Badge tone="outline">{NO_CATEGORY}</Badge>}
            {entry.bonus ? <Badge tone="accent">Bonus +{formatPoints(entry.bonus)}</Badge> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-3xl font-semibold tabular-nums">{formatPoints(entry.total)}</div>
          <div className="text-xs text-ink-3">Punkte</div>
        </div>
      </div>
      {entry.missingRequired.length ? (
        <p className="mt-3 rounded-control bg-warn/10 px-3 py-2 text-sm text-warn">Für die Rangierung fehlt noch: {entry.missingRequired.join(", ")}.</p>
      ) : null}
      {!compact ? (
        <ul className="mt-3 space-y-2.5">
          {slots.map((s) => (
            <li key={s.programId}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 tabular-nums text-ink-3">
                  {s.limit === null ? `${s.counted} Resultate zählen` : `${s.counted} von ${s.limit}`}
                  {s.weakest !== null ? ` · schlechtestes zählt ${formatPoints(s.weakest)}` : ""}
                </span>
              </div>
              {s.limit !== null ? <ProgressBar value={s.counted} max={s.limit} label={`${s.name}: ${s.counted} von ${s.limit}`} size="sm" className="mt-1" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={`/championship/${championshipId}/member/${entry.userId}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
        Gezählte und gestrichene Resultate ansehen →
      </Link>
    </Card>
  );
}
