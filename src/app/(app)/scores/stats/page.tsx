import type { Metadata } from "next";
import Link from "next/link";
import { Award, Flame, LineChart, Target } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { getProgramProgress, getUserScoreStats } from "@/modules/scores/insights";
import { formatDay } from "@/modules/scores/analytics";
import { cn, formatScore } from "@/lib/utils";
import { ProgressChart } from "@/modules/scores/ui/progress-chart";
import { QuerySelect } from "@/modules/scores/ui/query-select";
import { ExportLink } from "@/modules/scores/ui/export-link";

export const metadata: Metadata = { title: "Statistik" };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireModule("scores");
  const sp = await searchParams;
  const stats = await getUserScoreStats(ctx);
  const selectedId = one(sp.programId) && stats.programs.some((p) => p.programId === one(sp.programId)) ? one(sp.programId)! : stats.programs[0]?.programId;
  const progress = selectedId ? await getProgramProgress(ctx, selectedId) : null;
  const maxDistShots = Math.max(1, ...stats.distances.map((d) => d.shots));

  return (
    <div>
      <PageHeader title="Meine Statistik" subtitle={ctx.tenant.name} back={{ href: "/scores", label: "Schiessen" }} />

      <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi value={stats.matches} label="Durchgänge" sub={stats.matchesThisYear ? `${stats.matchesThisYear} dieses Jahr` : undefined} />
        <Kpi value={stats.totalShots} label="Schüsse erfasst" />
        <Kpi value={stats.programs.length} label="Programme" />
        <Card className="p-4">
          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-semibold tabular-nums">{stats.streak.current}</span>
            <Flame className={cn("h-5 w-5", stats.streak.current > 0 ? "text-accent" : "text-ink-3")} aria-hidden />
          </div>
          <div className="text-xs text-ink-3">{stats.streak.current === 1 ? "Woche in Folge" : "Wochen in Folge"}</div>
          <div className="text-[11px] text-ink-3 mt-0.5">Rekord: {stats.streak.longest}</div>
        </Card>
      </div>
      {stats.streak.current > 0 && !stats.streak.activeThisWeek ? (
        <p className="animate-fade mt-2 text-sm text-ink-2">Schiesse diese Woche, damit deine Serie von {stats.streak.current} {stats.streak.current === 1 ? "Woche" : "Wochen"} weiterläuft.</p>
      ) : null}

      {stats.programs.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<LineChart className="h-5 w-5" />} title="Noch keine Resultate" text="Sobald du Durchgänge vollständig erfasst oder abschliesst, erscheinen hier dein Verlauf und deine Bestleistungen."
            action={ctx.can("match.create") ? <LinkButton href="/scores/matches/new" size="sm">Durchgang starten</LinkButton> : null} />
        </div>
      ) : (
        <>
          <SectionTitle>Verlauf</SectionTitle>
          <Card className="animate-rise p-4">
            <div className="mb-3">
              <QuerySelect name="programId" label="Programm für den Verlauf" value={selectedId ?? ""}
                options={stats.programs.map((p) => ({ value: p.programId, label: `${p.name} (${p.count}×)` }))} />
            </div>
            {progress && progress.points.length ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Bestwert" value={formatScore(progress.best, progress.decimal)} accent />
                  <Mini label="Durchschnitt" value={formatScore(progress.avg, progress.decimal)} />
                  <Mini label="Zuletzt" value={formatScore(progress.last, progress.decimal)} />
                </div>
                <ProgressChart id={`chart-${progress.program.id}`} title={`Verlauf ${progress.program.name}`} points={progress.points}
                  best={progress.best} avg={progress.avg} max={progress.program.max} decimal={progress.decimal} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <LinkButton href={`/scores/leaderboard?programId=${progress.program.id}`} variant="secondary" size="sm"><Award className="h-4 w-4" /> Rangliste</LinkButton>
                  <LinkButton href={`/scores/programs/${progress.program.id}`} variant="ghost" size="sm">Zum Programm</LinkButton>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-3">Für dieses Programm gibt es noch keine vollständigen Durchgänge.</p>
            )}
          </Card>

          <SectionTitle>Pro Programm</SectionTitle>
          <Card className="animate-rise divide-y divide-line overflow-hidden">
            {stats.programs.map((p) => {
              const pct = p.max ? Math.min(100, Math.round((p.best / p.max) * 100)) : 0;
              const avgPct = p.max ? Math.min(100, Math.round((p.avg / p.max) * 100)) : 0;
              return (
                <Link key={p.programId} href={`/scores/stats?programId=${p.programId}`} scroll={false}
                  className={cn("block px-4 py-3 hover:bg-surface-2 transition-colors", p.programId === selectedId && "bg-surface-2")}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-ink-3">
                        {p.count}× · Ø {formatScore(p.avg, p.decimal)} · zuletzt {formatScore(p.last, p.decimal)}
                        {p.scoringMode === "HITS" ? ` · ${Math.round(p.avgPerShot * 100)}% Treffer` : ` · Ø ${p.avgPerShot.toFixed(2)} pro Schuss`}
                      </div>
                      <div className="text-[11px] text-ink-3">{p.shots} Schüsse</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-semibold tabular-nums">{formatScore(p.best, p.decimal)}</div>
                      <div className="text-[11px] text-ink-3">von {p.max}</div>
                    </div>
                  </div>
                  <div className="relative mt-2 h-1.5 rounded-full bg-line/60" role="img" aria-label={`Bestwert ${pct} Prozent, Durchschnitt ${avgPct} Prozent des Maximums`}>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${pct}%` }} />
                    <div className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded-full bg-accent" style={{ left: `calc(${avgPct}% - 1px)` }} title="Durchschnitt" />
                  </div>
                </Link>
              );
            })}
          </Card>

          <p className="mt-1.5 text-[11px] text-ink-3">Balken: Bestwert im Verhältnis zum Maximum · farbiger Strich: dein Durchschnitt</p>

          <SectionTitle>Persönliche Rekorde</SectionTitle>
          <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {stats.records.map((r) => (
              <Link key={r.programId} href={`/scores/matches/${r.matchId}`} className="press block">
                <Card className="flex items-center gap-3 p-4 hover:border-ink/30">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><Award className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-ink-3">am {formatDay(r.date)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-semibold tabular-nums">{formatScore(r.best, r.decimal)}</div>
                    <div className="text-[11px] text-ink-3">von {r.max}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      {stats.distances.length ? (
        <>
          <SectionTitle>Nach Distanz</SectionTitle>
          <Card className="animate-rise p-4">
            <ul className="space-y-3">
              {stats.distances.map((d) => (
                <li key={d.distanceM}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-medium"><Target className="h-4 w-4 text-ink-3" aria-hidden /> {d.distanceM} m</span>
                    <span className="text-ink-3 tabular-nums text-xs">
                      {d.shots} Schuss
                      {d.ringAvg !== null ? ` · Ø ${d.ringAvg.toFixed(2)} Ringe` : ""}
                      {d.hitRate !== null ? ` · ${d.hitRate}% Treffer` : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-surface-2 overflow-hidden" aria-hidden>
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, Math.round((d.shots / maxDistShots) * 100))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}

      <SectionTitle>Export</SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <ExportLink href="/api/export/scores/me">Meine Resultate (CSV)</ExportLink>
        {ctx.can("match.viewAll") ? <ExportLink href="/api/export/scores/tenant">Alle Vereinsresultate (CSV)</ExportLink> : null}
        <Badge tone="outline">Für Excel und Numbers</Badge>
      </div>
    </div>
  );
}

function Kpi({ value, label, sub }: { value: number; label: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-ink-3">{label}</div>
      {sub ? <div className="text-[11px] text-ink-3 mt-0.5">{sub}</div> : null}
    </Card>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-control px-2 py-2", accent ? "bg-accent-soft" : "bg-surface-2")}>
      <div className={cn("text-lg font-semibold tabular-nums", accent && "text-accent")}>{value}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}
