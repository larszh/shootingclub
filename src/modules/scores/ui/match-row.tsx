import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Badge, Card } from "@/components/ui";
import { cn, formatScore } from "@/lib/utils";
import { formatDay } from "@/modules/scores/analytics";
import type { MatchListItem } from "@/modules/scores/queries";
import { getT, type Locale } from "@/lib/i18n/core";

/**
 * Link auf «Durchgang starten» mit demselben Programm und denselben Mitgliedern.
 * Query-Parameter: programId=<id>&with=<userId,userId,…> (ohne den aktuellen Benutzer, ohne Gäste).
 */
export function againHref(m: MatchListItem, meId: string) {
  const ids = m.participants.filter((p) => p.userId && p.userId !== meId).map((p) => p.userId!);
  const qs = new URLSearchParams({ programId: m.program.id });
  if (ids.length) qs.set("with", ids.join(","));
  return `/scores/matches/new?${qs.toString()}`;
}

export function MatchRow({ m, againFor, locale = "de" }: { m: MatchListItem; /** Benutzer-ID: zeigt den «Nochmals»-Knopf */ againFor?: string; locale?: Locale }) {
  const t = getT(locale);
  const decimal = m.program.scoringMode === "RINGS_DECIMAL";
  // Bestes Total (kann bei Zonenwertung mit Strafpunkten negativ sein)
  const best = m.participants.length ? Math.max(...m.participants.map((p) => p.total)) : 0;
  const shown = m.participants.slice(0, 4);
  const body = (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="font-medium truncate">{m.title ?? m.program.name}</div>
          {m.status === "OPEN" ? <Badge tone="warn">{t("shooting.match.openBadge")}</Badge> : null}
        </div>
        <div className="mt-1 flex items-center gap-2 min-w-0">
          <span className="flex -space-x-2 shrink-0" aria-hidden>
            {shown.map((p) => (
              <Avatar key={p.id} name={p.name} src={p.avatarUrl} size={22} tone={p.isGuest ? "guest" : "soft"} className="ring-2 ring-surface" />
            ))}
          </span>
          <span className="text-xs text-ink-3 truncate">
            {formatDay(m.date)} · {m.participants.map((p) => p.name).join(t("shooting.match.vs"))}
          </span>
        </div>
        {m.title ? <div className="text-[11px] text-ink-3 truncate mt-0.5">{m.program.name}</div> : null}
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-semibold tabular-nums">{formatScore(best, decimal)}</div>
        <div className="text-[11px] text-ink-3">{t("shooting.common.ofMax", { max: m.maxScore })}</div>
      </div>
    </div>
  );

  if (!againFor) {
    return (
      <Link href={`/scores/matches/${m.id}`} className="block press">
        <Card className="p-4 hover:border-ink/30 transition-colors">{body}</Card>
      </Link>
    );
  }
  return (
    <Card className="overflow-hidden hover:border-ink/30 transition-colors">
      <Link href={`/scores/matches/${m.id}`} className="block press p-4 pb-3">{body}</Link>
      <div className="flex justify-end border-t border-line px-2 py-1">
        <Link href={againHref(m, againFor)} className={cn("press inline-flex items-center gap-1.5 rounded-control px-3 h-9 text-sm font-medium text-ink-2 hover:bg-surface-2")}
          aria-label={t("shooting.match.againAria", { name: m.program.name })}>
          <RotateCcw className="h-4 w-4" /> {t("shooting.match.again")}
        </Link>
      </div>
    </Card>
  );
}
