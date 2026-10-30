import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { RankingEntry } from "@/modules/championship/ranking";
import { NO_CATEGORY, formatPoints } from "@/modules/championship/types";

type Row = RankingEntry & { shownRank: number | null };

const medal = (rank: number | null) =>
  rank === 1 ? "bg-[#d4a72c] text-black" : rank === 2 ? "bg-[#b8bcc2] text-black" : rank === 3 ? "bg-[#b07a4a] text-white" : "bg-surface-2 text-ink-2";

/** Rangliste als Liste (mobil gut lesbar): Rang, Name, Kategorie, Programmsummen, Total. */
export function RankingList({ rows, championshipId, meId, showCategory = true }: { rows: Row[]; championshipId: string; meId: string; showCategory?: boolean }) {
  return (
    <Card className="animate-rise divide-y divide-line overflow-hidden">
      {rows.map((e) => {
        const me = e.userId === meId;
        return (
          <Link
            key={e.userId}
            href={`/championship/${championshipId}/member/${e.userId}`}
            className={cn("flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-2", me && "bg-accent-soft/60")}
          >
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums", medal(e.shownRank))}>
              {e.shownRank ?? "–"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate font-medium">{e.name}</span>
                {me ? <Badge tone="accent">Du</Badge> : null}
                {showCategory && e.category !== NO_CATEGORY ? <Badge>{e.category}</Badge> : null}
              </div>
              <div className="truncate text-xs text-ink-3">
                {e.programs.filter((p) => p.counted.length).map((p) => `${p.name}: ${formatPoints(p.weighted)}`).join(" · ")}
                {e.bonus ? ` · Bonus +${formatPoints(e.bonus)}` : ""}
                {e.missingRequired.length ? ` · fehlt: ${e.missingRequired.join(", ")}` : ""}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-semibold tabular-nums">{formatPoints(e.total)}</div>
              <div className="text-[11px] text-ink-3">{e.countedResults} Res.</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          </Link>
        );
      })}
    </Card>
  );
}
