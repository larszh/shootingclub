import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, LineChart, Pencil, Play } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getProgram, listMatches } from "@/modules/scores/queries";
import { getLeaderboard, getProgramProgress, programUsageCounts } from "@/modules/scores/insights";
import { formatDistances, maxShotValue, stageZones } from "@/modules/scores/types";
import { formatDate, getRequestLocale, getT } from "@/lib/i18n";
import { disciplineText, officialKindText, periodLabelText, positionText, scoringModeText, tCount } from "@/modules/scores/ui/labels";
import { formatScore } from "@/lib/utils";
import { FavoriteButton } from "@/modules/scores/ui/favorite-button";
import { ProgramArchiveButton, ProgramHiddenToggle } from "@/modules/scores/ui/admin-controls";
import { ProgramCopyButton } from "@/modules/scores/ui/program-tools";
import { LeaderboardTeaser } from "@/modules/scores/ui/leaderboard";
import { MatchRow } from "@/modules/scores/ui/match-row";
import { dominantZones, sameZones, ZoneLegend } from "@/modules/scores/ui/zone-legend";

export async function generateMetadata(): Promise<Metadata> {
  return { title: getT(await getRequestLocale())("shooting.common.program") };
}

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("scores");
  const locale = await getRequestLocale();
  const t = getT(locale);
  const { id } = await params;
  const p = await getProgram(ctx, id);
  if (!p) notFound();
  const canManage = ctx.can("tenant.programs.manage");
  const [matches, board, progress, usage] = await Promise.all([
    listMatches(ctx, { programId: id, limit: 5 }),
    getLeaderboard(ctx, id, "year"),
    getProgramProgress(ctx, id),
    programUsageCounts(ctx.tenant.id),
  ]);
  const used = usage[p.id] ?? 0;
  const isZones = p.scoringMode === "ZONES";
  const programZones = isZones ? dominantZones(p.stages.map((s) => stageZones(s))) : null;

  return (
    <div>
      <PageHeader title={p.name} subtitle={p.description ?? undefined} back={{ href: "/scores/programs", label: t("shooting.common.programs") }} action={<FavoriteButton programId={p.id} favorite={p.favorite} locale={locale} />} />

      <div className="animate-rise flex flex-wrap gap-1.5 mb-4">
        <Badge>{disciplineText(t, p.discipline)}</Badge>
        {p.weaponNote ? <Badge tone="outline">{p.weaponNote}</Badge> : null}
        <Badge tone="outline">{formatDistances(p.totals.distances)}</Badge>
        <Badge tone="outline">{tCount(t, "shooting.common.shots", p.totals.shots)} · {t("shooting.match.maxN", { max: p.totals.max })}</Badge>
        <Badge tone={isZones ? "danger" : "neutral"}>{t("shooting.program.scoring", { mode: scoringModeText(t, p.scoringMode) })}</Badge>
        {p.scope === "global" ? <Badge tone="accent">{t("shooting.program.scopeGlobal")}</Badge> : <Badge tone="accent">{t("shooting.program.scopeClub")}</Badge>}
        {used ? <Badge tone="outline">{t("shooting.program.usageClub", { n: used })}</Badge> : null}
        {p.hidden ? <Badge tone="warn">{t("shooting.program.hidden")}</Badge> : null}
        {p.isArchived ? <Badge tone="warn">{t("shooting.program.archived")}</Badge> : null}
        {p.officialKind ? <Badge tone="accent">{t("shooting.program.official", { kind: officialKindText(t, p.officialKind) })}</Badge> : null}
      </div>
      {p.officialKind ? (
        <p className="animate-rise -mt-2 mb-4 text-xs text-ink-3">
          {p.passMinScore !== null || p.passMaxZeros !== null
            ? `${t("shooting.rule.passedAt", { rules: [p.passMinScore !== null ? t("shooting.rule.minScore", { n: p.passMinScore }) : null, p.passMaxZeros !== null ? t("shooting.rule.maxZeros", { n: p.passMaxZeros }) : null].filter(Boolean).join(t("shooting.rule.and")) })} `
            : `${t("shooting.rule.none")} `}
          {t("shooting.officialRulesHint")}
        </p>
      ) : null}

      {!p.isArchived && ctx.can("match.create") ? (
        <LinkButton href={`/scores/matches/new?programId=${p.id}`} size="lg" className="w-full animate-rise [animation-delay:80ms]"><Play className="h-5 w-5" /> {t("shooting.matches.startMatch")}</LinkButton>
      ) : null}

      {isZones && programZones ? (
        <Card className="animate-rise mt-4 p-4">
          <div className="text-sm font-semibold">{t("shooting.program.zones")}</div>
          <p className="mt-0.5 text-xs text-ink-3">{t("shooting.program.zonesText")}</p>
          <ZoneLegend zones={programZones} className="mt-3" />
        </Card>
      ) : null}

      {progress && progress.count > 0 ? (
        <>
          <SectionTitle action={<Link href={`/scores/stats?programId=${p.id}`} className="text-xs text-ink-3 hover:text-ink">{t("shooting.stats.history")}</Link>}>{t("shooting.program.myBest")}</SectionTitle>
          <Link href={progress.bestMatchId ? `/scores/matches/${progress.bestMatchId}` : `/scores/stats?programId=${p.id}`} className="press block">
            <Card className="animate-rise flex items-center gap-3 p-4 hover:border-ink/30">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Award className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-semibold tabular-nums leading-tight">
                  {formatScore(progress.best, progress.decimal)} <span className="text-sm font-normal text-ink-3">{t("shooting.common.ofMax", { max: p.totals.max })}</span>
                </div>
                <div className="text-xs text-ink-3">
                  {progress.bestDate ? `${t("shooting.stats.onDate", { date: formatDate(progress.bestDate, locale) })} · ` : ""}{tCount(t, "shooting.program.avgFrom", progress.count, { avg: formatScore(progress.avg, progress.decimal) })}
                </div>
              </div>
              <LineChart className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
            </Card>
          </Link>
        </>
      ) : null}

      {board ? (
        <>
          <SectionTitle action={<Link href={`/scores/leaderboard?programId=${p.id}`} className="text-xs text-ink-3 hover:text-ink">{t("shooting.program.allPeriods")}</Link>}>{t("shooting.program.boardPeriod", { period: periodLabelText(t, locale, board.period, board.periodLabel) })}</SectionTitle>
          <LeaderboardTeaser board={board} href={`/scores/leaderboard?programId=${p.id}`} locale={locale} />
        </>
      ) : null}

      <SectionTitle>{t("shooting.program.course")}</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {p.stages.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-ink-3">
                {s.distanceM} m · {tCount(t, "shooting.common.shots", s.shots)}{p.scoringMode !== "HITS" ? ` · ${t("shooting.match.maxN", { max: isZones ? s.shots * maxShotValue(s, p.scoringMode) : s.maxPerShot })}` : ""}
                {s.position ? ` · ${positionText(t, s.position)}` : ""}{s.timeLimitSec ? ` · ${s.timeLimitSec} s` : ""}
                {s.targetName ? ` · ${s.targetName}` : ""}
              </div>
              {s.note ? <div className="text-xs text-ink-3 italic mt-0.5">{s.note}</div> : null}
              {isZones && programZones && !sameZones(stageZones(s), programZones) ? (
                <div className="mt-1.5"><div className="text-[11px] text-ink-3 mb-1">{t("shooting.program.ownZones")}</div><ZoneLegend zones={stageZones(s)} compact /></div>
              ) : null}
            </div>
          </div>
        ))}
      </Card>

      {canManage ? (
        <>
          <SectionTitle>{t("shooting.program.manage")}</SectionTitle>
          <div className="animate-rise flex flex-wrap gap-2">
            <ProgramHiddenToggle programId={p.id} hidden={p.hidden} />
            {p.scope === "tenant" ? <LinkButton href={`/scores/programs/${p.id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> {t("shooting.program.edit")}</LinkButton> : null}
            {p.scope === "tenant" ? <ProgramArchiveButton programId={p.id} archived={p.isArchived} /> : null}
          </div>
          <div className="animate-rise mt-2">
            <ProgramCopyButton programId={p.id} scope={p.scope} />
            {p.scope === "global" ? <p className="mt-1 text-xs text-ink-3">{t("shooting.program.copyHint")}</p> : null}
          </div>
        </>
      ) : null}

      {matches.length ? (
        <>
          <SectionTitle action={<Link href={`/scores/matches?programId=${p.id}`} className="text-xs text-ink-3 hover:text-ink">{t("shooting.common.all")}</Link>}>{t("shooting.program.lastMatches")}</SectionTitle>
          <div className="stagger space-y-2.5">{matches.map((m) => <MatchRow key={m.id} m={m} againFor={ctx.can("match.create") ? ctx.user.id : undefined} locale={locale} />)}</div>
        </>
      ) : null}
    </div>
  );
}
