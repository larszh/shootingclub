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

export const metadata: Metadata = { title: "Rangliste" };

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireModule("scores");
  const sp = await searchParams;
  const period = parsePeriod(one(sp.period));
  const [programs, usage] = await Promise.all([listPrograms(ctx), programUsageCounts(ctx.tenant.id)]);

  // Standard: das im Verein meistgeschossene Programm.
  const byUsage = [...programs].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name, "de-CH"));
  const programId = one(sp.programId) || byUsage[0]?.id;

  if (!programId) {
    return (
      <div>
        <PageHeader title="Rangliste" back={{ href: "/scores", label: "Schiessen" }} />
        <EmptyState icon={<Trophy className="h-5 w-5" />} title="Noch keine Programme" text="Sobald es Programme gibt, siehst du hier die Rangliste des Vereins." />
      </div>
    );
  }

  const board = await getLeaderboard(ctx, programId, period);
  const href = (p: Period) => `/scores/leaderboard?${new URLSearchParams({ programId, period: p }).toString()}`;
  const options = byUsage.map((p) => ({ value: p.id, label: usage[p.id] ? `${p.name} (${usage[p.id]})` : p.name }));
  if (board && !options.some((o) => o.value === board.program.id)) options.unshift({ value: board.program.id, label: board.program.name });

  return (
    <div>
      <PageHeader title="Rangliste" subtitle={`${ctx.tenant.name} · beste Resultate pro Mitglied`} back={{ href: "/scores", label: "Schiessen" }} />

      <div className="animate-fade space-y-3 mb-5">
        <QuerySelect name="programId" label="Programm" value={board?.program.id ?? programId} options={options} />
        <PeriodTabs current={period} hrefFor={{ month: href("month"), year: href("year"), all: href("all") }} />
      </div>

      {!board ? (
        <EmptyState title="Programm nicht gefunden" text="Dieses Programm gibt es in deinem Verein nicht." action={<LinkButton href="/scores/leaderboard" variant="secondary" size="sm">Zur Rangliste</LinkButton>} />
      ) : board.entries.length === 0 ? (
        <EmptyState icon={<Trophy className="h-5 w-5" />} title="Noch keine Rangliste"
          text={`Für «${board.program.name}» gibt es im Zeitraum «${board.periodLabel}» noch keine abgeschlossenen Durchgänge.`}
          action={ctx.can("match.create") ? <LinkButton href={`/scores/matches/new?programId=${board.program.id}`} size="sm">Jetzt schiessen</LinkButton> : null} />
      ) : (
        <>
          <Podium board={board} />

          <Card className="animate-rise mt-4 flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"><UserRound className="h-5 w-5" /></span>
            {board.me ? (
              <div className="min-w-0">
                <div className="font-medium">Du bist auf Rang {board.me.rank} von {board.entries.length}</div>
                <div className="text-sm text-ink-3">
                  Dein Bestes: {formatScore(board.me.total, board.decimal)} von {board.program.max}
                  {board.me.rank > 1 ? ` · ${formatScore(board.entries[0]!.total - board.me.total, board.decimal)} hinter Rang 1` : " · Spitze!"}
                </div>
              </div>
            ) : (
              <div className="min-w-0">
                <div className="font-medium">Du bist noch nicht in der Rangliste</div>
                <div className="text-sm text-ink-3">Schiesse das Programm und schliesse den Durchgang ab.</div>
              </div>
            )}
          </Card>

          <SectionTitle>{board.program.name} · {board.periodLabel}</SectionTitle>
          <LeaderboardList board={board} />

          {board.guests.length ? (
            <>
              <SectionTitle>Gäste</SectionTitle>
              <LeaderboardList board={board} entries={board.guests} />
            </>
          ) : null}
        </>
      )}

      <p className="mt-6 flex gap-2 text-xs text-ink-3">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Es zählen nur abgeschlossene Durchgänge. Pro Mitglied gilt das beste Resultat. Bei Punktgleichheit entscheiden mehr Zehner bzw. Höchstwerte, dann die höhere letzte Serie, dann das frühere Datum.
          {board ? <> Deinen Verlauf siehst du in der <Link href={`/scores/stats?programId=${board.program.id}`} className="underline hover:text-ink">Statistik</Link>.</> : null}
        </span>
      </p>
    </div>
  );
}
