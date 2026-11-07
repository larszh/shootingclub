import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge, Card, ProgressBar } from "@/components/ui";
import { openSlots, type RankingEntry } from "@/modules/championship/ranking";
import { NO_CATEGORY, formatPoints } from "@/modules/championship/types";
import { DEFAULT_LOCALE, getT, type Locale } from "@/lib/i18n/core";

/** «Mein Stand»: Rang, Total, Kategorie und was noch zählen kann. */
export function MyStanding({ championshipId, name, entry, categoryRank, totalRanked, compact, locale = DEFAULT_LOCALE }: { championshipId: string; name?: string; entry: RankingEntry | null; categoryRank?: number | null; totalRanked: number; compact?: boolean; locale?: Locale }) {
  const t = getT(locale);
  const cat = (c: string) => (c === NO_CATEGORY ? t("shooting.champ.noCategory") : c);
  if (!entry) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-ink-3" aria-hidden /> {t("shooting.champ.myStanding")}{name ? ` · ${name}` : ""}</div>
        <p className="mt-1 text-sm text-ink-3">{t("shooting.champ.noResult")}</p>
      </Card>
    );
  }
  const slots = openSlots(entry);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-accent" aria-hidden /> {t("shooting.champ.myStanding")}{name ? ` · ${name}` : ""}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {entry.rank ? t("shooting.champ.rankN", { n: entry.rank }) : t("shooting.champ.unclassified")}
            {entry.rank ? <span className="text-sm font-normal text-ink-3">{t("shooting.champ.ofN", { n: totalRanked })}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {entry.category !== NO_CATEGORY ? <Badge>{entry.category}{categoryRank ? `: ${t("shooting.champ.rankN", { n: categoryRank })}` : ""}</Badge> : <Badge tone="outline">{cat(NO_CATEGORY)}</Badge>}
            {entry.bonus ? <Badge tone="accent">{t("shooting.champ.bonus", { n: formatPoints(entry.bonus) })}</Badge> : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-3xl font-semibold tabular-nums">{formatPoints(entry.total)}</div>
          <div className="text-xs text-ink-3">{t("shooting.champ.points")}</div>
        </div>
      </div>
      {entry.missingRequired.length ? (
        <p className="mt-3 rounded-control bg-warn/10 px-3 py-2 text-sm text-warn">{t("shooting.champ.missing", { list: entry.missingRequired.join(", ") })}</p>
      ) : null}
      {!compact ? (
        <ul className="mt-3 space-y-2.5">
          {slots.map((s) => (
            <li key={s.programId}>
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 tabular-nums text-ink-3">
                  {s.limit === null ? t("shooting.champ.slotAll", { n: s.counted }) : t("shooting.champ.slotOf", { n: s.counted, limit: s.limit })}
                  {s.weakest !== null ? t("shooting.champ.weakest", { n: formatPoints(s.weakest) }) : ""}
                </span>
              </div>
              {s.limit !== null ? <ProgressBar value={s.counted} max={s.limit} label={t("shooting.champ.slotAria", { name: s.name, n: s.counted, limit: s.limit })} size="sm" className="mt-1" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={`/championship/${championshipId}/member/${entry.userId}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
        {t("shooting.champ.details")}
      </Link>
    </Card>
  );
}
