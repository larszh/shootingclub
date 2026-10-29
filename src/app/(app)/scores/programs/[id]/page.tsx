import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, LineChart, Pencil, Play } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getProgram, listMatches } from "@/modules/scores/queries";
import { getLeaderboard, getProgramProgress, programUsageCounts } from "@/modules/scores/insights";
import { formatDay } from "@/modules/scores/analytics";
import { disciplineLabel, formatDistances, maxShotValue, officialKindLabel, OFFICIAL_RULES_HINT, positionLabel, SCORING_MODES, stageZones } from "@/modules/scores/types";
import { formatScore } from "@/lib/utils";
import { FavoriteButton } from "@/modules/scores/ui/favorite-button";
import { ProgramArchiveButton, ProgramHiddenToggle } from "@/modules/scores/ui/admin-controls";
import { ProgramCopyButton } from "@/modules/scores/ui/program-tools";
import { LeaderboardTeaser } from "@/modules/scores/ui/leaderboard";
import { MatchRow } from "@/modules/scores/ui/match-row";
import { dominantZones, sameZones, ZoneLegend } from "@/modules/scores/ui/zone-legend";

export const metadata: Metadata = { title: "Programm" };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireModule("scores");
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
  const mode = SCORING_MODES.find((m) => m.key === p.scoringMode);
  const used = usage[p.id] ?? 0;
  const isZones = p.scoringMode === "ZONES";
  const programZones = isZones ? dominantZones(p.stages.map((s) => stageZones(s))) : null;

  return (
    <div>
      <PageHeader title={p.name} subtitle={p.description ?? undefined} back={{ href: "/scores/programs", label: "Programme" }} action={<FavoriteButton programId={p.id} favorite={p.favorite} />} />

      <div className="animate-rise flex flex-wrap gap-1.5 mb-4">
        <Badge>{disciplineLabel(p.discipline)}</Badge>
        {p.weaponNote ? <Badge tone="outline">{p.weaponNote}</Badge> : null}
        <Badge tone="outline">{formatDistances(p.totals.distances)}</Badge>
        <Badge tone="outline">{p.totals.shots} Schuss · max. {p.totals.max}</Badge>
        <Badge tone={isZones ? "danger" : "neutral"}>Wertung: {mode?.label ?? p.scoringMode}</Badge>
        {p.scope === "global" ? <Badge tone="accent">Global</Badge> : <Badge tone="accent">Verein</Badge>}
        {used ? <Badge tone="outline">{used}× im Verein geschossen</Badge> : null}
        {p.hidden ? <Badge tone="warn">Versteckt</Badge> : null}
        {p.isArchived ? <Badge tone="warn">Archiviert</Badge> : null}
        {p.officialKind ? <Badge tone="accent">Amtlich: {officialKindLabel(p.officialKind)}</Badge> : null}
      </div>
      {p.officialKind ? (
        <p className="animate-rise -mt-2 mb-4 text-xs text-ink-3">
          {p.passMinScore !== null || p.passMaxZeros !== null
            ? `Bestanden bei ${[p.passMinScore !== null ? `mind. ${p.passMinScore} Punkten` : null, p.passMaxZeros !== null ? `höchstens ${p.passMaxZeros} Nullern` : null].filter(Boolean).join(" und ")}. `
            : "Keine Bestehensregel hinterlegt. "}
          {OFFICIAL_RULES_HINT}
        </p>
      ) : null}

      {!p.isArchived && ctx.can("match.create") ? (
        <LinkButton href={`/scores/matches/new?programId=${p.id}`} size="lg" className="w-full animate-rise [animation-delay:80ms]"><Play className="h-5 w-5" /> Durchgang starten</LinkButton>
      ) : null}

      {isZones && programZones ? (
        <Card className="animate-rise mt-4 p-4">
          <div className="text-sm font-semibold">Trefferzonen</div>
          <p className="mt-0.5 text-xs text-ink-3">Punkte pro Schuss. Rot markierte Zonen sind Strafpunkte und werden abgezogen – das Total kann negativ werden.</p>
          <ZoneLegend zones={programZones} className="mt-3" />
        </Card>
      ) : null}

      {progress && progress.count > 0 ? (
        <>
          <SectionTitle action={<Link href={`/scores/stats?programId=${p.id}`} className="text-xs text-ink-3 hover:text-ink">Verlauf</Link>}>Deine Bestleistung</SectionTitle>
          <Link href={progress.bestMatchId ? `/scores/matches/${progress.bestMatchId}` : `/scores/stats?programId=${p.id}`} className="press block">
            <Card className="animate-rise flex items-center gap-3 p-4 hover:border-ink/30">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Award className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-2xl font-semibold tabular-nums leading-tight">
                  {formatScore(progress.best, progress.decimal)} <span className="text-sm font-normal text-ink-3">von {p.totals.max}</span>
                </div>
                <div className="text-xs text-ink-3">
                  {progress.bestDate ? `am ${formatDay(progress.bestDate)} · ` : ""}Ø {formatScore(progress.avg, progress.decimal)} aus {progress.count} {progress.count === 1 ? "Durchgang" : "Durchgängen"}
                </div>
              </div>
              <LineChart className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />
            </Card>
          </Link>
        </>
      ) : null}

      {board ? (
        <>
          <SectionTitle action={<Link href={`/scores/leaderboard?programId=${p.id}`} className="text-xs text-ink-3 hover:text-ink">Alle Zeiträume</Link>}>Rangliste {board.periodLabel}</SectionTitle>
          <LeaderboardTeaser board={board} href={`/scores/leaderboard?programId=${p.id}`} />
        </>
      ) : null}

      <SectionTitle>Ablauf</SectionTitle>
      <Card className="animate-rise divide-y divide-line overflow-hidden">
        {p.stages.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-ink-3">
                {s.distanceM} m · {s.shots} Schuss{p.scoringMode !== "HITS" ? ` · max. ${isZones ? s.shots * maxShotValue(s, p.scoringMode) : s.maxPerShot}` : ""}
                {s.position ? ` · ${positionLabel(s.position)}` : ""}{s.timeLimitSec ? ` · ${s.timeLimitSec} s` : ""}
                {s.targetName ? ` · ${s.targetName}` : ""}
              </div>
              {s.note ? <div className="text-xs text-ink-3 italic mt-0.5">{s.note}</div> : null}
              {isZones && programZones && !sameZones(stageZones(s), programZones) ? (
                <div className="mt-1.5"><div className="text-[11px] text-ink-3 mb-1">Eigene Zonen:</div><ZoneLegend zones={stageZones(s)} compact /></div>
              ) : null}
            </div>
          </div>
        ))}
      </Card>

      {canManage ? (
        <>
          <SectionTitle>Verwaltung</SectionTitle>
          <div className="animate-rise flex flex-wrap gap-2">
            <ProgramHiddenToggle programId={p.id} hidden={p.hidden} />
            {p.scope === "tenant" ? <LinkButton href={`/scores/programs/${p.id}/edit`} variant="secondary" size="sm"><Pencil className="h-4 w-4" /> Bearbeiten</LinkButton> : null}
            {p.scope === "tenant" ? <ProgramArchiveButton programId={p.id} archived={p.isArchived} /> : null}
          </div>
          <div className="animate-rise mt-2">
            <ProgramCopyButton programId={p.id} scope={p.scope} />
            {p.scope === "global" ? <p className="mt-1 text-xs text-ink-3">Die Kopie gehört deinem Verein und kann angepasst werden. Bisherige Resultate bleiben beim Original.</p> : null}
          </div>
        </>
      ) : null}

      {matches.length ? (
        <>
          <SectionTitle action={<Link href={`/scores/matches?programId=${p.id}`} className="text-xs text-ink-3 hover:text-ink">Alle</Link>}>Letzte Durchgänge</SectionTitle>
          <div className="stagger space-y-2.5">{matches.map((m) => <MatchRow key={m.id} m={m} againFor={ctx.can("match.create") ? ctx.user.id : undefined} />)}</div>
        </>
      ) : null}
    </div>
  );
}
