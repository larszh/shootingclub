import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Card } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { formatDay } from "@/modules/scores/analytics";
import type { Leaderboard, LeaderboardEntry } from "@/modules/scores/insights";
import { getT, type Locale, type TFunction } from "@/lib/i18n/core";
import { periodLabelText, tCount, topShotsText } from "./labels";

/** Podest für die ersten drei Ränge (Reihenfolge 2 – 1 – 3 wie auf dem Siegerpodest). */
export function Podium({ board, locale = "de" }: { board: Leaderboard; locale?: Locale }) {
  const t = getT(locale);
  const top = board.entries.slice(0, 3);
  if (top.length === 0) return null;
  const order = [top[1], top[0], top[2]];
  const heights = ["h-16", "h-24", "h-12"];
  return (
    <div className="animate-rise grid grid-cols-3 items-end gap-2 pt-2" aria-label={t("shooting.board.podium")}>
      {order.map((e, i) =>
        e ? (
          <div key={e.key} className="flex flex-col items-center text-center min-w-0">
            <div className="relative">
              <Avatar name={e.name} src={e.avatarUrl} size={e.rank === 1 ? 64 : 48} tone={e.isMe ? "ink" : "soft"}
                className={cn("ring-4", e.rank === 1 ? "ring-accent" : "ring-line")} />
              <span className={cn("absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-2 ring-bg",
                e.rank === 1 ? "bg-accent text-accent-ink" : "bg-ink text-bg")}>{e.rank}</span>
            </div>
            <div className={cn("mt-2 w-full truncate text-sm font-medium", e.isMe && "text-accent")}>{e.isMe ? t("shooting.board.you") : e.name}</div>
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

function Row({ e, board, t }: { e: LeaderboardEntry; board: Leaderboard; t: TFunction }) {
  const topLabel = topShotsText(t, board.topShotsLabel);
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", e.isMe && "bg-accent-soft")} aria-current={e.isMe ? "true" : undefined}>
      <span className={cn("w-7 shrink-0 text-center text-sm font-semibold tabular-nums", e.rank <= 3 ? "text-accent" : "text-ink-3")}>{e.rank}.</span>
      <Avatar name={e.name} src={e.avatarUrl} size={36} tone={e.userId ? "soft" : "guest"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate">{e.name}</span>
          {e.isMe ? <Badge tone="accent">{t("shooting.board.you")}</Badge> : null}
        </div>
        <div className="text-xs text-ink-3 truncate">
          {formatDay(e.date)}
          {e.attempts > 1 ? ` · ${tCount(t, "shooting.board.attempts", e.attempts)}` : ""}
          {board.showTopShots && e.topShots ? ` · ${e.topShots}${topLabel.startsWith("×") ? "" : " "}${topLabel}` : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-semibold tabular-nums">{formatScore(e.total, board.decimal)}</div>
        <div className="text-[11px] text-ink-3">{t("shooting.common.ofMax", { max: board.program.max })}</div>
      </div>
    </li>
  );
}

/** Vollständige Rangliste mit hervorgehobener eigener Position. */
export function LeaderboardList({ board, entries, locale = "de" }: { board: Leaderboard; entries?: LeaderboardEntry[]; locale?: Locale }) {
  const t = getT(locale);
  const list = entries ?? board.entries;
  return (
    <Card className="animate-rise overflow-hidden">
      <ol className="divide-y divide-line">
        {list.map((e) => <Row key={e.key} e={e} board={board} t={t} />)}
      </ol>
    </Card>
  );
}

/** Kompakte Vorschau (Top 3 + eigene Position) für die Programmseite. */
export function LeaderboardTeaser({ board, href, locale = "de" }: { board: Leaderboard; href: string; locale?: Locale }) {
  const t = getT(locale);
  const top = board.entries.slice(0, 3);
  const showMe = board.me && board.me.rank > 3;
  return (
    <Card className="animate-rise overflow-hidden">
      {top.length ? (
        <ol className="divide-y divide-line">
          {top.map((e) => <Row key={e.key} e={e} board={board} t={t} />)}
          {showMe && board.me ? <Row e={board.me} board={board} t={t} /> : null}
        </ol>
      ) : (
        <div className="flex items-center gap-3 px-4 py-4 text-sm text-ink-3">
          <Trophy className="h-5 w-5 shrink-0" /> {t("shooting.board.teaserEmpty", { period: periodLabelText(t, locale, board.period, board.periodLabel) })}
        </div>
      )}
      <Link href={href} className="press flex items-center justify-center gap-1.5 border-t border-line px-4 py-3 text-sm font-medium text-ink-2 hover:bg-surface-2">
        <Trophy className="h-4 w-4" /> {t("shooting.board.full")}
      </Link>
    </Card>
  );
}
