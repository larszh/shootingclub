import type { Metadata } from "next";
import Link from "next/link";
import { Info, Trophy, UserRound } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { listPrograms } from "@/modules/scores/queries";
import { getLeaderboard, programUsageCounts } from "@/modules/scores/insights";
import { parsePeriod, type Period } from "@/modules/scores/analytics";
import { formatScore } from "@/lib/utils";
import { LeaderboardList, Podium } from "@/modules/scores/ui/leaderboard";
import { PeriodTabs } from "@/modules/scores/ui/period-tabs";
import { QuerySelect } from "@/modules/scores/ui/query-select";
import { getRequestLocale, getT, INTL_LOCALE } from "@/lib/i18n";
import { periodLabelText } from "@/modules/scores/ui/labels";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.common.leaderboard") };
}

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireModule("scores");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const sp = await searchParams;
  const period = parsePeriod(one(sp.period));
  const [programs, usage] = await Promise.all([listPrograms(ctx), programUsageCounts(ctx.tenant.id)]);

  // Standard: das im Verein meistgeschossene Programm.
  const byUsage = [...programs].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name, INTL_LOCALE[locale]));
  const programId = one(sp.programId) || byUsage[0]?.id;

  if (!programId) {
    return (
      <div>
        <PageHeader title={t("shooting.common.leaderboard")} back={{ href: "/scores", label: t("shooting.common.shooting") }} />
        <EmptyState icon={<Trophy className="h-5 w-5" />} title={t("shooting.board.noPrograms")} text={t("shooting.board.noProgramsText")} />
      </div>
    );
  }

  const board = await getLeaderboard(ctx, programId, period);
  const href = (p: Period) => `/scores/leaderboard?${new URLSearchParams({ programId, period: p }).toString()}`;
  const options = byUsage.map((p) => ({ value: p.id, label: usage[p.id] ? `${p.name} (${usage[p.id]})` : p.name }));
  if (board && !options.some((o) => o.value === board.program.id)) options.unshift({ value: board.program.id, label: board.program.name });
  const periodLabel = board ? periodLabelText(t, locale, board.period, board.periodLabel) : "";

  return (
    <div>
      <PageHeader title={t("shooting.common.leaderboard")} subtitle={t("shooting.board.subtitle", { club: ctx.tenant.name })} back={{ href: "/scores", label: t("shooting.common.shooting") }} />

      <div className="animate-fade space-y-3 mb-5">
        <QuerySelect name="programId" label={t("shooting.common.program")} value={board?.program.id ?? programId} options={options} />
        <PeriodTabs current={period} hrefFor={{ month: href("month"), year: href("year"), all: href("all") }} locale={locale} />
      </div>

      {!board ? (
        <EmptyState title={t("shooting.board.programNotFound")} text={t("shooting.board.programNotFoundText")} action={<LinkButton href="/scores/leaderboard" variant="secondary" size="sm">{t("shooting.board.toBoard")}</LinkButton>} />
      ) : board.entries.length === 0 ? (
        <EmptyState icon={<Trophy className="h-5 w-5" />} title={t("shooting.board.empty")}
          text={t("shooting.board.emptyText", { program: board.program.name, period: periodLabel })}
          action={ctx.can("match.create") ? <LinkButton href={`/scores/matches/new?programId=${board.program.id}`} size="sm">{t("shooting.board.shootNow")}</LinkButton> : null} />
      ) : (
        <>
          <Podium board={board} locale={locale} />

          <Card className="animate-rise mt-4 flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><UserRound className="h-5 w-5" /></span>
            {board.me ? (
              <div className="min-w-0">
                <div className="font-medium">{t("shooting.board.myRank", { rank: board.me.rank, count: board.entries.length })}</div>
                <div className="text-sm text-ink-3">
                  {t("shooting.board.myBest", { total: formatScore(board.me.total, board.decimal), max: board.program.max })}
                  {board.me.rank > 1 ? ` · ${t("shooting.board.behind", { diff: formatScore(board.entries[0]!.total - board.me.total, board.decimal) })}` : ` · ${t("shooting.board.top")}`}
                  {board.me.zeros ? ` · ${t("shooting.board.zeros", { n: board.me.zeros })}` : ""}
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="font-medium">{t("shooting.board.notYet")}</div>
                <div className="text-sm text-ink-3">{t("shooting.board.notYetText")}</div>
              </div>
            )}
          </Card>

          <SectionTitle>{board.program.name} · {periodLabel}</SectionTitle>
          <LeaderboardList board={board} locale={locale} />

          {board.guests.length ? (
            <>
              <SectionTitle>{t("shooting.board.guests")}</SectionTitle>
              <LeaderboardList board={board} entries={board.guests} locale={locale} />
            </>
          ) : null}
        </>
      )}

      <p className="mt-6 flex gap-2 text-xs text-ink-3">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {t("shooting.board.rules")}
          {board ? <> {t("shooting.board.historyBefore")}<Link href={`/scores/stats?programId=${board.program.id}`} className="underline hover:text-ink">{t("shooting.board.historyLink")}</Link>{t("shooting.board.historyAfter")}</> : null}
        </span>
      </p>
    </div>
  );
}
