import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Card } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { formatDay } from "@/modules/scores/analytics";
import type { Leaderboard, LeaderboardEntry } from "@/modules/scores/insights";

/** Podest für die ersten drei Ränge (Reihenfolge 2 – 1 – 3 wie auf dem Siegerpodest). */
export function Podium({ board }: { board: Leaderboard }) {
  const top = board.entries.slice(0, 3);
  if (top.length === 0) return null;
  const order = [top[1], top[0], top[2]];
  const heights = ["h-16", "h-24", "h-12"];
  return (
    <div className="animate-rise grid grid-cols-3 items-end gap-2 pt-2" aria-label="Podest">
      {order.map((e, i) =>
        e ? (
          <div key={e.key} className="flex flex-col items-center text-center min-w-0">
            <div className="relative">
              <Avatar name={e.name} src={e.avatarUrl} size={e.rank === 1 ? 64 : 48} tone={e.isMe ? "ink" : "soft"}
                className={cn("ring-4", e.rank === 1 ? "ring-accent" : "ring-line")} />
              <span className={cn("absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ring-bg",
                e.rank === 1 ? "bg-accent text-accent-ink" : "bg-ink text-bg")}>{e.rank}</span>
            </div>
            <div className={cn("mt-2 w-full truncate text-sm font-medium", e.isMe && "text-accent")}>{e.isMe ? "Du" : e.name}</div>
            <div className="text-base font-semibold tabular-nums">{formatScore(e.total, board.decimal)}</div>
            <div className={cn("mt-1.5 w-full rounded-t-control", heights[i], e.rank === 1 ? "bg-accent-soft" : "bg-surface-2")} aria-hidden />
          </div>
        ) : (
          <div key={`empty-${i}`} />
        ),
      )}
    </div>
  );
}

function Row({ e, board }: { e: LeaderboardEntry; board: Leaderboard }) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", e.isMe && "bg-accent-soft")} aria-current={e.isMe ? "true" : undefined}>
      <span className={cn("w-7 shrink-0 text-center text-sm font-semibold tabular-nums", e.rank <= 3 ? "text-accent" : "text-ink-3")}>{e.rank}.</span>
      <Avatar name={e.name} src={e.avatarUrl} size={36} tone={e.userId ? "soft" : "guest"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{e.name}</span>
          {e.isMe ? <Badge tone="accent">Du</Badge> : null}
        </div>
        <div className="text-xs text-ink-3 truncate">
          {formatDay(e.date)}
          {e.attempts > 1 ? ` · ${e.attempts} Durchgänge` : ""}
          {board.showTopShots && e.topShots ? ` · ${e.topShots}${board.topShotsLabel.startsWith("×") ? "" : " "}${board.topShotsLabel}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-semibold tabular-nums">{formatScore(e.total, board.decimal)}</div>
        <div className="text-[11px] text-ink-3">von {board.program.max}</div>
      </div>
    </li>
  );
}

/** Vollständige Rangliste mit hervorgehobener eigener Position. */
export function LeaderboardList({ board, entries }: { board: Leaderboard; entries?: LeaderboardEntry[] }) {
  const list = entries ?? board.entries;
  return (
    <Card className="animate-rise overflow-hidden">
      <ol className="divide-y divide-line">
        {list.map((e) => <Row key={e.key} e={e} board={board} />)}
      </ol>
    </Card>
  );
}

/** Kompakte Vorschau (Top 3 + eigene Position) für die Programmseite. */
export function LeaderboardTeaser({ board, href }: { board: Leaderboard; href: string }) {
  const top = board.entries.slice(0, 3);
  const showMe = board.me && board.me.rank > 3;
  return (
    <Card className="animate-rise overflow-hidden">
      {top.length ? (
        <ol className="divide-y divide-line">
          {top.map((e) => <Row key={e.key} e={e} board={board} />)}
          {showMe && board.me ? <Row e={board.me} board={board} /> : null}
        </ol>
      ) : (
        <div className="flex items-center gap-3 px-4 py-4 text-sm text-ink-3">
          <Trophy className="h-5 w-5 shrink-0" /> Noch keine abgeschlossenen Durchgänge ({board.periodLabel}). Sei die oder der Erste!
        </div>
      )}
      <Link href={href} className="press flex items-center justify-center gap-1.5 border-t border-line px-4 py-3 text-sm font-medium text-ink-2 hover:bg-surface-2">
        <Trophy className="h-4 w-4" /> Ganze Rangliste
      </Link>
    </Card>
  );
}
