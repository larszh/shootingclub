import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, ListChecks, Play, Star } from "lucide-react";
import { requireModule } from "@/lib/tenant";
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { listMatches, listPrograms } from "@/modules/scores/queries";
import { formatDate, formatScore } from "@/lib/utils";
import { ProgramCard } from "@/modules/scores/ui/program-card";

export const metadata: Metadata = { title: "Schiessen" };

export default async function ScoresPage() {
  const ctx = await requireModule("scores");
  const [programs, matches] = await Promise.all([listPrograms(ctx), listMatches(ctx, { limit: 5 })]);
  const favorites = programs.filter((p) => p.favorite);
  const open = matches.filter((m) => m.status === "OPEN");

  return (
    <div>
      <PageHeader title="Schiessen" subtitle="Programme, Durchgänge und Resultate" action={<LinkButton href="/scores/matches/new" size="sm"><Play className="h-4 w-4" /> Starten</LinkButton>} />

      <div className="stagger grid grid-cols-3 gap-2.5 mb-2">
        <Link href="/scores/programs" className="press"><Card className="p-3.5 text-center hover:border-ink/30"><ListChecks className="h-5 w-5 mx-auto mb-1 text-ink-2" /><div className="text-xs font-medium">Programme</div></Card></Link>
        <Link href="/scores/matches" className="press"><Card className="p-3.5 text-center hover:border-ink/30"><ArrowRight className="h-5 w-5 mx-auto mb-1 text-ink-2" /><div className="text-xs font-medium">Durchgänge</div></Card></Link>
        <Link href="/scores/stats" className="press"><Card className="p-3.5 text-center hover:border-ink/30"><BarChart3 className="h-5 w-5 mx-auto mb-1 text-ink-2" /><div className="text-xs font-medium">Statistik</div></Card></Link>
      </div>

      {open.length ? (
        <>
          <SectionTitle>Offen</SectionTitle>
          <div className="stagger space-y-2.5">
            {open.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </>
      ) : null}

      <SectionTitle action={<Link href="/scores/programs" className="text-xs text-ink-3 hover:text-ink">Alle Programme</Link>}>Favoriten</SectionTitle>
      {favorites.length ? (
        <div className="stagger grid gap-2.5 sm:grid-cols-2">
          {favorites.map((p) => <ProgramCard key={p.id} program={p} href={`/scores/matches/new?programId=${p.id}`} />)}
        </div>
      ) : (
        <EmptyState icon={<Star className="h-5 w-5" />} title="Keine Favoriten" text="Markiere Programme mit dem Stern." action={<LinkButton href="/scores/programs" variant="secondary" size="sm">Programme</LinkButton>} />
      )}

      <SectionTitle action={<Link href="/scores/matches" className="text-xs text-ink-3 hover:text-ink">Alle</Link>}>Zuletzt</SectionTitle>
      {matches.filter((m) => m.status !== "OPEN").length ? (
        <div className="stagger space-y-2.5">
          {matches.filter((m) => m.status !== "OPEN").map((m) => <MatchRow key={m.id} m={m} />)}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Noch keine abgeschlossenen Durchgänge.</p>
      )}
    </div>
  );
}

export function MatchRow({ m }: { m: Awaited<ReturnType<typeof listMatches>>[number] }) {
  const decimal = m.program.scoringMode === "RINGS_DECIMAL";
  const best = Math.max(0, ...m.participants.map((p) => p.total));
  return (
    <Link href={`/scores/matches/${m.id}`} className="block press">
      <Card className="p-4 hover:border-ink/30 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium truncate">{m.title ?? m.program.name}</div>
            <div className="text-xs text-ink-3 truncate">{formatDate(m.date)} · {m.participants.map((p) => p.name).join(" vs. ")}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-semibold tabular-nums">{formatScore(best, decimal)}</div>
            <div className="text-[11px] text-ink-3">von {m.maxScore}{m.status === "OPEN" ? " · offen" : ""}</div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
